"""Compare a work's text with the OCR of the printed edition it claims to reproduce.

Usage: python3 -I pipeline/extra/compare_ocr.py <work.toml> <ocr.txt> [min_run]
Aligns lowercase word sequences (difflib) and prints the share of the work's words found in order in
the OCR, plus every differing run of at least min_run words (default 3) so a human can check the page.
OCR noise makes some runs differ; a run present in our text but absent from the scan is what matters.
"""
from __future__ import annotations

import difflib
import re
import sys
import tomllib
import unicodedata


def words(s: str) -> list[str]:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", s)  # rejoin hyphenated line breaks in OCR
    s = s.replace("æ", "ae").replace("Æ", "ae")
    return re.findall(r"[a-z0-9]+", s.lower())


def main(argv: list[str]) -> int:
    work, ocr = argv[0], argv[1]
    min_run = int(argv[2]) if len(argv) > 2 else 3
    doc = tomllib.load(open(work, "rb"))
    text = "\n".join(b["text"] for s in doc["section"] for b in s["blocks"] if b["t"] != "note")
    text = re.sub(r"\[\^[^\]]+\]", " ", text)
    a = words(text)
    b = words(open(ocr, encoding="utf-8", errors="replace").read())
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    matched = sum(bl.size for bl in sm.get_matching_blocks())
    print(f"work words {len(a)}, ocr words {len(b)}, matched in order {matched} ({matched / len(a):.2%})")
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op in ("replace", "delete") and (i2 - i1) >= min_run:
            ours = " ".join(a[i1:i2])
            theirs = " ".join(b[j1:j2]) if op == "replace" else ""
            print(f"[{op} @{i1}] OURS: {ours[:200]}\n           SCAN: {theirs[:200]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
