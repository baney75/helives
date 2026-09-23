# Genesis narration production record

The public, exact-text transcript for the September 23, 2026 recording session is
[higgsfield-narration-2026-09-23.json](higgsfield-narration-2026-09-23.json)
(SHA-256 `1877685fee52b10eef04fe4abd98305a87fa20446662547490c827ba3e5cedcf`).
It preserves the 44 ordered canonical voice texts, cue roles and Fall actions, scene text,
source-file hashes, and KJV verification links. It contains no account or result
URLs. The bound working copy and submission ledger are excluded from Git under
`demo/2d-refresh/`.

The voice was Higgsfield's **Cillian** preset
`d8ba9f14-8a24-44db-932b-99e16c45bd32`, using model `text2speech_v2` with
the `elevenlabs` variant. The 44 individual takes assembled into 13 Genesis
scene masters and one trailer master. Cue boundaries were measured from
normalized mono 44.1 kHz PCM files; the public masters are mono 44.1 kHz MP3.
The import script is `scripts/import-higgsfield-audio.mjs` (`dry-run`, `stage`,
`promote`). It requires exact manifest, submitted-text, job, and source-hash
bindings before staging or promotion. The paid source takes, normalized cues,
staged masters, receipts, and pre-promotion backup remain locally under the
ignored `demo/audio-staging/higgsfield-2d/1877685fee52b10e/` directory.

To rebuild a transcript from the current TypeScript source, run
`node scripts/prepare-higgsfield-narration.mjs`. It writes
`demo/2d-refresh/narration-manifest.generated.json` and deliberately cannot
overwrite the bound session manifest. The generated transcript currently
reproduces all 44 canonical texts and scene text; its citation metadata follows
the corrected `src/genesis/scenes.ts` citations.

All 44 selected takes were checked with local speech recognition. Ambiguous archaic
words were rechecked with a larger model. This is an automated words check, not a
human listening certification. Fall cue `fall-03` was replaced after both initial
transcripts rendered “ye” as “you.” The selected retake uses the pronunciation-only
alias `ye` → `yee` (/jiː/); the 51-word canonical KJV cue and displayed text remain
unchanged. An aligned transcript of the selected take matches all 51 words. The
importer permits only this explicit alias and records the synthesis-text hash
alongside the unchanged canonical-text hash. The reviewed override is saved in
[fall-03-pronunciation.json](fall-03-pronunciation.json).

The following SHA-256 values identify the final public masters.

| Master | Current SHA-256 |
| --- | --- |
| beginning.mp3 | `f22615d8f99d6168172c12b998470c1ecc1793c829f4894cc8e11b394bad5665` |
| day1.mp3 | `70a9e156fcf17c769d6f0d2adf93ebee650fada25aa20a8817d3816977423a51` |
| day2.mp3 | `dc8dfd23ea852a928a228a4dc64d625f5fa50b949b20587543bcde78f09228d5` |
| day3.mp3 | `bd881fc2e110e4695464974f7bd1daeebf62426119a7ea44debfb6e94467aaf4` |
| day4.mp3 | `1c8b3022b8b6d36513bee09a21298abdbb20b649bc6dd537116ccfd91476d4c0` |
| day5.mp3 | `17458e10ef143a198d7021821210e5cb699cc32d5c9bb2b36681bb5d67a5601c` |
| day6.mp3 | `44ddec8ec287277e80b2a7c5002439125e068c2cbb05457964f09079ff27ccfe` |
| day7.mp3 | `0ec437fa21ca4d5fdefb4e17dc843146ec491defbc3ffb60d4b83e2de072eda4` |
| garden.mp3 | `04f8c9ba665324813c6ce8aadc6daa4e299f173573fa90c290d9b623833d96cc` |
| fall.mp3 | `ebc8b8eea7fa10b139a127947cd0cc345d3203a1bb45d3e71e83061f80b9036f` |
| closing.mp3 | `ae0b87158d9d25b3d5a83c10d2d19c368c1c7a22c9ea95bcf96ab7ed74b84d10` |
| doubt.mp3 | `6e2c3d4aa330bd4dcaf9a25163d63675dcf68395fa7362c93595ebeb11d000c4` |
| measure.mp3 | `57df4cc74ff3b9e9b583fb58685c970381e671c808fb3f62b33090cbc520dbb5` |
| trailer.mp3 | `210a5b2da05d0c11105dcf7c4fd84a0b0f4c3858f4882da7d01e98f6a3751891` |
