const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

function genToken(len = 24) {
  return crypto.randomBytes(len).toString('hex');
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,                 -- 'google' | 'facebook' | 'manual'
      name TEXT NOT NULL,
      external_id TEXT DEFAULT '',        -- Google place_id / FB page id
      credentials_json TEXT DEFAULT '{}', -- user's own API key / token
      last_synced_at INTEGER,
      last_sync_error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      external_id TEXT DEFAULT '',        -- for de-duping synced reviews
      author TEXT NOT NULL DEFAULT 'Anonymous',
      rating INTEGER NOT NULL,            -- 1..5
      text TEXT NOT NULL DEFAULT '',
      review_date TEXT DEFAULT '',        -- ISO date string
      approved INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_dedupe ON reviews(source_id, external_id)
      WHERE external_id != '';
    CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved, featured);
  `);

  return db;
}

const DEFAULT_WIDGET_CONFIG = {
  layout: 'grid',            // 'grid' | 'carousel'
  theme: 'light',            // 'light' | 'dark' | 'auto'
  accent: '#f59e0b',
  font: '',
  max_reviews: 12,
  min_rating: 1,
  show_source: true,
  show_badge: true,
  business_name: ''
};

function getWidgetConfig(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'widget_config'").get();
  if (!row) return { ...DEFAULT_WIDGET_CONFIG };
  try { return { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(row.value) }; }
  catch { return { ...DEFAULT_WIDGET_CONFIG }; }
}

function setWidgetConfig(db, cfg) {
  const clean = {};
  for (const k of Object.keys(DEFAULT_WIDGET_CONFIG)) {
    if (cfg[k] !== undefined) clean[k] = cfg[k];
  }
  const merged = { ...getWidgetConfig(db), ...clean };
  merged.max_reviews = Math.min(Math.max(Number(merged.max_reviews) || 12, 1), 100);
  merged.min_rating = Math.min(Math.max(Number(merged.min_rating) || 1, 1), 5);
  merged.layout = merged.layout === 'carousel' ? 'carousel' : 'grid';
  merged.theme = ['dark', 'auto'].includes(merged.theme) ? merged.theme : 'light';
  db.prepare("INSERT INTO settings (key, value) VALUES ('widget_config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(merged));
  return merged;
}

module.exports = { openDb, genToken, getWidgetConfig, setWidgetConfig, DEFAULT_WIDGET_CONFIG };
