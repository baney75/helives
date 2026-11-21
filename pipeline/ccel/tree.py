"""Print the div tree of a cached ThML volume with word counts (analysis aid).

Usage: python3 -I pipeline/ccel/tree.py <name> [maxdepth]
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

CACHE = Path(__file__).resolve().parent.parent / "cache" / "ccel"


def words(el):
    return len(re.findall(r"\w+", "".join(el.itertext())))


def walk(el, depth, maxd, out):
    for c in el:
        if re.fullmatch(r"div\d", c.tag):
            n = int(c.tag[3])
            if n <= maxd:
                out.append(f"{'  '*(n-1)}{c.tag} {c.get('id')} [{words(c)}] {c.get('title')!r}")
                walk(c, depth + 1, maxd, out)


def main():
    name = sys.argv[1]
    maxd = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    root = ET.parse(CACHE / f"{name}.xml").getroot()
    body = root.find("ThML.body")
    out = []
    walk(body, 1, maxd, out)
    print("\n".join(out))


main()
