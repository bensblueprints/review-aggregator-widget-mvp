# Star Stack — Launch Strategy

## Target communities

- **r/smallbusiness** — angle: "how I put my Google reviews on my site without a $20/mo widget rental." Practical, screenshots, no link-drop (link on request in comments).
- **r/selfhosted** — angle: architecture post — shadow-DOM embed, text-node-only rendering, BYO API keys, SQLite. Emphasize MIT + docker compose.
- **r/webdev** — angle: "embeddable widgets without XSS: how Star Stack renders hostile review text safely." Teach, then mention.
- **r/Entrepreneur** — angle: pricing-math post ($29 once vs $2,388/yr) with honest "what Trustpilot does that this doesn't" section.
- **Indie Hackers** — build-in-public post: why BYO API keys is the whole business model.

## Hacker News — Show HN draft

**Title:** Show HN: Star Stack — self-hosted review widget (Google/FB/CSV → one embed, MIT)

Review-widget SaaS is a quote rectangle with a recurring bill. Star Stack aggregates reviews you already have — Google Business Profile via your own Places key, Facebook Pages via your own Graph token, CSV for the rest — into one embeddable script tag served from your own server.

Things HN may find interesting: the embed renders entirely in a shadow root and builds all DOM via createElement/textContent (hostile review text stays inert); moderation is default-deny (synced reviews arrive hidden); the whole thing is one Express process + one SQLite file. MIT source; I sell a packaged installer for convenience.

## SEO keywords (10)

1. trustpilot alternative free
2. google reviews widget embed
3. review aggregator widget self hosted
4. elfsight alternative
5. embedsocial alternative
6. facebook reviews widget website
7. review widget one time purchase
8. self hosted review widget open source
9. show google reviews on website free
10. review carousel widget no subscription

## AppSumo / PitchGround pitch

Star Stack turns the reviews a business already earned into on-site social proof — without the $199/mo Trustpilot tax. It aggregates Google, Facebook, and CSV-imported reviews into one shadow-DOM-isolated embeddable widget with moderation, featured pins, theming, and an aggregate star badge. Self-hosted on any $5 VPS or run as a Windows desktop app; customers bring their own free-tier API keys, so there are no per-seat or per-view costs — ever. A one-time license your buyers keep forever makes this a natural LTD winner.

## Price math

**$29 one-time** vs Trustpilot Business $199/mo → pays for itself in **5 days**. vs Elfsight ~$10/mo → **3 months**. Three years of Trustpilot Business = $7,164. Star Stack = $29.
