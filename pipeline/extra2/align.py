"""Word alignment between a work's verse blocks and the OCR of the printed edition.

Used to restore verse numbers that an electronic transcription dropped but the printed page shows,
and to measure how closely the text matches the scan. Standard library only.
"""
from __future__ import annotations

import difflib
import re
import unicodedata

WORD = re.compile(r"[A-Za-z0-9]+")
# OCR misreads of digits in verse numbers ("ro" for 10, "rz" for 11, "1g" for 19, "I" for 1).
DIGITISH = str.maketrans({"l": "1", "I": "1", "i": "1", "r": "1", "o": "0", "O": "0", "z": "2", "Z": "2",
                          "g": "9", "q": "9", "s": "5", "S": "5", "b": "6", "B": "8", "t": "1"})


def fold(s: str) -> str:
    """One output char per input char: strip accents, keep length so offsets stay valid."""
    out = []
    for ch in s:
        d = unicodedata.normalize("NFKD", ch)
        base = d[0] if d else ch
        if base in "æÆ":
            base = "e"
        out.append(base if ord(base) < 128 else " ")
    return "".join(out)


def words_with_pos(text: str) -> list[tuple[str, int]]:
    """Lowercase ASCII words of text with their start offsets (markup asterisks are skipped)."""
    f = fold(text)
    return [(m.group().lower(), m.start()) for m in WORD.finditer(f)]


def ocr_tokens(raw: str) -> list[tuple[str, str]]:
    """OCR words as (normalized, raw-with-trailing-punct); hyphenated line breaks are rejoined."""
    raw = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", raw)
    f = fold(raw)
    out = []
    for m in WORD.finditer(f):
        tail = f[m.end():m.end() + 1]
        out.append((m.group().lower(), m.group() + tail))
    return out


def as_number(raw: str) -> int | None:
    """Return the verse number an OCR token like '7.', 'ro.', '1g.' stands for, else None."""
    core = raw.rstrip(".,:;")
    if not core or len(core) > 3:
        return None
    if core.isdigit():
        return int(core)
    if not raw.endswith((".", ",")):
        return None
    t = core.translate(DIGITISH)
    return int(t) if t.isdigit() else None


def align(ours: list[str], theirs: list[str]) -> list[int]:
    """For each index in ours, the matched index in theirs or -1."""
    sm = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
    m = [-1] * len(ours)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            m[blk.a + k] = blk.b + k
    return m


def match_percent(ours: list[str], theirs: list[str]) -> tuple[int, int, float]:
    sm = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
    matched = sum(b.size for b in sm.get_matching_blocks())
    return matched, len(ours), matched / max(1, len(ours))
