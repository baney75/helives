# Scripture artwork

660 SVG illustrations: 78 preserved, tracked originals (one for each of the 66 books plus 12 distinct scenes matched to recurring passages in Psalms and John) and 582 authored fallback variants. Together they provide ten scenes for each book. These are artistic meditations, not archaeological reconstructions or depictions of every event in each book. They do not make forthcoming reading routes live.

The original 78 illustrations are preserved rather than recreated. `scripts/render-scripture-art.mjs` deterministically renders the 582 variants from `library-directions.json`; the renderer owns all geometry and no generated program is executed. `subjects.txt` records the requested subject for each book. Cerebras was used to propose and critique library directions, but the new generic payload was rejected. The active 582 directions are the explicit authored fallback (`source: authored-fallback-after-cerebras-review`), not model-authored art direction.

`manifest.json` records each canonical file, subject, family, size and hash; `passage-manifest.json` records the additional scenes and exact references; `library-manifest.json` records the 660-scene collection. `passage-art.json` holds authored variant directions. The site loads SVGs as isolated images, not inline HTML. Only requested drawings are loaded; the Scriptures list uses native lazy loading. Motion's mini API supplies a deterministic 86–110-second camera movement with alternating directions. Reduced motion, paused Scripture, hidden tabs and closed artwork viewers stop movement. Home and the artwork viewer preserve the last decoded drawing during a 2.2-second dissolve, including delayed or failed requests. A restrained light/haze layer adds atmosphere; no filter or WebGL loop is used. The viewer has opt-in collection playback, one minute per decoded artwork, with hidden-tab and motion pause. Loading failures stop the collection and expose Retry and Skip.

## Reproduction and cost

- `python3 scripts/generate-art-direction.py` makes one paid, explicitly budgeted request. It reads `~/.config/helives/cerebras.key`, an owner-only local file outside this repository. Never put that value in logs or the frontend.
- `python3 scripts/cerebras-library.py` requests and critiques compact direction proposals. The checked-in current result records a rejected generic proposal and does not activate it.
- `python3 scripts/cerebras-library.py --author-finalize` writes the explicit 582-direction authored fallback **without API calls**.
- `node scripts/render-scripture-art.mjs` preserves the 78 originals and deterministically renders the 582 fallback variants **without API calls**.
- `python3 scripts/test-scripture-art.py` exercises the raw SVG draft sanitizer against active content and URL escapes.
- `spend.json` retains every reservation, including rejected output. Both paid scripts share an exclusive lock and cumulative ledger. The operational ceiling is $4.50, below the user's $5 maximum. Reservations double a pessimistic input/output-token upper bound before requests; uncertain or failed requests retain their reservation. Cost estimates use returned token counts and the public prices in `model-pricing.json`; they are not a provider invoice.

Pricing source checked September 7, 2026: https://api.cerebras.ai/public/v1/models . Model: `gemma-4-31b`; input $0.99 and output $1.49 per million tokens. No 1min.ai generation or Google image request was made for this collection. Existing instrumental music remains off on fresh visits.

The Cerebras creator/critic workflow and saved results are described in [AGENT-REVIEW.md](AGENT-REVIEW.md). Model opinions inform changes; actual rendered and adversarial browser checks determine readiness.
