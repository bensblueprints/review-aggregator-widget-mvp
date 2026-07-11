// The embeddable review widget, served at GET /widget.js. Dependency-free
// vanilla JS rendered inside a shadow root so host page styles never leak in.
// Review text and author names are ALWAYS rendered as text nodes — never
// innerHTML with user/remote content. That is the whole XSS story.
//
// Usage: <script defer src="https://your-starstack-host/widget.js"></script>
// Optional attributes: data-layout, data-theme, data-accent, data-min-rating,
// data-source (filter to one source name) — all override the saved config.
module.exports = String.raw`(function () {
  'use strict';
  if (window.__starstackLoaded) return;
  window.__starstackLoaded = true;

  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src*="widget.js"]');
    return s[s.length - 1];
  })();
  if (!script) return;
  var origin;
  try { origin = new URL(script.getAttribute('src') || '', location.href).origin; } catch (e) { return; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function stars(container, rating, accent) {
    for (var i = 1; i <= 5; i++) {
      var s = el('span', 'ss-star', i <= rating ? '★' : '☆');
      if (i <= rating) s.style.color = accent;
      container.appendChild(s);
    }
  }

  function boot() {
    var host = document.getElementById('starstack');
    if (!host) {
      host = document.createElement('div');
      host.id = 'starstack';
      (script.parentNode || document.body).insertBefore(host, script.nextSibling);
    }
    var root = host.attachShadow({ mode: 'open' });

    var xhr = new XMLHttpRequest();
    var qs = [];
    if (script.getAttribute('data-min-rating')) qs.push('min_rating=' + encodeURIComponent(script.getAttribute('data-min-rating')));
    if (script.getAttribute('data-source')) qs.push('source=' + encodeURIComponent(script.getAttribute('data-source')));
    xhr.open('GET', origin + '/api/widget/reviews' + (qs.length ? '?' + qs.join('&') : ''), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status !== 200 || !data) return;
      render(root, data);
    };
    xhr.send();
  }

  function render(root, data) {
    var cfg = data.config || {};
    var layout = script.getAttribute('data-layout') || cfg.layout || 'grid';
    var themeAttr = script.getAttribute('data-theme') || cfg.theme || 'light';
    var accent = script.getAttribute('data-accent') || cfg.accent || '#f59e0b';
    var font = cfg.font || '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
    var dark = themeAttr === 'dark' || (themeAttr === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var bg = dark ? '#17171c' : '#ffffff';
    var fg = dark ? '#e7e7ee' : '#1a1a1f';
    var sub = dark ? '#8b8b98' : '#6b6b76';
    var border = dark ? '#2b2b33' : '#e4e4e7';

    var style = document.createElement('style');
    style.textContent =
      ':host{all:initial}' +
      '.ss-root{font-family:' + font + ';color:' + fg + ';max-width:100%}' +
      '.ss-root *{box-sizing:border-box}' +
      '.ss-badge{display:flex;align-items:center;gap:10px;margin-bottom:16px}' +
      '.ss-badge-num{font-size:28px;font-weight:800}' +
      '.ss-badge-sub{font-size:12.5px;color:' + sub + '}' +
      '.ss-star{font-size:15px;color:' + border + '}' +
      '.ss-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}' +
      '.ss-carousel{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}' +
      '.ss-carousel .ss-card{min-width:270px;scroll-snap-align:start}' +
      '.ss-card{background:' + bg + ';border:1px solid ' + border + ';border-radius:14px;padding:14px}' +
      '.ss-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.ss-author{font-weight:700;font-size:13.5px}' +
      '.ss-text{font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin:6px 0 8px}' +
      '.ss-meta{font-size:11px;color:' + sub + ';display:flex;justify-content:space-between}' +
      '.ss-feat{border-color:' + accent + '}' +
      '.ss-brand{display:block;text-align:right;color:' + sub + ';font-size:10px;margin-top:8px;text-decoration:none}';
    root.appendChild(style);

    var wrap = el('div', 'ss-root');
    root.appendChild(wrap);

    if (cfg.show_badge && data.aggregate && data.aggregate.count > 0) {
      var badge = el('div', 'ss-badge');
      badge.appendChild(el('span', 'ss-badge-num', data.aggregate.average.toFixed(1)));
      var bstars = el('span');
      stars(bstars, Math.round(data.aggregate.average), accent);
      badge.appendChild(bstars);
      var label = (cfg.business_name ? cfg.business_name + ' — ' : '') + data.aggregate.count + ' reviews';
      badge.appendChild(el('span', 'ss-badge-sub', label));
      wrap.appendChild(badge);
    }

    var list = el('div', layout === 'carousel' ? 'ss-carousel' : 'ss-grid');
    (data.reviews || []).forEach(function (r) {
      var card = el('div', 'ss-card' + (r.featured ? ' ss-feat' : ''));
      var head = el('div', 'ss-card-head');
      head.appendChild(el('span', 'ss-author', r.author || 'Anonymous'));
      var st = el('span');
      stars(st, r.rating, accent);
      head.appendChild(st);
      card.appendChild(head);
      if (r.text) card.appendChild(el('div', 'ss-text', r.text));
      var meta = el('div', 'ss-meta');
      meta.appendChild(el('span', '', r.review_date || ''));
      if (cfg.show_source) meta.appendChild(el('span', '', r.source_name || ''));
      card.appendChild(meta);
      list.appendChild(card);
    });
    wrap.appendChild(list);

    var brand = document.createElement('a');
    brand.className = 'ss-brand';
    brand.href = 'https://github.com/bensblueprints';
    brand.target = '_blank';
    brand.rel = 'noopener';
    brand.textContent = 'Reviews by Star Stack';
    wrap.appendChild(brand);
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();`;
