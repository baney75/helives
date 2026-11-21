"""Independent check: library/bible/bsb/*.toml against the official bsb.txt.

Usage: python3 -I pipeline/bsb/crosscheck.py [--seed N]
Reads pipeline/cache/bsb/bsb.txt (run ingest.py first; it downloads it) and the 66 book TOMLs.
It shares no parsing code with ingest.py. Exit code 1 on any problem.

For every line of bsb.txt the TOML verse text, after removing [^x] markers and * and collapsing
whitespace, must equal the bsb.txt text after the same normalization. A verse that bsb.txt lists
with empty text (omitted from the BSB, e.g. Matthew 17:21) must be absent from the TOML.
"""
from __future__ import annotations

import random
import re
import sys
import tomllib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TXT = ROOT / "pipeline" / "cache" / "bsb" / "bsb.txt"
BSB = ROOT / "library" / "bible" / "bsb"
ZIP = ROOT / "pipeline" / "cache" / "bsb" / "bsb_usfm.zip"
REF = re.compile(r"^(.+) (\d+):(\d+)$")
CODES = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER "
    "LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL "
    "EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split()


def norm(s: str) -> str:
    s = re.sub(r"\[\^[^\]]*\]", "", s).replace("*", "")
    return " ".join(s.split())


def load_txt() -> tuple[list[str], dict[tuple[int, int, int], str]]:
    books: list[str] = []
    verses: dict[tuple[int, int, int], str] = {}
    lines = TXT.read_text(encoding="utf-8-sig").splitlines()
    for i, line in enumerate(lines[3:], 4):
        ref, sep, text = line.partition("\t")
        m = REF.match(ref.strip())
        if not sep or not m:
            raise SystemExit(f"bsb.txt line {i}: cannot parse {line[:60]!r}")
        name = m.group(1)
        if not books or books[-1] != name:
            if name in books:
                raise SystemExit(f"bsb.txt line {i}: book {name} reappears")
            books.append(name)
        key = (len(books), int(m.group(2)), int(m.group(3)))
        if key in verses:
            raise SystemExit(f"bsb.txt line {i}: duplicate {ref}")
        verses[key] = text
    return books, verses


def main(argv: list[str]) -> int:
    seed = int(argv[argv.index("--seed") + 1]) if "--seed" in argv else random.randrange(1 << 30)
    books, src = load_txt()
    problems: list[str] = []
    toml_verses: dict[tuple[int, int, int], str] = {}
    toml_chapters: dict[int, int] = {}
    toml_notes: dict[int, int] = {}
    conts = 0
    files = sorted(BSB.glob("*.toml"))
    for f in files:
        with open(f, "rb") as fh:
            doc = tomllib.load(fh)
        w = doc["work"]
        bn = w["book_number"]
        if not f.name.startswith(f"{bn:02d}-"):
            problems.append(f"{f.name}: book_number {bn} does not match file name")
        secs = doc["section"]
        toml_chapters[bn] = len(secs)
        toml_notes[bn] = sum(1 for s in secs for b in s["blocks"] if b["t"] == "note")
        nv = 0
        for ci, s in enumerate(secs, 1):
            if s["id"] != str(ci):
                problems.append(f"{f.name}: section {s['id']} out of order (expected {ci})")
            last = 0
            prev_v = None
            for b in s["blocks"]:
                if b["t"] != "v":
                    continue
                if b.get("cont"):
                    # a verse continued after a heading inside it: must follow a block of the same n
                    if prev_v is None or b["n"] != prev_v:
                        problems.append(f"{f.name} {ci}:{b['n']}: cont block does not follow verse {b['n']}")
                    else:
                        toml_verses[(bn, ci, b["n"])] += " " + b["text"]
                        conts += 1
                    continue
                prev_v = b["n"]
                nv += 1
                if b["n"] <= last:
                    problems.append(f"{f.name} {ci}:{b['n']}: verse number not increasing")
                last = b["n"]
                key = (bn, ci, b["n"])
                if key in toml_verses:
                    problems.append(f"{f.name} {ci}:{b['n']}: duplicate verse")
                toml_verses[key] = b["text"]
        if w.get("chapters") != len(secs):
            problems.append(f"{f.name}: work.chapters {w.get('chapters')} != {len(secs)} sections")
        if w.get("verses") != nv:
            problems.append(f"{f.name}: work.verses {w.get('verses')} != {nv} verse blocks")

    src_chapters: dict[int, int] = {}
    for (bn, c, _v) in src:
        src_chapters[bn] = max(src_chapters.get(bn, 0), c)
    if len(files) != 66 or len(books) != 66:
        problems.append(f"books: {len(files)} TOML files, {len(books)} books in bsb.txt (want 66)")
    for bn in range(1, len(books) + 1):
        if toml_chapters.get(bn) != src_chapters.get(bn):
            problems.append(f"{books[bn-1]}: {toml_chapters.get(bn)} chapters in TOML, {src_chapters.get(bn)} in bsb.txt")

    mismatches: list[str] = []
    omitted: list[str] = []
    for key, text in src.items():
        name = f"{books[key[0]-1]} {key[1]}:{key[2]}"
        if not text.strip():
            omitted.append(name)
            if key in toml_verses:
                mismatches.append(f"{name}: empty in bsb.txt but present in TOML: {toml_verses[key]!r}")
            continue
        if key not in toml_verses:
            mismatches.append(f"{name}: missing from TOML")
            continue
        a, b = norm(toml_verses[key]), norm(text)
        if a != b:
            i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
            mismatches.append(f"{name}: differs at char {i}\n  toml: ...{a[max(0,i-40):i+60]!r}\n  txt:  ...{b[max(0,i-40):i+60]!r}")
    for key in toml_verses.keys() - src.keys():
        mismatches.append(f"{books[key[0]-1] if key[0] <= len(books) else key[0]} {key[1]}:{key[2]}: in TOML but not in bsb.txt")

    # every USFM footnote (\f ... \f*) must survive as a note block, counted per book
    usfm_notes: dict[int, int] = {}
    with zipfile.ZipFile(ZIP) as z:
        for name in z.namelist():
            code = Path(name).stem
            if name.endswith(".usfm") and code in CODES:
                usfm_notes[CODES.index(code) + 1] = z.read(name).decode("utf-8-sig").count("\\f ")
    note_problems = [
        f"{books[bn-1]}: {toml_notes.get(bn)} notes in TOML, {usfm_notes.get(bn)} footnotes in USFM"
        for bn in range(1, 67) if toml_notes.get(bn) != usfm_notes.get(bn)
    ]
    problems += note_problems

    nonempty = sum(1 for t in src.values() if t.strip())
    print(f"books: {len(files)} TOML, {len(books)} bsb.txt")
    print(f"chapters: {sum(toml_chapters.values())} TOML, {sum(src_chapters.values())} bsb.txt")
    print(f"verses: {len(src)} lines in bsb.txt ({nonempty} with text, {len(omitted)} empty/omitted); {len(toml_verses)} verse blocks in TOML")
    print(f"omitted in BSB (empty in bsb.txt, absent in TOML): {', '.join(omitted)}")
    print(f"footnotes: {sum(toml_notes.values())} note blocks in TOML, {sum(usfm_notes.values())} \\f in USFM; books differing: {len(note_problems)}")
    print(f"cont blocks (verse continued after a heading) joined before comparing: {conts}")
    print(f"mismatches: {len(mismatches)}")
    for m in mismatches[:50]:
        print("  " + m)
    for p in problems:
        print("problem: " + p)

    rng = random.Random(seed)
    print(f"\n10 random verses (seed {seed}):")
    keys = sorted(k for k in src if src[k].strip() and k in toml_verses)
    for key in rng.sample(keys, 10):
        print(f"\n{books[key[0]-1]} {key[1]}:{key[2]}")
        print(f"  toml:    {toml_verses[key]}")
        print(f"  bsb.txt: {src[key]}")

    ok = not mismatches and not problems and len(files) == 66 and sum(toml_chapters.values()) == 1189
    print(f"\ncrosscheck: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
