---
name: helives-design
description: >
  He Lives library design bar: night and gold tokens, Cormorant and Source Serif,
  calm reading pages, focus bold, themes, phone-first layout, no motion. Use when
  changing helives.dev pages, CSS, reading settings, brand, favicon or og image.
---

# He Lives Design

Read `DESIGN.md` at the repo root first. It holds the real values. This skill is the bar a change must meet.

## Before you edit
- Tokens live only in the `:root` and `[data-theme]` blocks at the top of `site/assets/site.css`.
- Page markup comes from `site/lib/layout.mjs` and `site/lib/pages.mjs`. Reading HTML comes from `site/lib/render.mjs`.
- Reading settings: defaults in `site/assets/prefs.js`, controls in `site/lib/layout.mjs`, behavior in `site/assets/app.js`.
- Never edit `dist/`. Run `pnpm build`.

## The bar for reading pages
- The text is the product. Nothing on a reading page competes with it: no badges, tiles, cards or decorative icons.
- Design for 390px first. The phone dock keeps Back, Listen, Reading, Sound and Next in thumb reach.
- Every control is at least 44px tall and has a visible label or an `aria-label`.
- Focus shows a 3px `--focus` outline. Never remove an outline without a replacement.
- The page reads fully without JavaScript.
- Every theme (Night, Dusk, Paper, Sepia, High contrast) keeps text and links at WCAG AA on `--bg`.
- Dusk stays low contrast with no pure black or white. Do not "fix" it toward Night.
- Focus bold stays a build-time `<b>` prefix. Change its weight only through `data-fx` and `--fx-weight`.
- No motion: no `transition`, `animation` or `@keyframes`. Highlights are a still `--mark` band.
- Background sound stays generated in `site/assets/sounds.js`. No audio files, no sudden loud events.
- Print pages hide all chrome and print black on white.
- Gnostic and other non-canonical texts carry their label on the collection and reader pages.

## Rules
- Use `var(--...)` for every color. No raw hex outside the token blocks.
- Display face is Cormorant Garamond, text is Source Serif 4, controls are system-ui. Fonts are self-hosted; no font CDN.
- One gold accent. No second palette for a section.
- Change the mark only in `brandMark()` (`site/lib/icons.mjs`) and `public/favicon.svg`, then run `node scripts/render-brand.mjs`.
- Copy is plain and short. No slogans.

## Do not
- Card grids, stat strips, pill clusters or feature icon rows.
- Inter, Roboto or system-ui as the reading face.
- Purple gradients, glass panels, stock crosses or doves.
- Empty shelves or "coming soon" entries.

## Done
Done means all of these passed, not that the page looks right to you:
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` exits 0.
- `node scripts/check-ui.mjs http://localhost:8841` against `pnpm exec wrangler dev --port 8841` exits 0.
- `node scripts/shots.mjs` at 390 and 1280, light and `SCHEME=dark`, reports no console errors and no sideways scroll.
- An independent critic passes the screenshots (`helives-gauntlet`). You do not approve your own UI.
