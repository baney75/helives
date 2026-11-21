"""Ingest the Hymn of the Robe of Glory (Hymn of the Pearl) in G. R. S. Mead's 1908 version.

Usage: python3 -I pipeline/extra/ingest_hymn.py
Reads pipeline/extra/transcriptions/hymn-robe-of-glory-1908.txt, a line-by-line transcription made from
the page images of the archive.org scan (see the file header), and writes library/gnostic/hymn-of-the-pearl.toml.
Only the Hymn itself (pp. 15-29) is taken; Mead's introduction and comments are not.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, sha256_file, write_work  # noqa: E402

SRC = HERE / "transcriptions" / "hymn-robe-of-glory-1908.txt"


def main() -> int:
    blocks: list[dict] = []
    verses = []
    for raw in SRC.read_text(encoding="utf-8").splitlines():
        if raw.startswith("# ") or raw == "#" or not raw.strip():
            continue
        if raw.startswith("#"):
            verses.append(int(raw[1:]))
            continue
        if raw.startswith("= "):
            blocks.append({"t": "h", "text": raw[2:].strip()})
            continue
        indent = (len(raw) - len(raw.lstrip(" "))) // 2
        b = {"t": "q", "text": raw.strip()}
        if indent:
            b["indent"] = min(indent, 3)
        blocks.append(b)
    expected = [n for n in range(1, 106) if n != 68]  # the print has no verse 68 (p. 24)
    assert verses == expected, "verse markers out of order"
    m = meta("hrg1908.txt")
    work = {
        "id": "hymn-of-the-pearl",
        "title": "The Hymn of the Robe of Glory (The Hymn of the Pearl)",
        "short_title": "Hymn of the Pearl",
        "author": "gnostic-anonymous",
        "collection": "gnostic",
        "order": 2,
        "date": "2nd to 3rd century (preserved in the Syriac Acts of Thomas)",
        "language": "Syriac",
        "translator": "G. R. S. Mead",
        "edition": "G. R. S. Mead, The Hymn of the Robe of Glory, Echoes from the Gnosis, Vol. X "
                   "(London and Benares: Theosophical Publishing Society, 1908), pp. 15-29",
        "source_url": "https://archive.org/details/MeadGRSEchoesFromTheGnosisVolXTheHymnOfTheRobeOfGlory1908",
        "source_sha256": sha256_file(SRC),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": "Published 1908 (London); published before 1931, so in the public domain in the United States",
        "summary": "A Syriac poem embedded in the Acts of Thomas: a king's son sent down to Egypt to win a pearl "
                   "from a serpent forgets his mission until a letter from his father wakes him. Gnostic readers "
                   "took it as an allegory of the soul; it is a historical document of a movement the early church rejected.",
    }
    sections = [{"id": "the-hymn", "title": "The Hymn", "level": 1, "blocks": blocks}]
    path = write_work(LIBRARY / "gnostic" / "hymn-of-the-pearl.toml", work, sections)
    print("wrote", path.relative_to(LIBRARY.parent), len(blocks), "blocks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
