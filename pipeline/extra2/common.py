"""Helpers shared by the Pseudepigrapha ingests: verse gaps, OCR verse-number repair, text corrections."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest_enoch import gaps, repair  # noqa: E402,F401  (same logic as 1 Enoch)
from stext import guard  # noqa: E402,F401

ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def roman(s: str) -> int:
    total, prev = 0, 0
    for ch in reversed(s.upper()):
        v = ROMAN[ch]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def apply_corrections(sections, corrections, log):
    """corrections: (section id or "*", old, new); each must hit at least one block."""
    for sid, old, new in corrections:
        hit = 0
        for s in sections:
            if sid not in ("*", s["id"]):
                continue
            for b in s["blocks"]:
                if old in b["text"]:
                    b["text"] = b["text"].replace(old, new)
                    hit += 1
        log.append(f"correction {sid}: {old!r} -> {new!r} ({hit} blocks)")
        if not hit:
            raise SystemExit(f"correction not applied: {sid} {old!r}")


def files_sha256(paths) -> str:
    h = hashlib.sha256()
    for p in paths:
        h.update(Path(p).read_bytes())
    return h.hexdigest()


def renumber_cont(sections):
    for sec in sections:
        cur = None
        for b in sec["blocks"]:
            if b["t"] != "v":
                continue
            if b.get("cont") and cur is not None:
                b["n"] = cur
            cur = b["n"]
