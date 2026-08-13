# He Lives

Scripture-centered site at [helives.dev](https://helives.dev). Repository: [neorome/helives](https://github.com/neorome/helives).

Phase one is **Genesis 1–3 through the Fall**, then a closing invitation to church and to live for Jesus Christ, then **Got doubt?** — a short afterword on what cosmology can measure, with official NASA/ESA sources. The calling is the whole Bible. This release is Genesis. The rest of the canon, in time.

Quoted Bible is the King James Version, public domain in the United States.

This is not a church, not a sacrament, and not a claim that God endorsed the software.

## Run

```bash
pnpm install
pnpm dev
```

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Interactive Genesis: `/genesis`  
Cinematic pass: `/genesis?cinematic=1`  
Afterword: `/genesis/afterword`  
Faith: `/faith`

## Deploy

Cloudflare Worker + static assets on **helives.dev** (BarnLabs account). See `RUNBOOK.md`.

```bash
pnpm deploy
```

Origin, the ΛCDM visualizer, stays at [neorome/big-bang](https://github.com/neorome/big-bang). It is a different work.

## Audio

Narration is generated with ElevenLabs. Put `ELEVENLABS_API_KEY` in `.env.local` (never commit it). Then:

```bash
pnpm audio
```

If generation fails, do not ship silence as if there were a voice. A first pass hit the ElevenLabs 10k-credit cap after Days 1–5 plus “Got doubt?”. Remaining scenes (Day 6 through the trailer) need more credits before they have voice.
