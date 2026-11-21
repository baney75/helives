"""Scan library TOMLs for CCEL navigation and table-of-contents debris.

Flags a block when it
  - carries CCEL catalog metadata (a /ccel/ path, an .html link, or a "workID versionID" pair such as
    "autolycus_ii anf02"), or
  - belongs to a run of 4+ consecutive short p/h blocks that are only chapter-style titles
    ("Chapter I.—...", "Book II", "Homily III", ...), the shape of a contents list.

Usage: python3 -I pipeline/ccel/debris.py [dir ...]   (default: the four CCEL collections)
Exit status 1 when anything is flagged.
"""
from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "library"
META = re.compile(r"/ccel/|\.html\b|\b[a-z]+_[a-z0-9_]+ (?:anf|npnf[12])\d\d\b")
TITLE = re.compile(r"^(?:chapter|chap|book|homily|letter|epistle|sermon|tractate|lecture|oration|section|question|article)\.?\s+[ivxlcdm\d]+\b[.\s—:-]", re.I)


def scan(path: Path) -> list[str]:
    doc = tomllib.loads(path.read_text())
    out = []
    for s in doc.get("section", []):
        run = []
        for b in s["blocks"] + [{"t": "end", "text": ""}]:
            if b["t"] != "note" and META.search(b["text"]):
                out.append(f"{s['id']}: metadata: {b['text'][:100]}")
            if b["t"] in ("p", "h") and TITLE.match(b["text"]) and len(b["text"].split()) <= 25:
                nxt = True
            else:
                nxt = False
            if nxt and (not run or run[-1][0] in ("p", "h")):
                run.append((b["t"], b["text"]))
                continue
            # a contents list: 4+ titles in a row with no body paragraph between them
            if len(run) >= 4 and sum(1 for t, _ in run if t == "p") >= 2:
                out.append(f"{s['id']}: contents list of {len(run)} titles: {run[0][1][:60]} ...")
            run = []
    return out


def main(argv):
    dirs = [Path(a) for a in argv] or [ROOT / c for c in ("apostolic", "ante-nicene", "nicene", "aquinas") if (ROOT / c).is_dir()]
    works = 0
    for d in dirs:
        for f in sorted(d.rglob("*.toml")) if d.is_dir() else [d]:
            hits = scan(f)
            if hits:
                works += 1
                print(f"{f.relative_to(ROOT)}: {len(hits)}")
                for h in hits[:5]:
                    print("   ", h)
    print(f"works with debris: {works}")
    return 1 if works else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
