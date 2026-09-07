# He Lives design

Visual thesis for [helives.dev](https://helives.dev). Brand refined September 7, 2026 at Donovan’s request (unframed Latin cross with a dawn point, shared vector master). Tokens live in `src/index.css`. Load `gs-design`, then `.cursor/skills/helives-design`.

This is a ministry site. Rams still applies: useful, honest, as little design as possible. It does not apply as “look like Linear.” Do not import SaaS card grids, pill clusters, or Inter.

## Thesis

**Light in darkness.** Night field, one gold, one dawn spark. The first viewport is brand + one verse + one sentence + two actions. The 3D canvas is the later Genesis room, not a decorative blob behind the home copy.

Mood: reverent, quiet, specific. Not cute. Not cinematic-trailer chrome on the marketing pages. Not a dashboard.

## Tokens (do not freelance)

| Token | Value | Use |
|-------|-------|-----|
| `--void` | `#07060a` | Page, canvas fog, favicon ground |
| `--ink` | `#ece6d8` | Primary text (parchment, not pure white) |
| `--muted` | `#9a9184` | Secondary text |
| `--fire` | `#e8b86d` | Accent, links, live book titles, mark, primary button |
| `--dawn` | `#fff4d6` | Point of light in the mark; set-apart words |
| `--speech` | `#d06050` | Words of Christ (red letter) |
| `--speech-lit` | `#e07a6a` | Set-apart words inside speech |
| `--ground` | `#1a1008` | Text on gold buttons |
| `--glass` | `rgba(7, 6, 10, 0.62)` | HUD readouts only |
| `--line` | `rgba(236, 230, 216, 0.14)` | Hairline rules |
| `--display` | Cormorant Garamond 500/600 | Wordmark, H1, book titles |
| `--serif` | Source Serif 4 400/400i/600 | Body |
| `--mono` | ui-monospace | Kickers, quality readouts |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 | `--space-1` … `--space-7` |

Two families. Gold is the only chrome accent. Liturgical red is reserved for the words of Christ. Self-hosted woffs in `public/fonts/` (OFL). Do not call Google Fonts.

Do not install Canvas UI (`npx shadcn add @canvas-ui/*`). Experimental HTML-in-canvas, Commons Clause. Take pause-offscreen and reduced-motion discipline only.

Contrast: ink on void, fire on void, and `--speech` on void must stay WCAG AA. Do not drop body to `--muted` at small sizes on busy 3D.

## Mark

Latin cross with a point of light at the crossing: empty tomb / resurrection, not a stock lucide cross.

- Geometry: `src/site/brand.ts` is the 64×64 master used by React and all vector/raster exports. Gold cross, dawn square at the joint.
- Nav: 30px unframed. Home hero: 48px unframed. Genesis uses the same mark.
- Unframed = `currentColor` (fire in the interface). No box around the primary mark.
- Do not replace with an icon font, emoji, or a different cross.

## Type

- Home H1 is the brand name at display size (`clamp(64px, 14vw, 120px)`), not a slogan that overpowers it.
- Verse under the name: Cormorant italic (hosted 500/600 italic woffs, not a faux oblique). Citation in muted kicker case.
- Body 17–18px, line-height ~1.55–1.65, measure ~42em on docs, ~52rem site column, ~68rem on `/scriptures`.
- Kickers: uppercase, wide tracking, `--fire`, 10–11px. One kicker per section.
- If deleting 30% of the copy improves the page, keep deleting.

## Surfaces

| Surface | Pattern |
|---------|---------|
| Home | One 100svh lamp (100vh fallback): mark, He Lives, this hour’s KJV (words of Christ in red), an authored one-line motif, Explore more, new scripture every hour, He Lives · NeoRome and the KJV public-domain line. No page scroll. No clipped footer. No Lucide furniture. No cards. No wash. No church button. |
| Scriptures | Typographic index: testament → division → book row (title + status). Live titles are fire links. Forthcoming is named, not a grey card. |
| Faith / afterword | Narrow `doc`. Headings in Cormorant. Sources as a list, not tiles. |
| Genesis HUD | Fixed canvas `z-index: 0`. HUD `z-index: 10`. Gradients keep text readable. Transport 44px targets. |
| Cinematic | Captions only. Locked camera. Brand stays Cormorant. |

No card-grid home. No “feature” icon row. No floating badges on the hero.

## 3D inheritance

Canvas background is `--void`. Light is warm (`#ffd28a` / fire / dawn), not neon purple. Fog is void.

Garden and Fall are the quality bar for later narrative scenes: readable as *those* scenes, not generic trees and a squiggle. Instanced primitives are allowed as a blockout. Shipping a later book still as icosahedron canopies and capsule people is a known debt, not a style.

Later books inherit this night/gold grammar. A Gospel night can be quieter. Revelation may use more fire. Do not invent a second palette (no maroon-from-another-project, no corporate blue).

Motion: slow auto-rotate off cinematic; respect `prefers-reduced-motion`; 2–3 motions max on site pages (none required on Faith). Bloom only on medium/high Genesis quality.

## Favicon and share

| File | Rule |
|------|------|
| `/favicon.svg` | Same geometry as BrandMark. Void ground, fire cross, dawn joint. |
| `/favicon-32.png` | Raster of the SVG. Regenerate with `pnpm brand` after mark changes. |
| `/apple-touch-icon.png` | Same mark, larger. |
| `/mask-icon.svg` | Monochrome; `color="#e8b86d"` in `index.html`. |
| `/og.png` | 1200×630. Night field, mark, “He Lives”, no screenshot of the HUD, no fake UI chrome. |
| theme-color | `#07060a` |

Do not point og:image at a CDN or a generated Imagine file. Public share art is a designed still, committed and compressed.

## Anti-slop

- No Inter, Roboto, system-ui as the face of the site.
- No purple gradients, glassmorphism on marketing pages, or “AI SaaS” cards.
- No stock crosses, doves, or sunrise photographs as the brand.
- No “unlock your potential” ministry slogans. Invitation is: go to church, hear the Word, live for Jesus Christ.
- No fake 66-book library of empty tiles.
- Particle fields and bloom never win over the verse. Hour transitions leave no wash, card, or leftover motion.

## Later books

When Exodus (or any book) ships:

1. Keep tokens. Do not theme-switch the chrome.
2. Home stays He Lives. The book lives at `/{slug}`.
3. Scriptures row flips to live (fire link) only when the route works.
4. Interactive books follow Genesis: canvas + HUD + KJV + voice. Reading books may be type-first; they still use this type, this night, this mark.
5. Prove with 375 and 1280 screenshots against `docs/targets/` if a still exists.
6. Visual ship requires an independent visual judge (not the implementer). See AGENTS.md critics and `.cursor/skills/helives-gauntlet`.

## Proof

`device-verification`: 375 and 1280, console 0. Home must still read as He Lives with the nav removed. Scriptures must remain a list, not a grid of cards.

The implementer captures screenshots as evidence. The **visual critic** (separate subagent, different model when available, no implementer chat) compares them to this thesis and to `docs/targets/`. “Looks good to me” from the agent that designed the page is not proof.

## Optional music

Quiet instrumental music accompanies the rotating Scripture as well as reading pages and Genesis. Playback stays off until explicitly enabled and does not reset at verse rollover. Music settings use a native top-layer popover so small viewports do not clip the volume or track selector. See `docs/MUSIC.md`.
