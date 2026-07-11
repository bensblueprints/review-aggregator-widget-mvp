import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Database, MessageSquareQuote, Paintbrush, LogOut, Plus, Trash2, Copy, Check,
  RefreshCw, X, Upload, Eye, EyeOff, Pin, PinOff, Code2
} from 'lucide-react';
import { api, timeAgo } from './api.js';

const card = 'bg-zinc-900/70 border border-zinc-800 rounded-2xl';
const input = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500';
const btn = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors';
const btnPrimary = `${btn} bg-amber-600 hover:bg-amber-500 text-white`;
const btnGhost = `${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200`;

function Stars({ n }) {
  return <span className="text-amber-400 text-sm">{'★'.repeat(n)}<span className="text-zinc-700">{'★'.repeat(5 - n)}</span></span>;
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="text-zinc-400 hover:text-amber-400 p-1" title="Copy"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); })}>
      {ok ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${card} p-8 w-full max-w-sm`}
        onSubmit={async (e) => {
          e.preventDefault();
          try { await api.login(pw); onDone(); } catch { setErr('Wrong password'); }
        }}>
        <div className="flex items-center gap-2 mb-1 text-amber-400"><Star /><span className="text-xl font-black text-white">Star Stack</span></div>
        <p className="text-zinc-500 text-sm mb-6">All your reviews, one widget. Sign in.</p>
        <input className={input} type="password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center mt-4`}>Sign in</button>
      </motion.form>
    </div>
  );
}

function SourceModal({ onClose, onSaved }) {
  const [f, setF] = useState({ type: 'manual', name: '', external_id: '', api_key: '', access_token: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${card} p-6 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">New source</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <select className={input} value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="manual">Manual / CSV import</option>
            <option value="google">Google Business Profile (your Places API key)</option>
            <option value="facebook">Facebook Page (your Graph token)</option>
          </select>
          <input className={input} placeholder="Source name (shown in widget, e.g. Google)" value={f.name} onChange={(e) => set('name', e.target.value)} />
          {f.type === 'google' && <>
            <input className={input} placeholder="Place ID" value={f.external_id} onChange={(e) => set('external_id', e.target.value)} />
            <input className={input} placeholder="Google Places API key" value={f.api_key} onChange={(e) => set('api_key', e.target.value)} />
            <p className="text-[11px] text-zinc-500">Your own key, billed to your own Google Cloud account (free tier covers this easily). Google returns up to 5 reviews per pull — use CSV import for the back-catalog.</p>
          </>}
          {f.type === 'facebook' && <>
            <input className={input} placeholder="Facebook Page ID" value={f.external_id} onChange={(e) => set('external_id', e.target.value)} />
            <input className={input} placeholder="Page access token" value={f.access_token} onChange={(e) => set('access_token', e.target.value)} />
          </>}
        </div>
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center mt-5`} onClick={async () => {
          try { onSaved(await api.createSource(f)); } catch (e) { setErr(e.message); }
        }}>Create source</button>
      </motion.div>
    </div>
  );
}

function ImportModal({ source, onClose, onDone }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${card} p-6 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Import CSV → {source.name}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-3">Columns: <span className="font-mono">author, rating (1-5), text, date (YYYY-MM-DD)</span>. Header row optional. Paste below or choose a file.</p>
        <textarea className={`${input} h-40 font-mono text-xs`} placeholder={'author,rating,text,date\n"Jane D",5,"Great service!",2026-01-15'} value={csv} onChange={(e) => setCsv(e.target.value)} />
        <label className={`${btnGhost} cursor-pointer mt-2`}>
          <Upload size={14} />Choose CSV file
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
            const file = e.target.files[0];
            if (file) file.text().then(setCsv);
          }} />
        </label>
        {result && <p className="text-emerald-400 text-xs mt-2">Imported {result.imported} reviews ({result.skipped} skipped). They're pending moderation.</p>}
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center mt-4`} onClick={async () => {
          setErr('');
          try { setResult(await api.importCsv(source.id, csv)); onDone(); } catch (e) { setErr(e.message); }
        }}>Import</button>
      </motion.div>
    </div>
  );
}

function Sources() {
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(false);
  const [importing, setImporting] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api.sources().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const icons = { google: '🌐', facebook: '📘', manual: '📄' };
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Review sources</h2>
        <button className={btnPrimary} onClick={() => setModal(true)}><Plus size={16} />Add source</button>
      </div>
      {msg && <p className="text-xs text-emerald-400 mb-2">{msg}</p>}
      <div className="grid gap-3">
        {rows?.length === 0 && <div className={`${card} p-8 text-center text-zinc-500`}>No sources yet. Add Google, Facebook, or a manual source and import your reviews.</div>}
        {rows?.map((s) => (
          <div key={s.id} className={`${card} p-4 flex flex-wrap items-center gap-3`}>
            <div className="text-2xl">{icons[s.type]}</div>
            <div className="flex-1 min-w-40">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-zinc-500">{s.type}{s.external_id ? ` · ${s.external_id}` : ''} · {s.review_count} reviews
                {s.type !== 'manual' && <> · synced {timeAgo(s.last_synced_at)}</>}</div>
              {s.last_sync_error && <div className="text-xs text-red-400 mt-1">{s.last_sync_error}</div>}
            </div>
            {s.type !== 'manual' && (
              <button className={btnGhost} disabled={syncing === s.id} onClick={async () => {
                setSyncing(s.id); setMsg('');
                try { const r = await api.syncSource(s.id); setMsg(`Synced ${s.name}: ${r.added} new of ${r.fetched} fetched.`); }
                catch (e) { setMsg(''); }
                setSyncing(null); load();
              }}><RefreshCw size={14} className={syncing === s.id ? 'animate-spin' : ''} />Sync now</button>
            )}
            <button className={btnGhost} onClick={() => setImporting(s)}><Upload size={14} />Import CSV</button>
            <button className="p-2 text-zinc-400 hover:text-red-400" onClick={async () => {
              if (confirm(`Delete ${s.name} and its reviews?`)) { await api.deleteSource(s.id); load(); }
            }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {modal && <SourceModal onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
        {importing && <ImportModal source={importing} onClose={() => setImporting(null)} onDone={load} />}
      </AnimatePresence>
    </div>
  );
}

function Reviews() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [adding, setAdding] = useState(false);
  const [sources, setSources] = useState([]);
  const [f, setF] = useState({ source_id: '', author: '', rating: 5, text: '', review_date: '' });
  const load = () => api.reviews(filter).then(setRows).catch(() => {});
  useEffect(() => { load(); }, [filter]);
  useEffect(() => { api.sources().then(setSources).catch(() => {}); }, []);
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="font-bold text-lg">Moderation</h2>
        <div className="flex gap-2">
          <select className={`${input} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pending</option><option value="approved">Live</option>
            <option value="featured">Featured</option><option value="all">All</option>
          </select>
          <button className={btnPrimary} onClick={() => setAdding(!adding)}><Plus size={16} />Add review</button>
        </div>
      </div>
      {adding && (
        <div className={`${card} p-4 mb-4 grid gap-2`}>
          <div className="flex gap-2">
            <select className={input} value={f.source_id} onChange={(e) => setF({ ...f, source_id: e.target.value })}>
              <option value="">Source…</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={input} placeholder="Author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
            <select className={input} value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
            <input className={input} type="date" value={f.review_date} onChange={(e) => setF({ ...f, review_date: e.target.value })} />
          </div>
          <textarea className={`${input} h-20`} placeholder="Review text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          <button className={`${btnPrimary} w-fit`} onClick={async () => {
            if (!f.source_id) return;
            await api.createReview({ ...f, source_id: Number(f.source_id) });
            setF({ ...f, author: '', text: '' }); setAdding(false); load();
          }}>Save (goes live immediately)</button>
        </div>
      )}
      <div className="grid gap-2">
        {rows?.length === 0 && <div className={`${card} p-8 text-center text-zinc-500`}>Nothing here.</div>}
        {rows?.map((r) => (
          <motion.div layout key={r.id} className={`${card} p-4 ${r.featured ? 'border-amber-500/50' : ''}`}>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-semibold text-sm">{r.author}</span>
              <Stars n={r.rating} />
              <span className="text-xs text-zinc-500">{r.source_name} · {r.review_date || timeAgo(r.created_at)}</span>
              {!r.approved && <span className="text-[10px] bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5 font-bold">PENDING</span>}
              {Boolean(r.featured) && <span className="text-[10px] bg-amber-500/25 text-amber-300 rounded px-1.5 py-0.5 font-bold">FEATURED</span>}
              <div className="flex-1" />
              <button className="p-1.5 text-zinc-400 hover:text-emerald-400" title={r.approved ? 'Hide' : 'Approve'}
                onClick={async () => { await api.moderate(r.id, { approved: !r.approved }); load(); }}>
                {r.approved ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button className="p-1.5 text-zinc-400 hover:text-amber-400" title={r.featured ? 'Unpin' : 'Feature/pin'}
                onClick={async () => { await api.moderate(r.id, { featured: !r.featured, approved: true }); load(); }}>
                {r.featured ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
              <button className="p-1.5 text-zinc-400 hover:text-red-400" title="Delete"
                onClick={async () => { await api.deleteReview(r.id); load(); }}><Trash2 size={15} /></button>
            </div>
            {r.text && <p className="text-sm text-zinc-300 whitespace-pre-wrap">{r.text}</p>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Widget() {
  const [cfg, setCfg] = useState(null);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => { api.widgetConfig().then(setCfg).catch(() => {}); }, []);
  if (!cfg) return null;
  const base = window.location.origin;
  const snippet = `<script defer src="${base}/widget.js"></script>\n<div id="starstack"></div>`;
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Paintbrush size={18} className="text-amber-400" />Theme & layout</h2>
        <div className={`${card} p-5 space-y-4`}>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">Layout</label>
              <select className={input} value={cfg.layout} onChange={(e) => set('layout', e.target.value)}>
                <option value="grid">Grid</option><option value="carousel">Carousel</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">Theme</label>
              <select className={input} value={cfg.theme} onChange={(e) => set('theme', e.target.value)}>
                <option value="light">Light</option><option value="dark">Dark</option><option value="auto">Auto</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Accent</label>
              <input type="color" className="w-12 h-9 bg-transparent border border-zinc-700 rounded-lg" value={cfg.accent} onChange={(e) => set('accent', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">Business name (badge)</label>
              <input className={input} value={cfg.business_name} onChange={(e) => set('business_name', e.target.value)} />
            </div>
            <div className="w-24">
              <label className="text-xs text-zinc-500 block mb-1">Max reviews</label>
              <input className={input} type="number" min="1" max="100" value={cfg.max_reviews} onChange={(e) => set('max_reviews', Number(e.target.value))} />
            </div>
            <div className="w-24">
              <label className="text-xs text-zinc-500 block mb-1">Min rating</label>
              <select className={input} value={cfg.min_rating} onChange={(e) => set('min_rating', Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★+</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.show_badge} onChange={(e) => set('show_badge', e.target.checked)} />Aggregate badge</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.show_source} onChange={(e) => set('show_source', e.target.checked)} />Show source</label>
          </div>
          <button className={btnPrimary} onClick={async () => {
            const r = await api.saveWidgetConfig(cfg); setCfg(r); setSaved(true); setPreviewKey((k) => k + 1);
            setTimeout(() => setSaved(false), 1500);
          }}>{saved ? <Check size={15} /> : null}{saved ? 'Saved' : 'Save widget'}</button>
        </div>
        <div className={`${card} p-5 mt-4`}>
          <div className="flex items-center gap-2 mb-2 text-sm font-bold"><Code2 size={15} className="text-amber-400" />Embed snippet</div>
          <div className="bg-zinc-800 rounded-lg p-3 font-mono text-xs break-all flex items-start justify-between gap-2">
            <span className="whitespace-pre-wrap">{snippet}</span><CopyBtn text={snippet} />
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">Works on any site, any origin. Override per-page with <span className="font-mono">data-layout / data-theme / data-accent / data-min-rating / data-source</span> attributes.</p>
        </div>
      </div>
      <div>
        <h2 className="font-bold text-lg mb-4">Live preview</h2>
        <div className="bg-white rounded-2xl p-5 min-h-64">
          <iframe key={previewKey} title="widget preview" className="w-full min-h-96 border-0" srcDoc={`<body style="margin:0"><script defer src="${base}/widget.js"></scr` + `ipt><div id="starstack"></div></body>`} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('reviews');
  useEffect(() => { api.me().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false)); }, []);
  if (authed === null) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const tabs = [
    ['reviews', 'Reviews', MessageSquareQuote],
    ['sources', 'Sources', Database],
    ['widget', 'Widget', Paintbrush]
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/70 sticky top-0 bg-zinc-950/80 backdrop-blur z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2 text-amber-400"><Star size={20} /><span className="font-black text-white">Star Stack</span></div>
          <nav className="flex gap-1 flex-1">
            {tabs.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${tab === id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </nav>
          <button className="text-zinc-500 hover:text-white" title="Sign out" onClick={async () => { await api.logout(); setAuthed(false); }}><LogOut size={16} /></button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'reviews' && <Reviews />}
        {tab === 'sources' && <Sources />}
        {tab === 'widget' && <Widget />}
      </main>
    </div>
  );
}
