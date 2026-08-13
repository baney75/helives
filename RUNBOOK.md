# He Lives runbook

Canonical GitHub: `neorome/helives`  
Live site: `https://helives.dev`  
Cloudflare account: BarnLabs (`f28b2a55054cbc8d998c5963ed34a0a7`)  
Worker name: `helives`

## First deploy

```bash
pnpm install
pnpm test && pnpm typecheck && pnpm lint && pnpm build
gitleaks detect --no-git --source . --redact
pnpm run deploy
```

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
