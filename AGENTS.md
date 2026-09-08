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
- `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`
- Cloudflare Worker + static assets (`worker/`, `wrangler.jsonc`)
- Vitest for canon routing, cosmology sources, scene math, voice inventory

## Skill routing

Load **`gold-standard`** first. Then **one overlay per phase**. Do not invent a second Three.js or design skill.

| Work | Load | Overlay (this repo) |
|------|------|---------------------|
| Any non-trivial ship | `~/.cursor/skills/gold-standard` | — |
| UI, brand, type, home, Scriptures | `~/.cursor/skills/gs-design` | `.cursor/skills/helives-design` |
| Canvas, R3F, particles, disposal | `~/.cursor/skills/three-js` (+ `particle-systems`) | `.cursor/skills/helives-three` |
| Meshes, glTF, Blender, target stills | `~/.cursor/skills/blender-3d`, `three-js` GLTF section, `assets` | `.cursor/skills/helives-models` |
| Narration, ElevenLabs, mp3 cache | — | `.cursor/skills/helives-voice` |
| Fix-until-pass, visual loops | `~/.cursor/skills/gloop` | `.cursor/skills/helives-gauntlet` |
| Theology, verse handling | `~/.cursor/skills/bible-reasoning` | — |
| Headers, secrets, threat model | `~/.cursor/skills/gs-security` | — |
| Copy, docs, anti-slop | `~/.cursor/skills/communication-writing` + `gs-content` | — |
| Visual proof 375 + 1280 | `~/.cursor/skills/device-verification` | helives-gauntlet |
| Independent review | `~/.cursor/skills/code-reviewer`, `check-work` | helives-gauntlet critics |

**3D and voice are essential, not polish-later.** A later book that ships mute, or as a card grid with a nebula blob, is unfinished.

## Critics (mandatory, not polish)

The implementer **never** grades its own work as the critic. This is a hard gate, not a preference.

Ship path: **implement → independent critic → only then merge/ship.**

| Rule | Meaning |
|------|---------|
| Separate agent | Critic is a distinct subagent/pass. Different model when available. At minimum a fresh independent review with **no implementer conversation**. |
| Separate judge | gloop-style: verifier-first, separate judge, max loops. Builder writes evidence; judge reads GOAL + artifacts + `git diff` only. |
| Forbidden | Implementer self-approving screenshots. “Looks good to me.” Same agent writing then rubber-stamping. Same-context self-grade. |

Critics: `code-reviewer` (diff), `check-work` (did the request land), visual judge (`gs-design` + still-vs-target). `VERDICT: SHIP` from the critic is required for material UI, 3D, voice, or security work. See `.cursor/skills/helives-gauntlet`.

## Rules

- R3F/drei first. No new raw Three.js loops in React components unless justified (shaders, instancing).
- HUD text wins. Canvas is the simulation; HUD stays readable.
- Quoted Bible is KJV only. Do not paste NIV/ESV/NASB/NLT. Original lines stay in `kind: 'exhortation'` (see `src/genesis/scenes.ts`).
- Epoch times and scene copy live in `src/genesis/` (later books: `src/<book>/`). Do not invent cosmology numbers without a source in `src/genesis/sources.ts`.
- `?cinematic=1` on `/genesis` is the video pass: captions only, locked camera.
- Dispose manual geometries/materials.
- Mobile: fewer particles, no bloom. Quality tiers in `src/lib/budget.ts` and `src/lib/quality.ts`.
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

## Models and stills

Grok Imagine is a **visual target**, not a mesh. Pipeline: blockout → target still → model/sculpt/texture → screenshot/compare → iterate. Stills live under `docs/targets/`. See `.cursor/skills/helives-models` and `.cursor/skills/helives-gauntlet`.

There is no standalone `grok imagine` CLI on this Mac. `which grok` is `/Users/baney/.grok/bin/grok` (Grok Build TUI). Generate stills inside Grok Build with `/imagine` or the `image_gen` / `image_edit` tools (`~/.grok/bundled/skills/imagine/SKILL.md`). Do not invent a REST API.

## Verify

Before claiming done: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. UI/3D work also needs 375 and 1280 screenshots and the gauntlet verifiers. Then an **independent critic** (`code-reviewer` / `check-work` / visual judge) with no implementer context. The implementer may not ship on its own screenshots or a same-session “looks good.”

For Genesis loading, model, or transport changes, run `scripts/verify-genesis-readiness.mjs` against the built Worker. It delays both Eden figures after an already-ready scene, then checks that loading clears and narration resumes. Development StrictMode can mask Suspense reveal failures. Include a 653×508 CSS viewport at DPR 2 when checking compact controls.
