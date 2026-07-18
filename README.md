# ⭐ Star Stack — the review widget you own forever

## Demo

VIDEO-PLACEHOLDER

![MIT License](https://img.shields.io/badge/license-MIT-green.svg)

Aggregate your Google, Facebook, and manually-imported reviews into one embeddable, themeable widget for your site — with moderation, featured pins, and an aggregate star badge. Self-hosted: one Node process, one SQLite file.

**Pay once. Own it forever. No subscription.** Trustpilot Business is $199+/mo. Elfsight/EmbedSocial review widgets are $5–$20/mo forever. Star Stack is **$29 once**.

![Screenshot](docs/screenshot.png)

## Features

- **Sources** — Google Business Profile (your own Places API key), Facebook Page reviews (your own Graph token), and manual/CSV import for everything else
- **BYO API keys** — you plug in your own free-tier Google/Facebook credentials, so there's no proxy service to bill you monthly
- **Moderation first** — synced and imported reviews arrive hidden; approve, hide, feature/pin from the dashboard. Nothing goes public without your click.
- **Embeddable widget** — one `<script>` tag, shadow-DOM isolated (host CSS can't break it, and it can't break the host), grid or carousel, light/dark/auto theme, custom accent color
- **XSS-safe by construction** — review text renders as text nodes only; the widget never assigns `innerHTML`
- **Aggregate star badge** — average + count in the widget header, plus `/badge.json` for custom integrations
- **Filters** — min rating and per-source, in the saved config or per-page via `data-` attributes
- **Auto-refresh** — scheduled re-pull of Google/FB sources (default every 6h) so the widget stays current

## Quick start

```bash
npm i
npm run build   # build the admin dashboard
npm start       # http://localhost:5351  (admin password: "admin" until you set one)
```

Embed on any site:

```html
<script defer src="https://your-starstack-host/widget.js"></script>
<div id="starstack"></div>
```

**Desktop mode:** `npm run desktop` — same app as a Windows desktop app, auto-logged-in. Run it as a desktop app, or deploy to a $5 VPS when you need it public.

**Docker:** `docker compose up -d`.

## Getting your reviews in

| Source | How |
|---|---|
| Google | Add source → paste your Place ID + Places API key → Sync. (Google's API returns up to 5 reviews per pull; bulk-import the back-catalog via CSV.) |
| Facebook | Add source → Page ID + page access token → Sync |
| Everything else (Trustpilot, Yelp, email praise…) | CSV import: `author, rating, text, date` |

## vs Trustpilot Business

| | Star Stack | Trustpilot Business |
|---|---|---|
| Price | **$29 once** | $199+/mo ($2,388+/yr) |
| Show your existing reviews on your site | ✅ | ✅ |
| Your data, your server | ✅ | Their platform |
| Moderation/curation | ✅ full control | Limited |
| Review invitations, TrustBoxes, SEO snippets network | ❌ | ✅ |
| Widget branding | Yours | Theirs |

Trustpilot sells a review *platform*. If you just need the five stars you already earned displayed on your homepage — that's Star Stack.

## ☕ Skip the setup — get the 1-click installer

Source is MIT, forever. Prefer a packaged Windows installer with updates? **[Get Star Stack on Whop →](https://whop.com/benjisaiempire/starstack)**

## Tech stack

Node 20+ · Express · better-sqlite3 · React 18 · Vite · Tailwind 4 · Framer Motion · Lucide · vanilla-JS shadow-DOM widget · Electron (desktop mode)

## License

MIT © 2026 Ben (bensblueprints)

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
