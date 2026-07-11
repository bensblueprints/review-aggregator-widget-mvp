async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: { password } }),
  logout: () => req('/api/logout', { method: 'POST' }),
  sources: () => req('/api/sources'),
  createSource: (body) => req('/api/sources', { method: 'POST', body }),
  updateSource: (id, body) => req(`/api/sources/${id}`, { method: 'PUT', body }),
  deleteSource: (id) => req(`/api/sources/${id}`, { method: 'DELETE' }),
  syncSource: (id) => req(`/api/sources/${id}/sync`, { method: 'POST' }),
  importCsv: (id, csv) => req(`/api/sources/${id}/import`, { method: 'POST', body: { csv } }),
  reviews: (filter = 'all') => req(`/api/reviews?filter=${filter}`),
  createReview: (body) => req('/api/reviews', { method: 'POST', body }),
  moderate: (id, body) => req(`/api/reviews/${id}/moderate`, { method: 'POST', body }),
  deleteReview: (id) => req(`/api/reviews/${id}`, { method: 'DELETE' }),
  widgetConfig: () => req('/api/widget-config'),
  saveWidgetConfig: (body) => req('/api/widget-config', { method: 'PUT', body })
};

export function timeAgo(ms) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
