"""Fetch the OCR text (djvu.txt) of an archive.org scan, cached under pipeline/cache/extra2/ia/.

Usage: python3 -I pipeline/extra2/ia.py <identifier> [<identifier> ...]
The OCR is used only to check an electronic text against the printed page, never as the text itself
unless a work's script says so.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch import CACHE, fetch  # noqa: E402


def ocr(ident: str) -> str:
    meta = json.loads(fetch(f"ia/{ident}.json", f"https://archive.org/metadata/{ident}").read_text())
    names = [f["name"] for f in meta.get("files", []) if f["name"].endswith("_djvu.txt")]
    if not names:
        raise SystemExit(f"{ident}: no djvu.txt")
    return fetch(f"ia/{ident}_djvu.txt", f"https://archive.org/download/{ident}/{names[0]}").read_text(encoding="utf-8", errors="replace")


def ocr_path(ident: str) -> Path:
    ocr(ident)
    return CACHE / "ia" / f"{ident}_djvu.txt"


if __name__ == "__main__":
    for i in sys.argv[1:]:
        try:
            t = ocr(i)
            print(i, len(t.split()), "words")
        except Exception as e:  # noqa: BLE001
            print("FAILED", i, e)
