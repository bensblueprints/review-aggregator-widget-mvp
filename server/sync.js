// Review sync from Google Places / Facebook Graph, using the USER'S OWN keys
// (BYO keys keeps Star Stack a one-time tool, not a recurring-cost proxy).
// Both APIs cap the reviews they return (Google: 5 most relevant) — CSV/manual
// import covers the rest.

async function syncGoogle(source) {
  const creds = JSON.parse(source.credentials_json || '{}');
  if (!creds.api_key || !source.external_id) throw new Error('Google source needs api_key + place_id');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(source.external_id)}&fields=name,rating,reviews&reviews_no_translations=true&key=${encodeURIComponent(creds.api_key)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK') throw new Error(`Google Places: ${json.status} ${json.error_message || ''}`.trim());
  return (json.result.reviews || []).map((r) => ({
    external_id: `g:${r.time}:${(r.author_name || '').slice(0, 40)}`,
    author: String(r.author_name || 'Google user').slice(0, 120),
    rating: Math.min(Math.max(Math.round(r.rating) || 5, 1), 5),
    text: String(r.text || '').slice(0, 4000),
    review_date: r.time ? new Date(r.time * 1000).toISOString().slice(0, 10) : ''
  }));
}

async function syncFacebook(source) {
  const creds = JSON.parse(source.credentials_json || '{}');
  if (!creds.access_token || !source.external_id) throw new Error('Facebook source needs access_token + page id');
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(source.external_id)}/ratings?fields=reviewer{name},rating,review_text,created_time&limit=100&access_token=${encodeURIComponent(creds.access_token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`Facebook Graph: ${json.error.message}`);
  return (json.data || []).map((r) => ({
    external_id: `f:${r.created_time}:${(r.reviewer?.name || '').slice(0, 40)}`,
    author: String(r.reviewer?.name || 'Facebook user').slice(0, 120),
    rating: Math.min(Math.max(Math.round(r.rating) || 5, 1), 5),
    text: String(r.review_text || '').slice(0, 4000),
    review_date: r.created_time ? String(r.created_time).slice(0, 10) : ''
  }));
}

// Inserts fetched reviews; synced reviews arrive UNAPPROVED so you moderate first.
function upsertReviews(db, sourceId, reviews) {
  const stmt = db.prepare(`
    INSERT INTO reviews (source_id, external_id, author, rating, text, review_date, approved, featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
    ON CONFLICT(source_id, external_id) WHERE external_id != '' DO NOTHING
  `);
  let added = 0;
  const tx = db.transaction(() => {
    for (const r of reviews) {
      const info = stmt.run(sourceId, r.external_id, r.author, r.rating, r.text, r.review_date, Date.now());
      added += info.changes;
    }
  });
  tx();
  return added;
}

async function syncSource(db, source) {
  let fetched;
  if (source.type === 'google') fetched = await syncGoogle(source);
  else if (source.type === 'facebook') fetched = await syncFacebook(source);
  else return { added: 0, fetched: 0 }; // manual sources don't sync
  const added = upsertReviews(db, source.id, fetched);
  db.prepare('UPDATE sources SET last_synced_at = ?, last_sync_error = NULL WHERE id = ?').run(Date.now(), source.id);
  return { added, fetched: fetched.length };
}

// Auto-refresh: periodically re-pull every google/facebook source.
function startAutoSync(db, intervalMs) {
  if (!intervalMs || intervalMs <= 0) return () => {};
  const timer = setInterval(async () => {
    const sources = db.prepare("SELECT * FROM sources WHERE type IN ('google','facebook')").all();
    for (const s of sources) {
      try { await syncSource(db, s); }
      catch (e) {
        db.prepare('UPDATE sources SET last_sync_error = ? WHERE id = ?').run(String(e.message).slice(0, 300), s.id);
      }
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

// Tiny CSV parser (handles quoted fields with commas/newlines/escaped quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

module.exports = { syncSource, upsertReviews, startAutoSync, parseCsv };
