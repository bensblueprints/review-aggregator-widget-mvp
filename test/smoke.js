// Star Stack smoke test — boots the real server, imports reviews via CSV,
// moderates them, and exercises the public widget endpoints exactly the way
// a browser embed would (cross-origin GET, no cookies), asserting rows land
// in SQLite and only APPROVED reviews render back.
// Kills ONLY the spawned server child.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const TEST_PORT = 5551;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

let serverProc = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(delay);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('1. Booting Star Stack on port', TEST_PORT, 'with temp DB (auto-sync off)');
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(TEST_PORT), ADMIN_PASSWORD, DB_PATH, AUTO_SYNC_HOURS: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));
  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('   Auth: wrong password 401, unauthenticated admin API 401, login 200');
  assert.strictEqual((await api('/api/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  cookie = '';
  assert.strictEqual((await api('/api/sources')).status, 401, 'admin API must require auth');
  assert.strictEqual((await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } })).status, 200);

  console.log('2. Create manual source + CSV import (incl. XSS payload + quoted commas)');
  const src = await api('/api/sources', { method: 'POST', body: { type: 'manual', name: 'Word of mouth' } });
  assert.strictEqual(src.status, 201);
  const csv = [
    'author,rating,text,date',
    '"Jane D",5,"Great service, would buy again!",2026-01-15',
    '"Bob <script>alert(1)</script>",4,"Solid product <img src=x onerror=alert(1)>",2026-02-01',
    '"Skip Me",9,"invalid rating row",2026-01-01',
    '"Carl",2,"Meh.",2026-03-10'
  ].join('\n');
  const imp = await api(`/api/sources/${src.data.id}/import`, { method: 'POST', body: { csv } });
  assert.strictEqual(imp.status, 200);
  assert.strictEqual(imp.data.imported, 3, 'valid rows imported (invalid rating skipped)');

  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM reviews').get().n, 3, 'review rows in SQLite');
  const jane = db.prepare("SELECT * FROM reviews WHERE author = 'Jane D'").get();
  assert.ok(jane, 'quoted CSV field with comma parsed correctly');
  assert.strictEqual(jane.approved, 0, 'imports arrive unapproved (moderation first)');

  console.log('3. Widget shows NOTHING until reviews are approved');
  let pub = await fetch(`${BASE}/api/widget/reviews`);
  assert.strictEqual(pub.status, 200);
  assert.ok(pub.headers.get('access-control-allow-origin') === '*', 'widget endpoint is CORS-open');
  let pubData = await pub.json();
  assert.strictEqual(pubData.reviews.length, 0, 'unapproved reviews never leak publicly');

  console.log('4. Approve 2 + feature 1 → widget serves them, featured first');
  const all = (await api('/api/reviews?filter=all')).data;
  const janeRow = all.find((r) => r.author === 'Jane D');
  const bobRow = all.find((r) => r.author.startsWith('Bob'));
  await api(`/api/reviews/${janeRow.id}/moderate`, { method: 'POST', body: { approved: true } });
  await api(`/api/reviews/${bobRow.id}/moderate`, { method: 'POST', body: { approved: true, featured: true } });
  pubData = await (await fetch(`${BASE}/api/widget/reviews`)).json();
  assert.strictEqual(pubData.reviews.length, 2, 'only approved reviews are public');
  assert.strictEqual(pubData.reviews[0].featured, 1, 'featured review sorts first');
  assert.strictEqual(pubData.aggregate.count, 2, 'aggregate counts approved only');
  assert.ok(Math.abs(pubData.aggregate.average - 4.5) < 0.001, 'aggregate average = (5+4)/2');
  // The XSS payload is stored as data and returned as JSON — the widget renders
  // it via textContent. Verify the widget script itself never uses innerHTML.
  const raw = JSON.stringify(pubData);
  assert.ok(raw.includes('<script>alert(1)</script>'), 'payload survives as inert data');

  console.log('5. Widget script: shadow DOM + text-node rendering, no innerHTML with content');
  const wjs = await fetch(`${BASE}/widget.js`);
  assert.strictEqual(wjs.status, 200);
  assert.ok(wjs.headers.get('content-type').includes('javascript'));
  const js = await wjs.text();
  assert.ok(js.includes('attachShadow'), 'widget uses shadow DOM');
  assert.ok(js.includes('textContent'), 'widget renders via text nodes');
  assert.ok(!js.match(/\.innerHTML\s*=/), 'widget never assigns innerHTML');

  console.log('6. min_rating filter + badge.json');
  const filtered = await (await fetch(`${BASE}/api/widget/reviews?min_rating=5`)).json();
  assert.strictEqual(filtered.reviews.length, 1, 'min_rating=5 returns only 5-star reviews');
  assert.strictEqual(filtered.reviews[0].author, 'Jane D');
  const badge = await (await fetch(`${BASE}/badge.json`)).json();
  assert.strictEqual(badge.count, 2);
  assert.ok(Math.abs(badge.average - 4.5) < 0.001);

  console.log('7. Widget config round-trip (theme/layout drive the embed)');
  const cfgPut = await api('/api/widget-config', { method: 'PUT', body: { layout: 'carousel', theme: 'dark', accent: '#ff0000', max_reviews: 5 } });
  assert.strictEqual(cfgPut.data.layout, 'carousel');
  const pubCfg = await (await fetch(`${BASE}/api/widget/reviews`)).json();
  assert.strictEqual(pubCfg.config.layout, 'carousel', 'public endpoint serves saved config');
  assert.strictEqual(pubCfg.config.accent, '#ff0000');

  console.log('8. Google source without creds fails sync gracefully');
  const gsrc = await api('/api/sources', { method: 'POST', body: { type: 'google', name: 'Google' } });
  const sync = await api(`/api/sources/${gsrc.data.id}/sync`, { method: 'POST' });
  assert.strictEqual(sync.status, 400, 'sync without credentials must 400, not crash');

  db.close();
  console.log('\n✅ All Star Stack smoke tests passed');
}

async function cleanup(code) {
  if (serverProc && !serverProc.killed) serverProc.kill();
  await sleep(300);
  for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* windows lock */ }
  }
  process.exit(code);
}

main()
  .then(() => cleanup(0))
  .catch(async (err) => {
    console.error('\n❌ Smoke test failed:', err.message);
    await cleanup(1);
  });
