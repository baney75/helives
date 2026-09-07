# Brand and background music acceptance

User requested refined He Lives branding, programmatic tools, 1min.ai audio support, ten instrumental Lyria prompts, and background music that starts off until clicked. Latest clarification: music also accompanies the rotating hourly Scripture. User directed import of ten MP3s from Downloads. Preserve those originals.

Visual direction: existing night, gold and parchment; unframed cross with one dawn point; consistent local fonts. Home remains a single hourly reading composition. Controls should remain quiet and visible.

Acceptance: one vector master across interface/favicon/app/share; locally served real instrumental MP3s; zero music request/play before click; keyboard on/off; volume and track selection; no restart during hourly rollover or internal navigation; fresh reload silent; one active recording; failed fetch can retry; hidden tab stops music; narrow and short viewport controls are visible. Preserve Genesis narration, KJV copy, routing and Worker headers.

Evidence: demo/brand-music/, demo/refresh/, demo/brand-music-tests.log, demo/brand-music-build.log. Production-style preview: http://127.0.0.1:8787. Run pnpm test, pnpm typecheck, pnpm lint, pnpm build; node scripts/verify-brand-music.mjs and node scripts/verify-refresh.mjs.

Forbidden: weakening tests/security, fake silent audio, lost originals, exposed API keys, self-approving as the independent critic, claiming awards or deployment without evidence.
