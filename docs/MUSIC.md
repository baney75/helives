# He Lives music

Music is optional on the rotating Scripture, reading pages, and Genesis. Every fresh load starts silent. Press **Music off** to begin, **Music on** to stop; Settings contains volume. Genesis lowers the music level so narration remains prominent. Leaving the tab pauses music and requires another click to restart.

The player lives above the router and rotating verse. Verse rollover and internal navigation preserve playback. No music request occurs before consent. Playback consent is never saved in localStorage or a cookie. Music and narration controls are independent.

## Current collection

Ten user-supplied MP3 recordings were imported from Downloads on September 7, 2026. The originals remain untouched. The mastered versions are local static assets in `public/audio/music/`; exact source hashes, names, durations and mastering details are in `music-provenance.json`.

The first track is **Where the Light Rests**. Settings lets the visitor choose any track. The next recording prepares in the final 30 seconds, then blends in over the final six seconds. The collection returns to the first track. Manual changes blend over 1.2 seconds. At most two recordings play during a handoff; combined gain stays bounded. Track selection while off does not start playback. Each recording is mastered toward -23 LUFS / -3 dBTP, stereo 44.1 kHz, MP3 160 kbps. The player begins at 35% volume. No external audio host or API is used during playback.

The earlier 96-second programmatic **Stillness** study is retained only in local staging, along with its reproducible `scripts/compose-stillness.py` source. It is not in the public playlist.

## Adding the finished instrumentals

The ten copyable prompts are in `music-prompts.html`. All are suitable for the rotating Scripture; the scene titles suggest mood, not an instruction to change music on every verse. Keep narration space, soft dynamics, and no human or synthetic vocals. Listen to the actual exports before adding them: prompting alone does not guarantee instrumental output.

1. Retain the original export locally. Master a stereo MP3 at roughly -23 LUFS, no louder than -3 dBTP. Listen for abrupt endings and audible loop joins.
2. Put the mastered file in `public/audio/music/` with a stable lowercase filename.
3. Add its id, title, filename, and accurate credit to `src/music/catalog.ts`. Multiple entries automatically reveal the track picker. The first entry is the default; only existing files belong in the catalog.
4. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `node scripts/verify-brand-music.mjs` against the Worker preview. Update the verification fixture filename if replacing a track.

For Creative Commons recordings, retain the original work URL, creator, license URL/version, download date, and modifications in this file before release. Choose terms compatible with the site and provide required visible attribution. No Creative Commons recording has been imported in this change.

## 1min.ai narration

The existing `scripts/generate-audio.mjs` uses 1min.ai TEXT_TO_SPEECH with tts-1-hd and server-side production credentials from `.env.local`. It generates static narration assets; visitors never call the API and no key enters the frontend. `pnpm audio --sample` rebuilds a narration sample, reusing the paid cache when present. Existing narration is retained; the public music is the user-supplied collection.

Documentation checked September 7, 2026:
- https://docs.1min.ai/docs/api/ai-for-audio/text-to-speech/openai
- https://ai.google.dev/gemini-api/docs/music-generation
