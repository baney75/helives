"""Prepare Donovan's recordings of the daily gate's prayers (public/gate-voice/).

Takes a folder holding lords-prayer, apostles-creed and illumination (Voice Memos .m4a, .wav or .mp3)
and the gate's lines (scripts/gate-lines.mjs). Evens the loudness, encodes .m4a, and times each line
with the whisper command, so the gate can light it. The voice itself is never changed. RUNBOOK.md has
the commands.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hear  # noqa: E402

MODEL = "large-v3-turbo"
WER_MAX = 0.10   # above this the recording is probably the wrong prayer, or cut short
LINE_MIN = 0.5   # each line needs at least this share of its words heard, so no line is skipped


def anchors(lines: list[str]) -> list[list]:
    """[["b0", word index], ...]: where each line begins in the part's running text."""
    out, at = [], 0
    for j, line in enumerate(lines):
        out.append([f"b{j}", at])
        at += len(line.split())
    return out


def timing(section: str, lines: list[str], words: list[dict], duration: float) -> dict:
    """The timing file for one part; refuses a recording that does not match its lines."""
    ref = " ".join(lines)
    wer = hear.score(ref, [w["word"] for w in words])["wer"]
    if wer > WER_MAX:
        raise ValueError(f"{section}: {wer:.0%} of the words differ from the gate's text")
    ref_words, src = hear.norm_words(ref.split())
    hyp = hear.norm_words([w["word"] for w in words])[0]
    hit = [j is not None and hyp[j] == t for t, j in zip(ref_words, hear.align(ref_words, hyp).ref_to_hyp)]
    ends = [at for _, at in anchors(lines)][1:] + [len(ref.split())]
    for (_, at), end, line in zip(anchors(lines), ends, lines):
        got = [h for h, k in zip(hit, src) if at <= k < end]
        if sum(got) < LINE_MIN * len(got):
            raise ValueError(f"{section}: the line {line!r} was not heard")
    starts = hear.anchor_times(ref, anchors(lines), words, duration)
    items = [{"id": a, "kind": "block", "start": max(0.0, round(starts[a] - 0.15, 3))} for a, _ in anchors(lines)]
    return {"section": section, "duration": round(duration, 3), "wer": round(wer, 4), "items": items}


def main(src: Path, lines_json: Path, out: Path) -> None:
    import subprocess
    import tempfile

    import assemble
    if src.resolve() == out.resolve():
        raise SystemExit("the output folder must not be the recordings folder")
    parts = json.loads(lines_json.read_text(encoding="utf-8"))
    files = {}
    for p in parts:
        found = [f for f in src.iterdir() if f.stem == p["section"] and f.suffix.lower() in (".m4a", ".wav", ".mp3")]
        if len(found) != 1:
            raise SystemExit(f"need exactly one recording named {p['section']} in {src}")
        files[p["section"]] = found[0]
    out.mkdir(parents=True, exist_ok=True)
    for p in parts:
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "in.wav"
            subprocess.run([assemble.FFMPEG, "-nostdin", "-v", "error", "-i", str(files[p["section"]]),
                            "-map_metadata", "-1", "-ac", "1", "-ar", "48000", str(wav)], check=True)
            subprocess.run(["whisper", str(wav), "--model", MODEL, "--language", "en", "--word_timestamps", "True",
                            "--output_format", "json", "--output_dir", tmp, "--verbose", "False"], check=True)
            heard = json.loads((Path(tmp) / "in.json").read_text(encoding="utf-8"))
            words = [{"word": w["word"].strip(), "start": w["start"], "end": w["end"]}
                     for seg in heard["segments"] for w in seg["words"]]
            t = timing(p["section"], p["lines"], words, assemble.sf.info(str(wav)).duration)
            assemble.loudnorm_encode(wav, out / f"{p['section']}.m4a")
        (out / f"{p['section']}.json").write_text(json.dumps(t, indent=1) + "\n", encoding="utf-8")
        print(p["section"], f"{t['duration']:.1f}s", f"words differing {t['wer']:.1%}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: gate_voice.py <recordings folder> <lines.json> <output folder>")
    main(*(Path(a) for a in sys.argv[1:]))
