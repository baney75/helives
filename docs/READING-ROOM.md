# Reading room

September 7, 2026. Home changes KJV passages every 60 seconds after arrival. Each manual Next starts a full minute. Pause freezes both reading and ambient motion; hidden tabs preserve remaining reading time. The initial passage retains the existing clock-based selection; subsequent passages walk the entire curated pool before repeating.

TV mode enlarges and centers Scripture. Controls fade after six seconds and return with pointer movement or a key. Tab focus keeps controls visible. Escape exits. The direct URL is `/?display=1`; fullscreen and screen wake lock are optional browser capabilities, with the display layout available independently. Arrow keys change passages and Space pauses when focus is outside an interactive control.

Music starts off each fresh visit. Ten supplied instrumental recordings blend over six seconds at natural handoffs, independently of Scripture changes. See MUSIC.md for provenance and mastering. Hiding the tab stops music; returning requires explicit opt-in again.

Light, water and vine drawings use SVG and CSS. Motion pauses offscreen and respects reduced-motion settings. Home does not load the Genesis WebGL scene.

Verification: `node scripts/verify-reading-room.mjs` against Wrangler preview tests real media, minute timing, pause/next, TV idle/recovery and 40 consecutive passages at phone, desktop, HD and 4K sizes. `node scripts/verify-brand-music.mjs` retains media failure/retry, navigation, longest-passage controls and branding checks. `node scripts/verify-refresh.mjs` checks broader site behavior. Evidence stays in local demo/.
