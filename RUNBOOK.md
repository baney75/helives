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

Needs `ELEVENLABS_API_KEY` in `.env.local`. Rotate the key if it ever appeared in chat.

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
5. Load `AGENTS.md` skill table: helives-design, helives-three, helives-models, helives-voice, helives-gauntlet. Voice and 3D are required, not polish-later.
6. Put Grok Imagine stills in `docs/targets/<book>/` before calling the mesh done.
7. Ship path is implement → independent critic → merge. The implementer does not grade itself.

## Interface checks

After `pnpm build`, run `pnpm exec wrangler dev --port 8787`. Then `node scripts/verify-refresh.mjs` checks navigation and playback and saves responsive screenshots in `demo/refresh/`. Set `HELIVES_PREVIEW_URL` to verify another deployment.

Use the Worker preview for release checks so the browser receives production security headers. The shipped GLB models use no Draco or Meshopt compression; keep those optional decoders disabled in both loading and preloading. Their unused WebAssembly initialization otherwise violates the site CSP.

## Branding and background music

`pnpm brand` regenerates favicon, app icons and share artwork from `src/site/brand.ts` with embedded local typography. See `docs/MUSIC.md` for the soundtrack and `docs/music-prompts.html` for copyable Lyria prompts. Browser acceptance: `node scripts/verify-brand-music.mjs` against the Worker preview. No runtime API key is needed for background playback.
