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


def spelling_variant(ours: str, printed: str) -> bool:
    """True when two words differ only as American and British spellings (a closed list of patterns)."""
    a, b = ours.lower(), printed.lower()
    if a == b:
        return False
    if a.replace("iz", "is") == b:                       # recognize, recognise
        return True
    for x, y in (("ense", "ence"), ("practic", "practis"), ("steadfast", "stedfast")):
        if a.replace(x, y) == b:
            return True
    if len(a) >= 5 and a.replace("or", "our") == b:   # honor, honour (not for, four)
        return True
    for k in range(1, len(a)):                         # traveling, travelling; skillful, skilful
        c = a[k - 1]
        if (c == "l" or (c == "p" and a[k:].startswith(("ing", "ed", "er")))) and a[:k] + c + a[k:] == b:
            return True
        if c == "l" and a[k] == "l" and a[:k] + a[k + 1:] == b:
            return True
    return False


def ocr_spelling(sections, raw: str, log: list[str]) -> None:
    """Restore the printed spelling where an e-text modernized it: one-word differences that the OCR
    of the printed page shows as the British form of the same word."""
    import difflib
    import re as _re
    from align import ocr_tokens, words_with_pos
    ours, owner = [], []
    for si, s in enumerate(sections):
        for bi, b in enumerate(s["blocks"]):
            if b["t"] not in ("v", "p"):
                continue
            for w, pos in words_with_pos(b["text"]):
                ours.append(w)
                owner.append((si, bi, pos, len(w)))
    theirs = [n for n, _ in ocr_tokens(raw)]
    sm = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
    edits = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "replace" and i2 - i1 == 1 and j2 - j1 == 1 and spelling_variant(ours[i1], theirs[j1]):
            edits.append((owner[i1], theirs[j1]))
    for (si, bi, pos, n), printed in sorted(edits, key=lambda e: (e[0][0], e[0][1], -e[0][2])):
        b = sections[si]["blocks"][bi]
        old = b["text"][pos:pos + n]
        new = printed[:1].upper() + printed[1:] if old[:1].isupper() else printed
        b["text"] = b["text"][:pos] + new + b["text"][pos + n:]
        log.append(f"spelling {sections[si]['id']}:{b.get('n', '')} {old} -> {new}")
    del _re
