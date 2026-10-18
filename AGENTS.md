# He Lives
Ministry site at https://helives.dev: one KJV passage each hour, Genesis 1–3 as a 3D visual meditation, and the Protestant canon index. Visitors use it in the browser; it runs as the Cloudflare Worker `helives` (BarnLabs account).

## Run and check
- Install: `pnpm install`
- Check (must pass before commit; it can fail): `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
- Live proof for visible changes: after `pnpm build`, run `pnpm exec wrangler dev --port 8787`, then `node scripts/verify-refresh.mjs` (screenshots land in the untracked `demo/` folder under `refresh`; check 375 and 1280 widths). Else report "untested live".
- Deploy: `gitleaks git --redact . && pnpm run deploy` -> helives.dev and www.helives.dev; read it back after (`curl -sI https://helives.dev` and open the changed page).

## Brand
- No shared BarnLabs, NeoRome or Martyr design system applies; helives has its own (night field, gold `--fire`, Cormorant Garamond and Source Serif 4). Tokens are in `src/index.css`, described in `DESIGN.md`. Use the tokens, add no raw hex.

## Layout
- `src/canon/`: book slugs and catalog; `src/site/router.ts` maps live books to routes.
- `src/genesis/`: Genesis scenes, copy, epoch times and cosmology sources (`sources.ts`).
- `src/scene/`, `src/lib/`: R3F scenes, quality tiers and particle budgets.
- `worker/`: Cloudflare Worker, security headers (`headers.ts`) and audio range serving.
- `scripts/`: audio generation, captures, trailer and `verify-*.mjs` interface checks.
- `public/audio/`: cached narration mp3s; `public/models/`: shipped GLB models.
- `docs/targets/`: target stills for 3D work.
- `.cursor/skills/helives-*`: repo overlays for design, three, models, voice and the critic gauntlet.

## Hard limits
- Never commit secrets, real user data or machine-specific addresses; fixtures are synthetic. Keys live only in `.env.local` (see `.env.example`).
- Quoted Bible is KJV only. Original lines stay `kind: 'exhortation'`, never presented as Scripture.
- No cosmology number without a source in `src/genesis/sources.ts`.
- No empty book routes or greyed-out "forthcoming" cards; only live books get a URL. A new book ships with 3D and voice.
- Voice fails closed: request an mp3 only if it is in `public/audio/` and listed in `VOICED_IDS`. Never invent spoken files.
- Do not weaken Worker headers in `worker/headers.ts` or enable Draco/Meshopt decoders (they break the CSP).
- Dispose manual geometries and materials; mobile gets fewer particles and no bloom.
- The implementer never grades its own work. Material UI, 3D, voice or security changes need an independent critic pass before merge.
- One writer per file; preserve unrelated changes.

## References
- `README.md` for the site overview and brand.
- `RUNBOOK.md` for deploy, audio, trailer, adding a later book and interface checks.
- `DESIGN.md` for tokens, type, surfaces and the 3D bar.
- `.cursor/skills/helives-gauntlet/SKILL.md` for the critic and visual-proof loop.
