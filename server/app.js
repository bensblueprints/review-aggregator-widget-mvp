const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb, genToken, getWidgetConfig, setWidgetConfig } = require('./db');
const { syncSource, upsertReviews, startAutoSync, parseCsv } = require('./sync');
const WIDGET = require('./widget-template');

const ADMIN_COOKIE = 'ss_admin';

function createApp({ dbPath, adminPassword, autologinToken = null, autoSyncMs = 6 * 3600 * 1000 } = {}) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());

  app.locals.db = db;
  app.locals.stopAutoSync = startAutoSync(db, autoSyncMs);

  const adminSessions = new Set();
  function requireAdmin(req, res, next) {
    if (req.cookies[ADMIN_COOKIE] && adminSessions.has(req.cookies[ADMIN_COOKIE])) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  // Light per-IP rate limit for the public widget endpoints.
  const rateMap = new Map();
  function rateLimited(key, max = 120, windowMs = 10_000) {
    const now = Date.now();
    const arr = (rateMap.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return true;
    arr.push(now);
    rateMap.set(key, arr);
    if (rateMap.size > 10000) rateMap.clear();
    return false;
  }

  function aggregate(minRating = 1) {
    return db.prepare(
      'SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM reviews WHERE approved = 1 AND rating >= ?'
    ).get(minRating);
  }

  // ================= PUBLIC: widget =================

  const cors = (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };

  app.get('/widget.js', cors, (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/javascript').send(WIDGET);
  });

  // Approved reviews only — the public face of the widget.
  app.get('/api/widget/reviews', cors, (req, res) => {
    if (rateLimited('w:' + (req.ip || ''))) return res.status(429).json({ error: 'rate limited' });
    const cfg = getWidgetConfig(db);
    const minRating = Math.min(Math.max(Number(req.query.min_rating) || cfg.min_rating || 1, 1), 5);
    const sourceName = String(req.query.source || '').slice(0, 120);
    let rows;
    if (sourceName) {
      rows = db.prepare(`
        SELECT r.author, r.rating, r.text, r.review_date, r.featured, s.name AS source_name, s.type AS source_type
        FROM reviews r JOIN sources s ON s.id = r.source_id
        WHERE r.approved = 1 AND r.rating >= ? AND s.name = ?
        ORDER BY r.featured DESC, r.review_date DESC, r.created_at DESC LIMIT ?
      `).all(minRating, sourceName, cfg.max_reviews);
    } else {
      rows = db.prepare(`
        SELECT r.author, r.rating, r.text, r.review_date, r.featured, s.name AS source_name, s.type AS source_type
        FROM reviews r JOIN sources s ON s.id = r.source_id
        WHERE r.approved = 1 AND r.rating >= ?
        ORDER BY r.featured DESC, r.review_date DESC, r.created_at DESC LIMIT ?
      `).all(minRating, cfg.max_reviews);
    }
    res.json({ reviews: rows, aggregate: aggregate(1), config: cfg });
  });

  // Aggregate star-rating badge data (for custom integrations / rich snippets).
  app.get('/badge.json', cors, (req, res) => {
    const agg = aggregate(1);
    res.json({ average: Math.round(agg.average * 10) / 10, count: agg.count });
  });

  // ================= AUTH =================

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'starstack' }));

  app.post('/api/login', (req, res) => {
    if (String((req.body || {}).password || '') !== adminPassword) {
      return res.status(401).json({ error: 'wrong password' });
    }
    const t = genToken();
    adminSessions.add(t);
    res.cookie(ADMIN_COOKIE, t, { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    adminSessions.delete(req.cookies[ADMIN_COOKIE]);
    res.clearCookie(ADMIN_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) =>
    res.json({ authed: Boolean(req.cookies[ADMIN_COOKIE] && adminSessions.has(req.cookies[ADMIN_COOKIE])) }));

  app.get('/auth/auto', (req, res) => {
    if (autologinToken && req.query.token === autologinToken) {
      const t = genToken();
      adminSessions.add(t);
      res.cookie(ADMIN_COOKIE, t, { httpOnly: true, sameSite: 'lax' });
    }
    res.redirect('/');
  });

  // ================= SOURCES =================

  function serializeSource(s) {
    const creds = (() => { try { return JSON.parse(s.credentials_json); } catch { return {}; } })();
    return {
      ...s,
      credentials_json: undefined,
      has_credentials: Boolean(creds.api_key || creds.access_token),
      review_count: db.prepare('SELECT COUNT(*) n FROM reviews WHERE source_id = ?').get(s.id).n
    };
  }

  app.get('/api/sources', requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM sources ORDER BY created_at ASC').all().map(serializeSource));
  });

  app.post('/api/sources', requireAdmin, (req, res) => {
    const b = req.body || {};
    const type = ['google', 'facebook', 'manual'].includes(b.type) ? b.type : 'manual';
    const name = String(b.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'name is required' });
    const creds = {};
    if (b.api_key) creds.api_key = String(b.api_key).slice(0, 300);
    if (b.access_token) creds.access_token = String(b.access_token).slice(0, 500);
    const info = db.prepare(
      'INSERT INTO sources (type, name, external_id, credentials_json, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(type, name, String(b.external_id || '').slice(0, 200), JSON.stringify(creds), Date.now());
    res.status(201).json(serializeSource(db.prepare('SELECT * FROM sources WHERE id = ?').get(info.lastInsertRowid)));
  });

  app.put('/api/sources/:id', requireAdmin, (req, res) => {
    const s = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    const creds = (() => { try { return JSON.parse(s.credentials_json); } catch { return {}; } })();
    if (b.api_key) creds.api_key = String(b.api_key).slice(0, 300);
    if (b.access_token) creds.access_token = String(b.access_token).slice(0, 500);
    db.prepare('UPDATE sources SET name = ?, external_id = ?, credentials_json = ? WHERE id = ?')
      .run(String(b.name ?? s.name).trim().slice(0, 120) || s.name,
           String(b.external_id ?? s.external_id).slice(0, 200), JSON.stringify(creds), s.id);
    res.json(serializeSource(db.prepare('SELECT * FROM sources WHERE id = ?').get(s.id)));
  });

  app.delete('/api/sources/:id', requireAdmin, (req, res) => {
    db.transaction(() => {
      db.prepare('DELETE FROM reviews WHERE source_id = ?').run(req.params.id);
      db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
    })();
    res.json({ ok: true });
  });

  app.post('/api/sources/:id/sync', requireAdmin, async (req, res) => {
    const s = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    try {
      const result = await syncSource(db, s);
      res.json({ ok: true, ...result });
    } catch (e) {
      db.prepare('UPDATE sources SET last_sync_error = ? WHERE id = ?').run(String(e.message).slice(0, 300), s.id);
      res.status(400).json({ error: e.message });
    }
  });

  // CSV import into a source. Body: { csv: "author,rating,text,date\n..." }
  // Header row optional; columns: author, rating, text, review_date.
  app.post('/api/sources/:id/import', requireAdmin, (req, res) => {
    const s = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const csv = String((req.body || {}).csv || '');
    if (!csv.trim()) return res.status(400).json({ error: 'csv body is required' });
    let rows = parseCsv(csv);
    if (rows.length && /author/i.test(rows[0][0] || '')) rows = rows.slice(1); // skip header
    const reviews = [];
    for (const r of rows) {
      const rating = Math.round(Number(r[1]));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
      reviews.push({
        external_id: '', // manual imports are not deduped by external id
        author: String(r[0] || 'Anonymous').slice(0, 120),
        rating,
        text: String(r[2] || '').slice(0, 4000),
        review_date: String(r[3] || '').slice(0, 10)
      });
    }
    const added = upsertReviews(db, s.id, reviews);
    res.json({ ok: true, imported: added, skipped: rows.length - added });
  });

  // ================= REVIEWS (moderation) =================

  app.get('/api/reviews', requireAdmin, (req, res) => {
    const filter = String(req.query.filter || 'all');
    const where = filter === 'pending' ? 'WHERE r.approved = 0'
      : filter === 'approved' ? 'WHERE r.approved = 1'
      : filter === 'featured' ? 'WHERE r.featured = 1' : '';
    res.json(db.prepare(`
      SELECT r.*, s.name AS source_name, s.type AS source_type
      FROM reviews r JOIN sources s ON s.id = r.source_id ${where}
      ORDER BY r.created_at DESC LIMIT 500
    `).all());
  });

  app.post('/api/reviews', requireAdmin, (req, res) => {
    const b = req.body || {};
    const s = db.prepare('SELECT * FROM sources WHERE id = ?').get(b.source_id);
    if (!s) return res.status(404).json({ error: 'source not found' });
    const rating = Math.round(Number(b.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });
    const info = db.prepare(`
      INSERT INTO reviews (source_id, external_id, author, rating, text, review_date, approved, featured, created_at)
      VALUES (?, '', ?, ?, ?, ?, 1, 0, ?)
    `).run(s.id, String(b.author || 'Anonymous').slice(0, 120), rating,
           String(b.text || '').slice(0, 4000), String(b.review_date || '').slice(0, 10), Date.now());
    res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid));
  });

  app.post('/api/reviews/:id/moderate', requireAdmin, (req, res) => {
    const r = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    const approved = b.approved !== undefined ? (b.approved ? 1 : 0) : r.approved;
    const featured = b.featured !== undefined ? (b.featured ? 1 : 0) : r.featured;
    db.prepare('UPDATE reviews SET approved = ?, featured = ? WHERE id = ?').run(approved, featured, r.id);
    res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(r.id));
  });

  app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= WIDGET CONFIG =================

  app.get('/api/widget-config', requireAdmin, (req, res) => res.json(getWidgetConfig(db)));
  app.put('/api/widget-config', requireAdmin, (req, res) => res.json(setWidgetConfig(db, req.body || {})));

  // ================= SPA =================

  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/widget.js' || req.path === '/badge.json') return next();
      res.set('Cache-Control', 'no-store');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
