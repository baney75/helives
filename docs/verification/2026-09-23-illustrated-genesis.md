# Illustrated Genesis verification — September 23, 2026

The active Genesis route now renders thirteen original SVG scenes animated with JavaScript. The retained Three.js and Blender sources are not imported by the route. The local Worker preview uses the production security headers.

## Checked behavior

- 187 app tests and six narration-tooling tests passed. TypeScript, Oxlint, production build, and diff whitespace checks passed.
- `verify-refresh.mjs` passed against `http://127.0.0.1:8787`: five site routes at 375/1280, 24 scene-midpoint/long-cue samples at each width, and compact 653×508 at DPR 2. Passage text, citations and controls clear the dock. Long passages scroll within their reading area.
- `verify-genesis-readiness.mjs` passed against that Worker: all thirteen scenes, no WebGL attempts or GLB requests, opt-in voice, pause/seek/mute, reduced motion, and native reading-dialog focus/escape. Both browser reports contain zero page errors.
- A complete narrated run at 4× visited all thirteen scenes in order and reached Replay. Every scene audio element reached its end. This playback check preceded the last static foliage drawing change; final rendered-scene checks followed that change.
- KJV source fixtures check the restored verses against independently entered source text. Original invitation and cosmology commentary remain labeled separately.
- All 44 selected voice takes received local speech-recognition checks. Ambiguous archaic words were rechecked, and the Fall pronunciation repair preserves the canonical words. See [audio provenance](../audio/HIGGSFIELD-NARRATION.md) for the scope, exact transcript, synthesis alias, and final master hashes.

## Local evidence

`demo/refresh/checks.json`, `demo/readiness/result.json`, and `demo/2d-refresh/full-playback.json` contain the browser receipts. Screenshots are under `demo/refresh/` and `demo/readiness/`. Voice audit files and the private generation ledger stay under ignored `demo/2d-refresh/`; source audio and previous masters stay under ignored `demo/audio-staging/`.

## Final Genesis build assets

- `GenesisIllustration-Qhl-qoaB.css` — SHA-256 `bc2465b26724a024c1e47eec45598996b11463dbaf6a343b84c080ac5bd57f66`
- `GenesisIllustration-DaX0q1S0.js` — SHA-256 `9734a5aaeecd9cdd4e2795f49f091ad9bd53c28ecca39e9054eafc7f4732896d`
- `GenesisPage-DiIUxNOG.css` — SHA-256 `0866923883f35157abfcfa49de02d4ff52c90503882d2de32529cdb814d7baa1`
- `GenesisPage-C8zvynH0.js` — SHA-256 `3e835375d99b1267631f7e1269542c06a777a36a09846b7b740f8fbba92e36cf`

Independent fresh-context GPT-6 Sol critic: **VERDICT: PASS** after inspection of the final snapshot. The review identified and verified repairs for pre-Fall clothing, figure grounding, long-passage overlap, the reduced-motion proof, and the Fall pronunciation discrepancy. The same Sol review passed the prose and proposed commit message against the Ship skill. This record describes local verification; it is not a production deployment receipt.
