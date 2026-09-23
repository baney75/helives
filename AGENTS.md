# He Lives (helives)

Operating contract for agents. Home `Claude.md` does not apply here.

Canonical repo: [baney75/helives](https://github.com/baney75/helives). Live: [helives.dev](https://helives.dev). Local: `~/Documents/Software/helives`.

This is a ministry site, not a SaaS product. Quoted Bible is KJV (public domain in the US). Original copy is exhortation, never presented as Scripture. The site is not a church, not a sacrament, and not a claim that God endorsed the software.

## Product

- Phase one is live: Genesis 1–3 through the Fall, invitation to church and to live for Jesus Christ, then **Faith and the universe** (sourced cosmology afterword).
- The calling is the whole Protestant canon, cover to cover, including law, genealogies, and the books people skip. Same beauty bar as Genesis. No empty book routes. `/scriptures` names every book; only live books get a URL.
- Adding a later book: slug in `src/canon/types.ts`, live `BookRecord` in `src/canon/catalog.ts`, route in `src/site/router.ts`. See `RUNBOOK.md`.

## Stack

- React 19 + TypeScript (strict) + Vite
- Genesis: JavaScript-driven SVG illustration in `src/scene/GenesisIllustration.tsx`, timed by `src/genesis/` and narrated audio
- Legacy 3D authoring sources remain in the repository but are not loaded by the active Genesis route
- Cloudflare Worker + static assets (`worker/`, `wrangler.jsonc`)
- Vitest for canon routing, cosmology sources, scene math, voice inventory

## Skill routing

Load **`gold-standard`** first. Then **one overlay per phase**. The shared skills currently resolve under `~/.agents/skills/`; project overlays remain under `.cursor/skills/`. Check a path before relying on it.

| Work | Load | Overlay (this repo) |
|------|------|---------------------|
| Any non-trivial ship | `~/.agents/skills/gold-standard` | — |
| UI, brand, type, SVG illustration, home, Scriptures | `~/.agents/skills/gs-design` + `~/.agents/skills/assets` when sourcing art | `.cursor/skills/helives-design` |
| Legacy 3D source maintenance only | `~/.agents/skills/three-js`, `~/.agents/skills/blender-3d`, `~/.agents/skills/assets` | `.cursor/skills/helives-three` or `.cursor/skills/helives-models` |
| Narration, ElevenLabs, mp3 cache | — | `.cursor/skills/helives-voice` |
| Fix-until-pass, visual loops | `~/.agents/skills/gloop` | `.cursor/skills/helives-gauntlet` |
| Theology, verse handling | KJV source and `src/genesis/` scene/citation conventions; verify the passage | — |
| Headers, secrets, threat model | `~/.agents/skills/gs-security` | — |
| Copy and docs | `~/.agents/skills/gs-content`; preserve the KJV/original-copy distinction | — |
| Visual proof 375 + 1280 + compact 653×508 DPR 2 | `~/.agents/skills/device-verification` | `.cursor/skills/helives-gauntlet` |
| Independent review | `~/.agents/skills/code-reviewer`, `~/.agents/skills/check-work` | `.cursor/skills/helives-gauntlet` critics |

**Voice and authored visual storytelling are essential.** Active Genesis uses a 2D SVG renderer. A later book that ships mute or as a card grid with a nebula blob is unfinished; 3D is a project-specific art choice, not a requirement for every book.

## Critics (mandatory, not polish)

The implementer **never** grades its own work as the critic. This is a hard gate, not a preference.

Ship path: **implement → independent critic → only then merge/ship.**

| Rule | Meaning |
|------|---------|
| Separate agent | Critic is a distinct subagent/pass. Different model when available. At minimum a fresh independent review with **no implementer conversation**. |
| Separate judge | gloop-style: verifier-first, separate judge, max loops. Builder writes evidence; judge reads GOAL + artifacts + `git diff` only. |
| Forbidden | Implementer self-approving screenshots. “Looks good to me.” Same agent writing then rubber-stamping. Same-context self-grade. |

Critics: `code-reviewer` (diff), `check-work` (did the request land), visual judge (`gs-design` + still-vs-target). `VERDICT: SHIP` from the critic is required for material UI, illustration, 3D, voice, or security work. See `.cursor/skills/helives-gauntlet`.

## Rules

- Keep the active Genesis illustration in the existing SVG/scene-clock pipeline; do not load legacy 3D into it by accident. For deliberate legacy 3D work, use R3F/drei first and justify any raw Three.js loop.
- HUD text wins. The illustration stays behind readable selectable text.
- Quoted Bible is KJV only. Do not paste NIV/ESV/NASB/NLT. Original lines stay in `kind: 'exhortation'` (see `src/genesis/scenes.ts`).
- Epoch times and scene copy live in `src/genesis/` (later books: `src/<book>/`). Do not invent cosmology numbers without a source in `src/genesis/sources.ts`.
- `?cinematic=1` on `/genesis` is the video pass: captions only, locked camera.
- Keep SVG IDs unique within the rendered node tree; preserve pause, seek, reduced-motion, and still-frame behavior.
- Legacy 3D maintenance: dispose manual geometries/materials and respect the quality tiers in `src/lib/budget.ts` and `src/lib/quality.ts`.
- Never commit `.env.local`, `ELEVENLABS_API_KEY`, `ONE_MIN_AI_API_KEY`, or any secret. Keys live in `.env.local` only (see `.env.example`). Do not put keys in README.
- Voice fails closed: if the mp3 is not in `public/audio/` and listed in `VOICED_IDS`, do not request it. Silence must not pretend to be narration.
- Narration cache: `pnpm audio` writes `public/audio/<id>.mp3`. Prefer `ONE_MIN_AI_API_KEY` (1min.ai `TEXT_TO_SPEECH`) when ElevenLabs is out of quota. Do not invent spoken files.
- Security: Worker headers in `worker/headers.ts` (CSP, COOP, CORP, HSTS, blocked probes). The enemy will attack. Do not weaken headers, leak keys, or serve HTML as missing audio.

## Commands

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm run deploy
pnpm audio          # 1min.ai or ElevenLabs → public/audio/ (needs .env.local)
pnpm record         # cinematic trailer (gitignored demo/)
```

## Visual targets and legacy models

Grok Imagine is a **visual target**, not an implementation asset. For the active SVG route, storyboard the actual scene and voice, draw editable vectors, then compare 375/1280 captures with the target still and correct the render. Stills live under `docs/targets/`. The older model/sculpt/texture pipeline remains available for deliberate legacy 3D source work; see `.cursor/skills/helives-models` and `.cursor/skills/helives-gauntlet`.

There is no standalone `grok imagine` CLI on this Mac. `which grok` is `/Users/baney/.grok/bin/grok` (Grok Build TUI). Generate stills inside Grok Build with `/imagine` or the `image_gen` / `image_edit` tools (`~/.grok/bundled/skills/imagine/SKILL.md`). Do not invent a REST API.

## Verify

Before claiming done: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. UI/illustration work also needs 375 and 1280 screenshots, a 653×508 DPR 2 compact check, and the gauntlet verifiers. Then an **independent critic** (`code-reviewer` / `check-work` / visual judge) with no implementer context. The implementer may not ship on its own screenshots or a same-session “looks good.”

For Genesis illustration, loading, voice, or transport changes, run `scripts/verify-refresh.mjs` and `scripts/verify-genesis-readiness.mjs` against the built Worker. They check all 13 SVG scenes, absent WebGL/GLB requests, blocked-WebGL operation, navigation, playback, native scene text dialog, reduced motion, and compact controls. Development StrictMode does not replace the Worker check.
