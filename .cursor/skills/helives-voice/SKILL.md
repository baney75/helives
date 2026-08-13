---
name: helives-voice
description: >
  He Lives narration: ElevenLabs George, public/audio cache, fail closed, KJV vs
  original lines. Use when adding spoken scenes, running pnpm audio, or wiring
  useNarration for a later book.
---

# He Lives Voice

Voice is essential. A book that only shows text while Genesis speaks is unfinished, not a tasteful mute.

## Provider

- Script: `scripts/generate-audio.mjs` (`pnpm audio`)
- Key: `ELEVENLABS_API_KEY` in `.env.local` only. Never print it. Never commit it.
- Default voice: **George** (`JBFqnCBsd6RMkjVDRZzb` in `VOICES.george`). Override with `ELEVENLABS_VOICE_ID` locally if testing; do not change production without an explicit request.
- Model: `eleven_multilingual_v2`. Settings in the script (stability 0.72, low style). ffmpeg loudnorm + short echo when ffmpeg exists.

`pnpm audio --voices` writes A/B tests to `demo/voice-tests/` (gitignored). Do not publish those.

## Fail closed

Inventory: `src/genesis/voiced.ts` (`VOICED_IDS`). Player: `src/hooks/useNarration.ts`.

- Only request mp3s that exist and are listed.
- Worker: missing `/audio/*.mp3` must 404, not SPA HTML (`isMissingStaticAsset`).
- If ElevenLabs fails or credits are empty, leave the scene on-screen. Do not ship silence as if there were a voice. Do not 404-spam.

Cache files in `public/audio/<id>.mp3`. The generator skips existing files. Delete a file to regenerate.

## KJV vs original

Keep `src/genesis/script.ts` (and later `src/<book>/script.ts`) in sync with the generator’s `NARRATION` object.

| Kind | Source | Voice |
|------|--------|-------|
| `scripture` | KJV only | Read the KJV line. No modern-paraphrase audio. |
| `exhortation` | Original (closing, church invitation) | Same George voice. Plain, grave. Not a bit. |
| `science` | Original afterword | Same. Not a TV announcer. |

**No joke God-voice.** No cartoon serpent VO. No celebrity impressions. George is a human reader, not the voice of God.

Trailer audio is a separate id (`trailer`). Do not mark it voiced until the file exists.

## Later books

1. Write lines (KJV + exhortation).
2. Add generator entries.
3. Run `pnpm audio`.
4. Add ids to that book’s `VOICED_IDS`.
5. Wire `useNarration`.
6. Add an audio probe to the gauntlet (file exists, duration &gt; 0, no HTML body).

## Verify

```bash
pnpm test        # voiced.test.ts must stay honest
ls public/audio  # listed ids only
```

Probe: `ffprobe` or `file` on each new mp3. Player must not call play() on a null file.
