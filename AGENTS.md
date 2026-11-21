# He Lives
A free, accessible library at https://helives.dev: the Berean Standard Bible, the church fathers, Aquinas, the creeds, labeled Gnostic texts, papal encyclicals, public domain art and maps, and curated videos. Static pages from `site/build.mjs`, served by the Cloudflare Worker `helives` (BarnLabs account).

## Run and check
- Install: `pnpm install`.
- Check before every commit (it can fail): `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. `pnpm test` runs the site tests, the pipeline tests and the worker tests.
- After any change under `library/`: `pnpm validate` must exit 0, then `pnpm md` to regenerate the Markdown.
- Live proof for visible changes: `pnpm build`, then `pnpm exec wrangler dev --port 8841`, then `node scripts/check-ui.mjs http://localhost:8841`. `pnpm dev` does both; use port 8841, since 8787 belongs to another local service.
- Player changes: also `node scripts/check-listen.mjs http://localhost:8841` (needs audio for Psalm 23 and First Clement; see RUNBOOK.md).
- Screenshots: `node scripts/shots.mjs http://localhost:8841 <out-dir> <paths...>` writes 390 and 1280 widths; `SCHEME=dark` for dark.
- If you cannot run the live checks, say "untested live" and list the steps.
- Deploy: follow RUNBOOK.md. It ends with reading back the home page, a Bible chapter, `/api/search?q=grace` and `/IAM/`.

## Layout
- `library/`: canonical data, one TOML per work. Contract: `library/SCHEMA.md`. The `.md` beside each TOML is generated; never edit it.
- `pipeline/`: Python ingest (`bsb/`, `ccel/`, `extra/`, `media/`), `validate.py`, `render_md.py`, tests.
- `media/*.toml`: videos, art, maps and articles catalogs. `data/encyclicals.toml`: the encyclicals index.
- `site/build.mjs` and `site/lib/`: the static generator. Writes `dist/`; never edit `dist/`.
- `site/assets/`: `site.css` (tokens), `prefs.js`, `app.js`, `sounds.js`, `search.js`, `ref.js`.
- `site/search-index.mjs`: writes `build/search.sql` and `build/search.hash` for D1.
- `worker/`: `index.ts` (routing), `search.ts` (`/api/search`, D1 FTS5), `audio.ts` (`/audio/*` from R2 with ranges), `headers.ts` (CSP and security headers).
- `audio/`: the audiobook renderer for Parish1 (service `helives-audio`), `sync.sh`, `publish.sh`, `status.py`.
- `scripts/`: `check-ui.mjs`, `check-listen.mjs`, `shots.mjs`, `render-brand.mjs`.

## Hard limits
- Never commit secrets, real user data or machine addresses. Run `gitleaks git --redact .` before every push.
- Quoted Scripture on the site is the BSB. Every hosted text is public domain, with `license = "Public domain"` and a `license_basis` in its TOML. No basis, no ingest.
- Label Gnostic and other non-canonical texts as historical and rejected by the church. Never present them as Scripture.
- Encyclicals without a public domain English text are linked, not hosted.
- No invented audio. Listen appears only for sections listed in `audio/manifest.json`. Never fake a manifest entry or a timing file.
- Do not weaken `worker/headers.ts`. The CSP allows outside sources only for `www.youtube-nocookie.com` frames, `i.ytimg.com` images and the Cloudflare analytics beacon.
- The worker serves GET and HEAD only. Keep it that way.
- `helives.dev/IAM` is a separate Worker, `helives-iam`. Never add a route, asset or redirect that changes or shadows `/IAM`. After every deploy, `curl -sI https://helives.dev/IAM/` must return 200.
- Keep every page readable without JavaScript. No animation; respect `prefers-reduced-motion`.
- The implementer never grades its own work. Material UI, voice or security changes need an independent critic pass before merge (`.cursor/skills/helives-gauntlet/SKILL.md`).
- One writer per file. Preserve changes you did not make.

## Brand
- He Lives has its own design system: night field, gold accent, Cormorant Garamond display, Source Serif 4 text. No shared BarnLabs, NeoRome or Martyr system applies.
- Tokens live in the `:root` and theme blocks at the top of `site/assets/site.css`. Use `var(--...)`; add no raw hex outside those blocks.
- Details: `DESIGN.md` and `.cursor/skills/helives-design/SKILL.md`.

## References
- `README.md`: public overview, sources and licenses.
- `RUNBOOK.md`: build, search index, deploy, audio, adding a work, live checks.
- `DESIGN.md`: tokens, type, themes, focus bold, layout, print.
- `library/SCHEMA.md`: the data contract.
