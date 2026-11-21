# He Lives runbook

- GitHub: `baney75/helives`
- Live site: https://helives.dev (`www.helives.dev` redirects to it)
- Cloudflare account: BarnLabs (`f28b2a55054cbc8d998c5963ed34a0a7`)
- Worker: `helives`. D1 database: `helives-library`. R2 bucket: `helives-audio`.
- `helives.dev/IAM` is a different Worker, `helives-iam`, with its own route. Never change or shadow it.

Run every command from the repo root.

## Build

```bash
pnpm install
pnpm validate                 # pipeline/validate.py; must exit 0
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

`pnpm build` runs `site/build.mjs`, which deletes and rewrites `dist/`: reader pages, book and contents pages, print pages, `/dl/<id>.toml` and `/dl/<id>.md`, `/dl/bsb-complete.*`, the sitemap, `opensearch.xml`, `robots.txt` and the 404 page. `node site/build.mjs --only bible` or `--only <work-id>` limits the work pages for a quick look; always ship a full build.

## Search index

```bash
old=$(cat build/search.hash 2>/dev/null)
node site/search-index.mjs    # writes build/search.sql, search.hash, search.count and search-chunks/
[ "$old" = "$(cat build/search.hash)" ] && echo "index unchanged: skip the D1 load"
```

Load D1 only when the hash changed. The load drops and recreates the `doc` table, so search is empty for the few minutes it runs:

```bash
node scripts/load-search.mjs          # loads build/search-chunks/*.sql in order, then checks the row count
```

It must end with "matches the index"; otherwise rerun it. Never load `build/search.sql` in one `--file` call: D1 refuses a file that size (`D1_RESET_DO`). For local work add `--local`.

## Deploy

1. Build and pass the checks above.
2. Rebuild the search index and load D1 if the hash changed.
3. If `audio/manifest.json` lists new files, upload them to R2 first (see Audio). A deployed Listen button must never point at a missing file.
4. Scan and deploy:

```bash
gitleaks git --redact .
pnpm run deploy               # pnpm build && wrangler deploy
```

5. Read back. Every line must succeed:

```bash
curl -sI https://helives.dev/ | head -1                          # 200
curl -sI https://helives.dev/bible/john/3/ | head -1             # 200
curl -s 'https://helives.dev/api/search?q=grace' | head -c 300   # JSON with results
curl -sI https://helives.dev/IAM/ | head -1                      # 200, served by helives-iam
```

If `/IAM/` is not 200, stop and roll back with `pnpm exec wrangler rollback`, then find what shadowed the route.

## Audio

The audiobooks are rendered on Parish1 by the user service `helives-audio`. It is opportunistic: it waits for the parish-media GPU guard and its lock (AC power, idle GPU, no game), renders in 30-minute batches, and releases the GPU between them. It never kills another process.

- Voice: Qwen3-TTS (CustomVoice). Every take is transcribed by Whisper large-v3 and rejected if the word error rate is above 3% or if it stutters or doubles a word. A chunk gets up to 4 takes; failures go to `review.tsv`.
- Data on Parish1: `/srv/magnus-data/media/helives-audio` (`state.db`, `out/`, `review.tsv`).
- Output per section: `<work>/<section>.m4a` and a timing file `{items: [{id: "v16" | "b4" | "title", start}]}`. `v<n>` is verse n; `b<i>` is block i of the section. Pages carry `data-v` on verses and `data-b="<section>:<block index>"` on prose blocks, so the player can light what is being read. A page plays all its sections with audio in order.

Status:

```bash
ssh parish1 'python3 ~/.local/share/helives-audio/app/status.py'
ssh parish1 'systemctl --user --no-pager status helives-audio.service'
```

Push code and library changes to Parish1 (the service re-reads the library before each batch; only changed chunks re-render):

```bash
audio/sync.sh                 # code and library TOMLs
audio/sync.sh --install       # also install and enable the service (checks Linger first)
```

Renderer tests run on Parish1 with the voice venv's Python (they need numpy, soundfile and ffmpeg, no GPU):

```bash
ssh parish1 'cd ~/.local/share/helives-audio/app && ~/.local/share/parish-media/voice/venv/bin/python -m unittest discover -s tests'
```

Stage finished files on the Mac and write `audio/manifest.json`, which the build reads:

```bash
audio/publish.sh              # stages into ~/.local/share/helives-audio-staging
```

Upload staged files to R2. Keys are `audio/<work>/<file>`, matching the manifest URLs. Upload only files the manifest lists:

```bash
STAGE="$HOME/.local/share/helives-audio-staging"
python3 -c 'import json; m=json.load(open("audio/manifest.json")); [print(p) for i in m["items"] for p in (i["url"], i["timing"])]' |
while read -r key; do
  pnpm exec wrangler r2 object put "helives-audio/$key" --file "$STAGE/${key#audio/}" --remote
done
```

Cost: the R2 free tier stores 10 GB. Check the total first (`python3 -c 'import json; print(sum(i["bytes"] for i in json.load(open("audio/manifest.json"))["items"])/1e9, "GB")'`). Ask the owner before an upload would take the bucket past 10 GB.

## Add a new work

1. Confirm the text is public domain and write down why. No basis, no ingest.
2. Write or extend an ingest script in `pipeline/` (`bsb/`, `ccel/` or `extra/`). Fetch sources into `pipeline/cache/` and parse them with `python3 -I`, since downloaded files are untrusted.
3. The ingest writes one TOML per work in `library/<collection>/...` per `library/SCHEMA.md`, with `edition`, `source_url`, `source_sha256`, `retrieved`, `license = "Public domain"` and `license_basis`. Add its authors to that collection's `library/catalog/<collection>.toml`.
4. Validate and render:

```bash
pnpm validate                 # python3 pipeline/validate.py
pnpm md                       # python3 pipeline/render_md.py
python3 -m unittest discover -s pipeline/tests -t .
```

5. Build, check the new pages live, rebuild the search index, and deploy as above.
6. Gnostic works go in `library/gnostic/`. Any non-canonical work needs a `summary` that says it is a historical text the church rejected, never Scripture.
7. Pending: Bondage of the Will (Atherton 1931, CCEL) enters US public domain 2027-01-01; ingest then.
8. Skipped: the Apocalypse of Abraham (G. H. Box, SPCK 1918). The only usable text is the OCR of one archive.org scan (apocalypseofabra00boxg); the online e-texts are unattributed or unusable, so there is no second witness to check the words against. Ingest it only once a second scan or a trustworthy transcription of the Box translation turns up.

## Live checks

```bash
pnpm build
pnpm exec wrangler dev --port 8841          # 8787 is taken by another local service
node scripts/check-ui.mjs http://localhost:8841
node scripts/shots.mjs http://localhost:8841 <out-dir> / /bible/psalms/23/ /search/?q=grace
SCHEME=dark node scripts/shots.mjs http://localhost:8841 <out-dir>-dark / /bible/psalms/23/
```

- `check-ui.mjs` drives reference and word search, reading settings, background sound, arrow keys, place keeping, the encyclicals filter and the 404 page. It exits 1 on any failure. Word search needs the local D1 index.
- `shots.mjs` writes 390 and 1280 screenshots and reports console errors and sideways scroll.
- `check-listen.mjs` needs a build whose `audio/manifest.json` lists Psalm 23 and First Clement chapters 1 and 2, with those files in local R2 (`wrangler r2 object put ... --local`). It fails if the highlight does not follow the audio or the player stops between sections.

Use `wrangler dev` rather than a static server for checks, so the browser gets the production security headers.
