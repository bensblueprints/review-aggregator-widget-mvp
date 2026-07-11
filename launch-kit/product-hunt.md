# Product Hunt Launch — Star Stack

## Name
Star Stack

## Tagline (60 chars)
All your reviews in one widget you own. Pay once, no monthly.

## Description (260 chars)
Aggregate Google, Facebook & imported reviews into one embeddable widget: moderation, featured pins, star badge, grid/carousel, theming. Self-hosted (Node+SQLite), shadow-DOM isolated, XSS-safe. $29 once vs Trustpilot's $199/mo. BYO API keys. MIT source.

## Full description

You already earned the five-star reviews. Trustpilot wants $199/mo to show them on your homepage. Elfsight wants a subscription for a `<div>`.

Star Stack is the one-time version:

- **Pull reviews from Google** (your own Places API key) and **Facebook** (your own Graph token) — BYO keys means no middleman proxy to charge you monthly
- **CSV/manual import** for Trustpilot exports, Yelp, email praise, anything
- **Moderate before it's public** — approve, hide, feature/pin your best
- **One script tag** to embed: shadow-DOM isolated, grid or carousel, light/dark/auto, your accent color, aggregate star badge
- **XSS-safe by construction** — review text is rendered as text nodes; the widget never touches innerHTML
- **Auto-refresh** keeps the widget current without you thinking about it
- One Node process + SQLite. Docker compose for a $5 VPS, or run it as a Windows desktop app.

MIT source. $29 gets the 1-click installer.

## Maker first comment

Hey PH 👋

I got tired of paying $X/mo to display words my own customers wrote about my own business. Review-widget SaaS is a rectangle of quotes with a recurring bill attached.

Star Stack is deliberately narrow: it aggregates reviews you already have (Google + Facebook via your own free API keys, CSV for the rest), lets you moderate and pin, and serves one embeddable script tag from your own box.

Honest notes:
- It does NOT collect new reviews or send invitation emails — Trustpilot/Yotpo genuinely do more there. This is display, not acquisition.
- Google's API only returns 5 reviews per pull (their limit, not mine) — the CSV importer is how you load the back-catalog.
- The widget renders user text via text nodes only. I will happily talk about XSS in embeds at length if provoked.

## Gallery shots (5)

1. **Widget on a landing page** — grid of review cards + 4.8★ aggregate badge on a clean site. Caption: "Your reviews, your site, one script tag."
2. **Moderation queue** — pending imports with approve/feature buttons. Caption: "Nothing goes public without your click."
3. **Theme editor + live preview** — carousel layout, accent color picker. Caption: "Match your brand in 30 seconds."
4. **Sources screen** — Google/Facebook/CSV sources with sync status. Caption: "BYO API keys. No proxy, no monthly."
5. **Pricing math card** — "$29 once vs $2,388/yr Trustpilot Business." Caption: "You already earned the stars."
