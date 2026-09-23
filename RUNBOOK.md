# He Lives runbook

Canonical GitHub: `baney75/helives`
Live site: `https://helives.dev`  
Cloudflare account: BarnLabs (`f28b2a55054cbc8d998c5963ed34a0a7`)  
Worker name: `helives`

## First deploy

```bash
pnpm install
pnpm test && pnpm typecheck && pnpm lint && pnpm build
gitleaks git --redact .
pnpm run deploy
```

The Git scan covers committed release content and history without reading ignored local credential files such as `.env.local`.

`wrangler.jsonc` attaches custom domains `helives.dev` and `www.helives.dev`. If attach fails because the zone is on the Personal account, retry with that account. Do not delete unrelated DNS.

## Audio

```bash
pnpm audio
```

Needs a configured `ONE_MIN_AI_API_KEY` or `ELEVENLABS_API_KEY` in `.env.local`; `scripts/generate-audio.mjs` selects the available provider. Keep keys out of commits and chat.

## Trailer

```bash
pnpm record
```

Writes `demo/genesis-16x9.mp4` (gitignored) and copies to `~/Downloads/Genesis-HeLives-16x9.mp4`.

## Adding a later book

1. Add the slug to `BookSlug` in `src/canon/types.ts`.
2. Add a live `BookRecord` in `src/canon/catalog.ts`. Kind `interactive` or `reading`.
3. Map the slug in `src/site/router.ts`.
4. Do not add greyed-out forthcoming cards for books that are not built.
5. Load `AGENTS.md` skill table: helives-design, helives-voice, and helives-gauntlet for an illustrated book. Use helives-three/helives-models only when deliberately authoring 3D. Voice and authored visuals are required.
6. Put visual target stills in `docs/targets/<book>/` before calling the illustration done. Preserve editable SVG or model sources and compare the real 375/1280 render.
7. Ship path is implement → independent critic → merge. The implementer does not grade itself.

## Interface checks

After `pnpm build`, run `pnpm exec wrangler dev --port 8787`. Then run `node scripts/verify-refresh.mjs` and `node scripts/verify-genesis-readiness.mjs`. The first checks navigation, all 13 SVG scenes, blocked-WebGL operation, playback and responsive routes, saving screenshots in `demo/refresh/`. The second checks the built Worker at 653×508 DPR 2, including SVG readiness, voice, seek, reduced motion, and the native scene-text dialog. Set `HELIVES_PREVIEW_URL` to verify another Worker deployment; the readiness script requires the Worker CSP by default.

Use the Worker preview for release checks so the browser receives production security headers. Active Genesis should not request WebGL, GLB models, or legacy mesh decoders; both verifiers fail if the obsolete assets or Canvas return. Legacy 3D source and its decoder guidance remain relevant only to an explicitly restored 3D route.

## Branding and background music

`pnpm brand` regenerates favicon, app icons and share artwork from `src/site/brand.ts` with embedded local typography. See `docs/MUSIC.md` for the soundtrack and `docs/music-prompts.html` for copyable Lyria prompts. Browser acceptance: `node scripts/verify-brand-music.mjs` against the Worker preview. No runtime API key is needed for background playback.
