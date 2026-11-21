"""Cross-check the KJV Apocrypha works against an independent electronic text.

Usage: python3 -I pipeline/extra2/check_kjv_apocrypha.py [min_run]
Compares each book's words, in order, with Project Gutenberg ebook 124 (Robert Kraft's KJV Apocrypha,
archive.org copy deuterocanonical00124gut/apoc10.txt, cached as pipeline/cache/extra2/pg124-apoc10.txt).
Prints the share of our words matched in order, and every differing run of at least min_run words.
"""
from __future__ import annotations

import difflib
import re
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from fetch import CACHE  # noqa: E402
from libtoml import LIBRARY  # noqa: E402

PG = CACHE / "pg124-apoc10.txt"
LABELS = {"1-esdras": ["1Esdr"], "2-esdras": ["2Esdr"], "tobit": ["Tob"], "judith": ["Jdt"],
          "rest-of-esther": ["AddEsth"], "wisdom-of-solomon": ["Wis"], "ecclesiasticus": ["Sir"],
          "baruch": ["Bar", "EpJer"], "susanna": ["Sus"], "bel-and-the-dragon": ["Bel"],
          "1-maccabees": ["1Mac"], "2-maccabees": ["2Mac"]}
REGIONS = {"song-of-the-three-children": ("The Prayer of Azariah\n", "The Prayer of Manasseh\n"),
           "prayer-of-manasses": ("[The Prayer of Manasses King of Judah]", "The Book of Bel and the Dragon")}


def words(s: str) -> list[str]:
    s = re.sub(r"\[\^[^\]]+\]", " ", s).replace("’", "'")
    return re.findall(r"[a-z0-9]+", s.lower())


def gutenberg() -> tuple[dict[str, str], str]:
    raw = PG.read_text(encoding="latin-1")
    by: dict[str, list[str]] = {}
    for m in re.finditer(r"^(\S+) \d+:\d+ *\n(.*?)(?=\n\S+ \d+:\d+ *\n|\n\n\n|\Z)", raw, re.M | re.S):
        by.setdefault(m.group(1), []).append(m.group(2))
    return {k: "\n".join(v) for k, v in by.items()}, raw


def main(argv: list[str]) -> int:
    min_run = int(argv[0]) if argv else 3
    by, raw = gutenberg()
    total_m = total_n = 0
    for path in sorted((LIBRARY / "apocrypha" / "kjv").glob("*.toml"), key=lambda p: tomllib.load(open(p, "rb"))["work"]["order"]):
        doc = tomllib.load(open(path, "rb"))
        slug = path.stem
        ours = words("\n".join(b["text"] for s in doc["section"] for b in s["blocks"] if b["t"] == "v"))
        if slug in LABELS:
            theirs = words("\n".join(by.get(lab, "") for lab in LABELS[slug]))
        else:
            a, b = REGIONS[slug]
            i = raw.rfind(a)
            j = raw.find(b, i + len(a))
            theirs = words(raw[i + len(a):j])
        sm = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
        matched = sum(x.size for x in sm.get_matching_blocks())
        total_m += matched
        total_n += len(ours)
        print(f"{slug}: ours {len(ours)} words, gutenberg {len(theirs)}, matched in order {matched} ({matched / len(ours):.2%})")
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op != "equal" and max(i2 - i1, j2 - j1) >= min_run:
                print(f"   [{op}] OURS: {' '.join(ours[i1:i2])[:160]}\n          PG:   {' '.join(theirs[j1:j2])[:160]}")
    print(f"ALL: {total_m}/{total_n} ({total_m / total_n:.2%})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
