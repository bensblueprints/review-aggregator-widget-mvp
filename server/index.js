require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5351;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'starstack.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const AUTO_SYNC_HOURS = Number(process.env.AUTO_SYNC_HOURS ?? 6);

const app = createApp({
  dbPath: DB_PATH,
  adminPassword: ADMIN_PASSWORD,
  autoSyncMs: AUTO_SYNC_HOURS > 0 ? AUTO_SYNC_HOURS * 3600 * 1000 : 0
});

app.listen(PORT, () => {
  console.log(`Star Stack listening on http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'admin') {
    console.log('⚠ Using default admin password — set ADMIN_PASSWORD in .env for production.');
  }
});
