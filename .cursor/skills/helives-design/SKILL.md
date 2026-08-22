---
name: helives-design
description: >
  He Lives overlay on gs-design: night/gold tokens, Cormorant, Scriptures index,
  no card-grid home. Use when changing helives.dev UI, brand, type, favicon, og,
  or later-book chrome.
---

# He Lives Design

Canonical design skill: **`~/.cursor/skills/gs-design/SKILL.md`**. Then **`DESIGN.md`** at the repo root. This overlay is the ministry-site delta, not a second token system.

Copy: `communication-writing` + `gs-content`. No slop.

## Brand first

Tokens in `src/index.css`. Mark in `src/site/BrandMark.tsx`. If the first viewport could be another ministry after removing the nav, branding is too weak.

- Void `#07060a`, fire `#e8b86d`, ink `#ece6d8`, dawn `#fff4d6`
- Display: Cormorant Garamond. Body: Source Serif 4
- Mark: Latin cross + dawn point of light. Same SVG as favicon

## Layout rules

- Home is one 100dvh lamp, not a card grid and not a scrollable document. Brand, this hour’s KJV (words of Christ in red), an authored one-line motif beside the verse (not Lucide), Explore more, new scripture every hour, footer. No page scroll. No clipped footer. Genesis is not the primary CTA. No church button on the lamp.
- `/scriptures` is a typographic canon index (`canon-division` / `canon-book`). Forthcoming books are named rows, not disabled cards.
- Docs (Faith, afterword) are a narrow reading column.
- Primary button is fire on ground. Quiet button is hairline. 44px min height.
- Focus: 2px fire outline, 3px offset. Never `outline: none` without a replacement.

## Do not

- Inter / system-ui as the face
- shadcn card grids, stat strips, pill clusters on home
- A second palette “for the next book”
- Stock religious clipart
- Empty routes for unbuilt books

## Favicon / og

Change the mark only in BrandMark + `public/favicon.svg`, then `pnpm brand`. og.png stays 1200×630 night+mark, not a HUD screenshot.

## Proof

`device-verification` at 375 and 1280. Console 0. Contrast AA for ink and fire on void. Reduced-motion: no essential info in motion only.

The implementer does not approve its own UI. After screenshots exist, spawn an independent visual critic (`helives-gauntlet`). Same agent writing then rubber-stamping is forbidden.
