"""Assemble one section's chunk takes into a published audio file and timing manifest.

Concatenates the accepted (or best flagged) take of every chunk with the planned pauses,
loudness-normalizes to -18 LUFS with ffmpeg loudnorm (two passes), and encodes AAC-LC mono
48 kbps in an .m4a (faststart). Writes <section>.json beside it with the start time of every
verse (Bible) or block (prose) for read-along highlighting. Needs numpy and soundfile.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

FFMPEG = os.environ.get("HELIVES_FFMPEG", "ffmpeg")
LUFS = -18.0
TRUE_PEAK = -1.5
LRA = 11.0
BITRATE = "48k"


def concat(pieces: list[tuple[np.ndarray, int]], sr: int) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """pieces: (audio, pause_before_ms). Returns audio and (start, end) seconds per piece."""
    out, spans, pos = [], [], 0
    for audio, pause_ms in pieces:
        gap = np.zeros(int(round(sr * pause_ms / 1000)), dtype=np.float32)
        out.append(gap)
        pos += len(gap)
        start = pos
        out.append(np.asarray(audio, dtype=np.float32))
        pos += len(audio)
        spans.append((start / sr, pos / sr))
    out.append(np.zeros(int(sr * 0.5), dtype=np.float32))     # tail room
    return np.concatenate(out) if out else np.zeros(0, np.float32), spans


def loudnorm_encode(wav: Path, out: Path) -> dict:
    """Two-pass EBU R128 normalization to LUFS, then AAC-LC mono 48 kbps in .m4a."""
    first = subprocess.run(
        [FFMPEG, "-nostdin", "-hide_banner", "-i", str(wav), "-af",
         f"loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA={LRA}:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, timeout=1800)
    if first.returncode:
        raise RuntimeError("loudnorm pass 1 failed: " + first.stderr[-500:])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", first.stderr, re.S)
    if not m:
        raise RuntimeError("loudnorm pass 1 printed no measurements")
    meas = json.loads(m.group(0))
    sr = sf.info(str(wav)).samplerate
    filt = (f"loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA={LRA}:measured_I={meas['input_i']}:"
            f"measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:"
            f"measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}:linear=true:print_format=json")
    tmp = out.with_name(out.name + ".part.m4a")
    second = subprocess.run(
        [FFMPEG, "-nostdin", "-hide_banner", "-y", "-i", str(wav), "-af", filt, "-ar", str(sr), "-ac", "1",
         "-c:a", "aac", "-profile:a", "aac_low", "-b:a", BITRATE, "-movflags", "+faststart",
         "-map_metadata", "-1", str(tmp)],
        capture_output=True, text=True, timeout=1800)
    if second.returncode:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("loudnorm pass 2 failed: " + second.stderr[-500:])
    m2 = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", second.stderr, re.S)
    os.replace(tmp, out)
    result = json.loads(m2[-1]) if m2 else {}
    return {"pass1": meas, "pass2": result}


def assemble_section(section: dict, chunks: list[dict], out_dir: Path, sr: int = 24000) -> dict:
    """section: {work_id, section_id, title, spoken_title}; chunks: dicts with audio_path,
    pause_before_ms, anchors, ref_text, kind, flagged, wer, anchor_times (seconds inside the take)."""
    pieces = []
    for c in chunks:
        audio, rate = sf.read(c["audio_path"], dtype="float32", always_2d=False)
        if rate != sr:
            raise RuntimeError(f"sample rate {rate} != {sr} in {c['audio_path']}")
        pieces.append((audio, c["pause_before_ms"]))
    audio, spans = concat(pieces, sr)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = section["section_id"]
    out = out_dir / f"{stem}.m4a"
    with tempfile.TemporaryDirectory(dir=out_dir) as tmp:
        wav = Path(tmp) / "section.wav"
        sf.write(str(wav), audio, sr, subtype="PCM_16")
        loud = loudnorm_encode(wav, out)
    items, chunk_rows = [], []
    for c, (start, end) in zip(chunks, spans):
        for anchor_id, _word in c["anchors"]:
            t = start + float(c.get("anchor_times", {}).get(anchor_id, 0.0))
            kind = "verse" if anchor_id.startswith("v") else ("title" if anchor_id == "title" else "block")
            item = {"id": anchor_id, "kind": kind, "start": round(t, 3)}
            if kind == "verse":
                item["verse"] = int(anchor_id[1:])
            items.append(item)
        chunk_rows.append({"idx": c["idx"], "start": round(start, 3), "end": round(end, 3),
                           "text": c["ref_text"], "flagged": bool(c.get("flagged")), "wer": c.get("wer")})
    duration = round(len(audio) / sr, 3)
    manifest = {
        "schema": 1, "work": section["work_id"], "section": section["section_id"],
        "title": section.get("title"), "spoken_title": section.get("spoken_title"),
        "audio": out.name, "duration": duration, "bytes": out.stat().st_size,
        "loudness": {"target_lufs": LUFS, "measured_input_lufs": float(loud["pass1"]["input_i"]),
                     "output_lufs": float(loud["pass2"].get("output_i", "nan"))},
        "codec": f"AAC-LC mono {BITRATE}bps", "sample_rate": sr,
        "items": items, "chunks": chunk_rows,
        "flagged_chunks": sum(1 for c in chunks if c.get("flagged")),
    }
    tmp_json = out_dir / f".{stem}.json.tmp"
    tmp_json.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp_json, out_dir / f"{stem}.json")
    return manifest
