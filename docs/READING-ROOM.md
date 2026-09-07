# Reading room

September 7, 2026. Home changes KJV passages every 60 seconds after arrival. Each manual Next starts a full minute. Pause freezes both reading and ambient motion; hidden tabs preserve remaining reading time. The initial passage retains the existing clock-based selection; subsequent passages walk the entire curated pool before repeating.

TV mode enlarges and centers Scripture. Controls fade after six seconds and return with pointer movement or a key. Tab focus keeps controls visible. Escape exits. The direct URL is `/?display=1`; fullscreen and screen wake lock are optional browser capabilities, with the display layout available independently. Arrow keys change passages and Space pauses when focus is outside an interactive control.

Music starts off each fresh visit. Ten supplied instrumental recordings blend over six seconds at natural handoffs, independently of Scripture changes. See MUSIC.md for provenance and mastering. Hiding the tab stops music; returning requires explicit opt-in again.

78 original SVG illustrations cover every book and twelve specific passages, with the home background matched to the current passage. Drawings dissolve over 2.2 seconds and move on a varied 86–110-second camera cycle through Motion’s mini API. Motion pauses offscreen and respects reduced-motion settings. The Scriptures page opens each book illustration in a keyboard-accessible viewer with optional one-minute collection playback. Caption text has a separate lower artwork margin; TV mode reserves a darker reading area. Home does not load the Genesis WebGL scene. See art/README.md for generation, provenance and the budget ledger.

Verification: `node scripts/verify-reading-room.mjs` against Wrangler preview tests real media, minute timing, pause/next, TV idle/recovery and 40 consecutive passages at phone, desktop, HD and 4K sizes. `node scripts/verify-brand-music.mjs` retains media failure/retry, navigation, longest-passage controls and branding checks. `node scripts/verify-refresh.mjs` checks broader site behavior. Evidence stays in local demo/.
