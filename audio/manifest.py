"""Writes audio/manifest.json from staged audiobook files. Called by publish.sh.

A section is listed only when its file is complete and every chunk passed the Whisper check.
A section with a flagged chunk (best take kept after every attempt failed) is held back, so the
site never offers Listen for audio that failed verification.

    python3 audio/manifest.py <stage> <url-prefix> <out>
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time


def collect(stage: str, prefix: str) -> tuple[list[dict], list[str], list[str]]:
    """Returns (items, skipped, held): listed sections, incomplete files, sections with flagged chunks."""
    prefix = prefix.strip("/")
    items, skipped, held = [], [], []
    for work in sorted(os.listdir(stage)):
        wdir = os.path.join(stage, work)
        if not os.path.isdir(wdir):
            continue
        for name in sorted(os.listdir(wdir)):
            if not name.endswith(".json"):
                continue
            with open(os.path.join(wdir, name), encoding="utf-8") as f:
                meta = json.load(f)
            audio = os.path.join(wdir, meta["audio"])
            if not os.path.exists(audio) or os.path.getsize(audio) != meta["bytes"]:
                skipped.append(f"{work}/{meta['audio']}")  # mid-copy or re-rendering; next run picks it up
                continue
            if meta.get("flagged_chunks", 0):
                held.append(f"{work}/{meta['audio']} ({meta['flagged_chunks']} flagged)")
                continue
            h = hashlib.sha256()
            with open(audio, "rb") as f:
                for block in iter(lambda: f.read(1 << 20), b""):
                    h.update(block)
            items.append({"work": meta["work"], "section": meta["section"], "title": meta.get("title"),
                          "url": f"{prefix}/{work}/{meta['audio']}", "timing": f"{prefix}/{work}/{name}",
                          "duration": meta["duration"], "bytes": meta["bytes"], "sha256": h.hexdigest()})
    return items, skipped, held


def write(stage: str, prefix: str, out: str) -> dict:
    items, skipped, held = collect(stage, prefix)
    manifest = {"schema": 1, "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "stage": "staged, not uploaded",
                "files": len(items), "hours": round(sum(i["duration"] for i in items) / 3600, 2), "items": items}
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, out)
    print(f"staged {len(items)} files ({manifest['hours']} h) in {stage}; manifest {out}")
    if skipped:
        print("incomplete, skipped:", ", ".join(skipped))
    if held:
        print("held for review, flagged chunks:", ", ".join(held))
    return manifest


if __name__ == "__main__":
    write(*sys.argv[1:4])
