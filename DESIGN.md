# He Lives design

The design of the library at [helives.dev](https://helives.dev). Every value here comes from `site/assets/site.css`, `site/assets/prefs.js` and `site/lib/layout.mjs`. If this file and the code disagree, the code wins; fix this file.

## Thesis

**Light in darkness, made for long reading.** A night field, parchment text, one gold accent. The text is the product. Chrome stays quiet, small and out of the way. Rams applies: useful, honest, as little design as possible.

Mood: reverent, quiet, specific. Not a dashboard, not a SaaS landing page, not a card grid.

## Tokens

All colors are theme variables set in the `:root` block and the `[data-theme]` blocks at the top of `site.css`. Components use `var(--...)` only. No raw hex anywhere else in the CSS, except the `@media print` override.

Night (the brand, and the `:root` default):

| Token | Night | Use |
| --- | --- | --- |
| `--bg` | `#07060a` | Page ground |
| `--surface` | `#121016` | Sheets, inputs, image placeholders |
| `--ink` | `#ece6d8` | Text (parchment, not pure white) |
| `--muted` | `#a39a8c` | Secondary text, meta, verse numbers |
| `--accent` | `#e8b86d` | Gold: links, kickers, primary button, the mark |
| `--accent-ink` | `#1a1008` | Text on gold |
| `--line` | `rgba(236, 230, 216, 0.14)` | Hairline rules and borders |
| `--dawn` | `#fff4d6` | The point of light in the mark |
| `--mark` | `rgba(232, 184, 109, 0.16)` | Soft highlight: target verse, read aloud, ruler, chosen option |
| `--focus` | `#e8b86d` | Focus outline |

Spacing: `--s1` to `--s8` are 4, 8, 12, 16, 24, 32, 48 and 64 px. Radii: `--r1` 6px, `--r2` 10px.

## Type

| Token | Face | Use |
| --- | --- | --- |
| `--display` | Cormorant Garamond 500 and 600 | Wordmark, h1 to h3, headings inside the text |
| `--serif` | Source Serif 4 (variable) | Body and the default reading font |
| `--sans` | Atkinson Hyperlegible Next (variable) | The "Hyperlegible" reading font |
| `--dyslexic` | OpenDyslexic 400 and 700 | The "OpenDyslexic" reading font |
| `--ui` | system-ui | Controls, meta, crumbs, notes |
| `--mono` | ui-monospace | `kbd` only |

- Fonts are self-hosted in `/fonts/` (OFL). Never call Google Fonts or another font CDN.
- `h1` is `clamp(40px, 7vw, 64px)`; the home hero is `clamp(56px, 12vw, 104px)`; reader page titles are `clamp(36px, 6vw, 56px)`.
- Kickers: 12px, uppercase, 0.12em tracking, gold. One per section.
- Reading text uses `--read-font`, `--fs`, `--lh`, `--ls`, `--ws` and `--measure`, all set by the reader's settings.

## Themes

Set as `data-theme` on `<html>` by `prefs.js` before first paint, so there is no flash.

| Theme | Ground | Purpose |
| --- | --- | --- |
| Match device (default) | Night when the device is dark, Paper when it is light | Follows `prefers-color-scheme` |
| Night | `#07060a` | The brand |
| Dusk | `#1d1b20` | Low contrast, no pure black or white, for light sensitivity and visual snow |
| Paper | `#f7f2e8` | Light reading |
| Sepia | `#eadcc2` | Warm light reading |
| High contrast | `#000`, text `#fff`, accent `#ffd34d` | Low vision |

Every theme defines the full token set. Keep text and links at WCAG AA or better on `--bg` in every theme.

## Focus bold

- The build wraps the first part of every word in `<b>` (`fixate()` in `site/lib/html.mjs`): 1 letter for words of up to 3, 2 for words of 4 or 5, 40% rounded up for longer words.
- It is done at build time, so there is no flash and no script cost.
- The setting only changes weight through `data-fx`: On 600, Light 520, Strong 720, Off inherits the normal weight.
- Headings and verse numbers keep their own weight.

## Reading settings

Defaults live in `site/assets/prefs.js` and are stored in `localStorage` under `hl:prefs`. Nothing leaves the device.

| Setting | Values | Default |
| --- | --- | --- |
| Focus bold | On, Light, Strong, Off | On |
| Theme | Match device, Night, Dusk, Paper, Sepia, High contrast | Match device |
| Font | Serif, Hyperlegible, OpenDyslexic | Serif |
| Text size | 15 to 30 px | 19 px |
| Line spacing | 1.4 to 2.4 | 1.7 |
| Letter spacing | 0 to 0.12 em | 0 |
| Word spacing | 0 to 0.4 em | 0 |
| Line length | 26 to 48 rem | 38 rem |
| Bible layout | Paragraphs, one verse per line | Paragraphs |
| Verse numbers | Show, Hide | Show |
| Footnotes | Show, Hide | Show |
| Reading ruler | Off, highlight band, dim the rest | Off |

The settings sheet shows a live sample line. "Reset to defaults" clears them.

Background sound lives in its own sheet: brown, pink and white noise, rain, stream, fireplace and wind, with volume and a 15, 30 or 60 minute timer. `site/assets/sounds.js` makes them with the Web Audio API from generated noise. No audio files. Changes are slow and gentle, never sudden or loud.

## Layout

Design for a 390px phone first, then check 1280.

- Header: sticky, 56px minimum, max width 90rem. Brand, breadcrumbs, then Search, Sound and Reading. At 640px and below the tool labels and the wordmark text hide; icons stay.
- Index pages: `.wrap` at 72rem; `.narrow` at 44rem for About and similar.
- Library shelves and the Bible's two testaments: one column, two at 860px and up.
- Reader under 1100px: one column, text at `--measure`, and a fixed bottom dock with Back, Listen (when audio exists), Reading, Sound and Next in thumb reach.
- Reader at 1100px and up: contents (15rem) | text (`--measure`) | rail for art, maps, video and downloads (18rem). Contents and rail are sticky. The dock hides; Listen and Print sit under the title.
- Every control is at least 44px tall; dock buttons 52px.
- No sideways scroll at any width. `scripts/shots.mjs` fails on it.

## Motion

- No animations and no transitions. Do not add `@keyframes`, `transition` or `animation`.
- Smooth scrolling is on only under `prefers-reduced-motion: no-preference`. The audio player's scroll follows the same rule.
- Highlights (target verse, the verse being read, the ruler) are a still `--mark` band. They never pulse, fade or slide.
- Videos load only when the reader presses play.

## Print

- Every work has a print page (`/bible/<book>/print/`, `/read/<id>/print/`) with the whole text; `?print=1` opens the print dialog once fonts load.
- `@media print` sets black on white, hides the header, dock, contents, rail, pager, footer, ruler and dialogs, and sets text to 11.5pt with 18mm by 16mm margins.
- Headings never end a page; paragraphs keep 3 lines for orphans and widows.

## The mark and share images

- The mark is a Latin cross with a point of light at the crossing: gold bars, a `--dawn` square at the joint. Source: `brandMark()` in `site/lib/icons.mjs` and `public/favicon.svg`.
- After changing the mark, run `node scripts/render-brand.mjs` to redraw the favicon PNG, apple touch icon and `og.png`.
- `og.png` stays 1200 by 630: night field, mark, "He Lives". No screenshots or fake UI.
- `theme-color` is `#07060a`.

## Do not

- Card grids, stat tiles, badges or icon rows for decoration.
- Inter, Roboto or system-ui as the face of the reading text.
- Purple gradients, glass panels, a second palette for one section.
- Stock crosses, doves or sunrise photos as the brand.
- Empty shelves or "coming soon" entries for works that are not in `library/`.

## Proof

Screenshots at 390 and 1280, light and dark, from `scripts/shots.mjs`, and `scripts/check-ui.mjs` passing. The agent that made the change does not judge them; an independent critic does. See `.cursor/skills/helives-gauntlet/SKILL.md`.
