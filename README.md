# He Lives

Scripture-centered site at [helives.dev](https://helives.dev). Repository: [neorome/helives](https://github.com/neorome/helives).

**Genesis 1–3 through the Fall** is live, then a closing invitation to church and to live for Jesus Christ, then **Got doubt?** — a short afterword on what cosmology can measure, with official NASA/ESA sources. The Scriptures page names the whole Protestant canon. Only Genesis is a book you can open.

Quoted Bible is the King James Version, public domain in the United States.

This is not a church, not a sacrament, and not a claim that God endorsed the software.

## Brand

Night field `#07060a`, gold `#e8b86d`, parchment `#ece6d8`, dawn light `#fff4d6`.
Wordmark: Cormorant Garamond. Body: Source Serif 4. Tokens in `src/index.css`.
Mark: original Latin cross with a point of light (empty tomb / resurrection). Not a stock icon.
Favicon: `/favicon.svg` (also `/favicon-32.png`, `/apple-touch-icon.png`, `/mask-icon.svg`). Share image: `/og.png`.
The 66-book index is `/scriptures`. Only Genesis is a live book route.

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

Home: `/`  
Genesis: `/genesis`  
Cinematic: `/genesis?cinematic=1`  
Afterword: `/genesis/afterword`  
The Scriptures: `/scriptures`  
Faith: `/faith`

## Deploy

Cloudflare Worker + static assets on **helives.dev** (BarnLabs account). See `RUNBOOK.md`.

```bash
pnpm run deploy
```

## Audio

Narration is generated with ElevenLabs. Put `ELEVENLABS_API_KEY` in `.env.local` (never commit it). Then:

```bash
pnpm audio
```

If generation fails, do not ship silence as if there were a voice. Days 1–5 and “Got doubt?” have spoken KJV. Day 6 through the closing invitation stay on screen until credits allow more voice. There is no trailer audio yet.
