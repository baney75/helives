"""Ingest the Psalms of Solomon in G. Buchanan Gray's translation, from Charles' Apocrypha and
Pseudepigrapha of the Old Testament, vol. 2 (Oxford: Clarendon Press, 1913).

Usage: python3 -I pipeline/extra2/ingest_psalms_solomon.py [--report]
Text: The Forgotten Books of Eden (ed. R. H. Platt, 1926), as transcribed at sacred-texts.com
(archive.sacred-texts.com/bib/fbe, pages fbe177 to fbe194, cached in pipeline/cache/extra2/fbe-arch/),
which reprints Gray's translation line for line without verse numbers. Platt's own italic headnotes
are dropped; the psalm titles, the verse numbers and the words are taken from or checked against the
OCR of two archive.org scans of APOT vol. 2. A verse number counts only where the scan prints it at the
start of a line, in sequence. Gray's parentheses and brackets for supplied words, which the reprint
leaves out, are not restored.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from align import DIGITISH, WORD, fold, words_with_pos  # noqa: E402
from common import apply_corrections, files_sha256, gaps, guard, ocr_spelling  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from ia import ocr  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402
from stext import LINE, extract  # noqa: E402

import difflib  # noqa: E402

PAGES = [CACHE / "fbe-arch" / f"fbe{n}.htm" for n in range(177, 195)]
SCANS = ("apocryphapseudep0002unse", "apocryphapseudep0002rhch_w1w3")
OUT = LIBRARY / "pseudepigrapha" / "psalms-of-solomon.toml"
# The superscriptions as APOT prints them (read from both OCRs; psalm 1 has none).
TITLES = {
    2: "A Psalm. Of Solomon. Concerning Jerusalem.",
    3: "A Psalm. Of Solomon. Concerning the righteous.",
    4: "A Conversation of Solomon with the Men-pleasers.",
    5: "A Psalm. Of Solomon.",
    6: "In Hope. Of Solomon.",
    7: "Of Solomon. Of turning.",
    8: "Of Solomon. Of the chief Musician.",
    9: "Of Solomon. For rebuke.",
    10: "A Hymn. Of Solomon.",
    11: "Of Solomon. Unto expectation.",
    12: "Of Solomon. Against the tongue of transgressors.",
    13: "Of Solomon. A Psalm. Comfort for the righteous.",
    14: "A Hymn. Of Solomon.",
    15: "A Psalm. Of Solomon. With a Song.",
    16: "A Hymn. Of Solomon. For Help to the Pious.",
    17: "A Psalm. Of Solomon. With Song. Of the King.",
    18: "A Psalm. Of Solomon. Again of the Anointed of the Lord.",
}
# Checked against the scans; (section, reprint, printed text).
CORRECTIONS: list[tuple[str, str, str]] = [
    ("1", "would never fan.", "would never fall."),
    ("2", "were m grievous captivity", "were in grievous captivity"),
    ("2", "will ~e upon them that fear Him, m the Judgement", "will be upon them that fear Him, in the Judgement"),
    ("2", "for what he bath done", "for what he hath done"),
    ("5", "aught of a that Thou", "aught of all that Thou"),
    ("8", "God bare their sins", "God laid bare their sins"),
    ("8", "the judgments of God", "the judgements of God"),
    ("8", "his neighhour's wife", "his neighbour's wife"),
    ("8", "For Thou are the God", "For Thou art the God"),
    ("9", "u on our faces", "upon our faces"),
    ("13", "that of a first-born.", "that of a firstborn."),
    ("15", "The first fruits of the lips", "The firstfruits of the lips"),
    ("16", "well-nigh poured out", "wellnigh poured out"),
]
# Verse numbers neither OCR gives at a line start, read on the page images (pp. 637 to 650): (psalm,
# verse, first words of the line). Where APOT prints a number inside a line (5. 7, 16. 2, 16. 3, 17. 26),
# the verse is started at that line.
NUMBERS: list[tuple[int, int, str]] = [
    (4, 14, "He deceiveth with words"),
    (4, 15, "He fills one house with lawlessness"),
    (5, 7, "O God, when we are in distress"),
    (8, 25, "They did according to their uncleanness"),
    (9, 8, "And in Thy righteousness Thou visitest"),
    (10, 2, "He that maketh ready his back"),
    (10, 3, "For He maketh straight the ways"),
    (10, 4, "And the mercy of the Lord is upon them"),
    (10, 5, "For the testimony is in the law"),
    (10, 6, "Just and kind is our Lord"),
    (10, 7, "And the pious shall give thanks"),
    (10, 8, "For good and merciful is God"),
    (11, 2, "Cause ye to be heard in Jerusalem"),
    (11, 3, "Stand on the height, O Jerusalem"),
    (12, 3, ". . . to fill houses"),
    (16, 2, "When I was far from God"),
    (16, 3, "When my soul departed from the Lord"),
    (16, 8, "And let not the beauty"),
    (17, 26, "Wisely, righteously"),
]
# Lines APOT prints without a number that an OCR number from a nearby line could otherwise claim (p. 643).
UNNUMBERED: list[tuple[int, str]] = [(10, "The salvation of the Lord be upon the house of Israel")]
# Psalms whose numbers come only from NUMBERS: the OCR numbers there fall on the wrong lines (p. 643).
MANUAL_ONLY = {10}
# APOT prints no verse 6 in Psalm 13 (p. 645: "5 (6)", then "(7)", then "7 (8)"); kept as printed.
PRINTED_GAPS = {("13", 6)}
# Lines where the 1926 reprint departs from APOT, read on the page images: (psalm, reprint line, APOT line).
# In 12. 2 and 12. 3 Platt filled Gray's marked omissions with words from Gray's notes (p. 644).
LINE_FIXES: list[tuple[int, str, str]] = [
    (12, "Even as among a people a fire that burneth up their beauty.", "Even as . . . a fire that burneth up . . ."),
    (12, "So he delights to fill houses with a lying tongue,", ". . . to fill houses with a lying tongue,"),
    (12, "To cut down the trees of gladness which setteth on fire transgressors,", "To cut down the trees of gladness . . ."),
    (18, "Against the day of choice when", "Against the day of choice when He bringeth back His anointed."),  # p. 652
]
# Printed lines the reprint breaks in two: (psalm, first part, second part).
JOINS: list[tuple[int, str, str]] = [
]
# Lines the reprint leaves out: (psalm, line before, line). None found.
INSERTS: list[tuple[int, str, str]] = [
]


def psalm_lines() -> list[list[str]]:
    out = []
    for path in PAGES:
        blocks = extract(path, lines=True)
        if blocks[0]["kind"] != "h" or LINE in blocks[1]["text"]:
            raise SystemExit(f"{path.name}: unexpected layout")
        lines = []
        for b in blocks[2:]:  # blocks[1] is Platt's headnote
            if b["kind"] != "p":
                raise SystemExit(f"{path.name}: unexpected heading {b['text'][:40]}")
            for ln in b["text"].split(LINE):
                ln = ln.replace("*", "").strip()
                if ln:
                    lines.append(ln)
        out.append(lines)
    for ps, old, new in LINE_FIXES:
        lines = out[ps - 1]
        if lines.count(old) != 1:
            raise SystemExit(f"line fix not found once: {ps} {old!r}")
        lines[lines.index(old)] = new
    for ps, a, b in JOINS:
        lines = out[ps - 1]
        i = lines.index(a)
        if lines[i + 1] != b:
            raise SystemExit(f"join not found: {ps} {a!r}")
        lines[i:i + 2] = [a + " " + b]
    for ps, before, new in INSERTS:
        lines = out[ps - 1]
        if lines.count(before) != 1:
            raise SystemExit(f"insert anchor not found once: {ps} {before!r}")
        lines.insert(lines.index(before) + 1, new)
    return out


def ocr_words(raw: str):
    """(word, raw token, at line start) for the OCR, hyphenated line breaks rejoined."""
    raw = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", raw)
    f = fold(raw)
    out = []
    for m in WORD.finditer(f):
        before = f[f.rfind("\n", 0, m.start()) + 1:m.start()]
        # at a line start, after a psalm number, or after a parenthesized alternative number;
        # never a number that is itself in parentheses
        start = bool(re.fullmatch(r"[^\w(]*(?:\d{1,2}\s+)?(?:\(\s*\w{1,2}\s*\)[^\w(]*)?", before)) \
            and not before.rstrip().endswith("(")
        out.append((m.group().lower(), m.group(), start))
    return out


def verse_number(tok: str) -> int | None:
    """A line-start OCR token as a verse number; letters the OCR puts for digits are read as digits."""
    if len(tok) > 2:
        return None
    t = tok.translate(DIGITISH)
    return int(t) if t.isdigit() else None


def scan_region(ident: str) -> str:
    raw = ocr(ident)
    i = raw.find("I cried unto the Lord when I was in distress")
    j = raw.find("by the command of His servants", i)
    if i < 0 or j < 0:
        raise SystemExit(f"{ident}: Psalms of Solomon not found")
    return raw[i - 40:j + 400]


def numbers_from_scan(psalms, ident, found):
    toks = ocr_words(scan_region(ident))
    theirs = [t[0] for t in toks]
    ours, where = [], []
    for p, lines in enumerate(psalms):
        for li, ln in enumerate(lines):
            for w, _ in words_with_pos(ln):
                ours.append(w)
                where.append((p, li))
    sm = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
    m = [-1] * len(ours)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            m[blk.a + k] = blk.b + k
    first = {}
    for i, key in enumerate(where):
        first.setdefault(key, i)
    for (p, li), i in first.items():
        if li == 0:
            continue
        j_cur = next((m[x] for x in range(i, min(i + 3, len(m))) if where[x] == (p, li) and m[x] >= 0), -1)
        j_prev = next((m[x] for x in range(i - 1, max(i - 4, -1), -1) if m[x] >= 0), -1)
        if j_cur < 0:
            continue
        lo = j_prev + 1 if j_prev >= 0 and j_cur - j_prev < 12 else j_cur - 3
        # a psalm number is followed by its verse 1 ("11 1 Blow ye"); it is not a verse number
        cands = [verse_number(toks[j][1]) for j in range(max(lo, 0), j_cur)
                 if toks[j][2] and not (verse_number(toks[j][1]) == p + 2 and j + 1 < len(toks)
                                        and verse_number(toks[j + 1][1]) == 1)]
        cands = [c for c in cands if c]
        if cands:
            found.setdefault((p, li), set()).update(cands)


def build(psalms, found, log):
    sections = []
    for p, lines in enumerate(psalms):
        k = p + 1
        blocks = []
        if k in TITLES:
            blocks.append({"t": "h", "level": 3, "text": TITLES[k]})
        lv = 0
        manual = {(ps, words): v for ps, v, words in NUMBERS}
        for li, ln in enumerate(lines):
            n = None
            if li == 0:
                n = 1
            else:
                for (ps, words), v in manual.items():
                    if ps == k and ln.startswith(words):
                        n = v
                if n is None and any(ps == k and ln.startswith(w) for ps, w in UNNUMBERED):
                    n = -1
                if n is None and k not in MANUAL_ONLY:
                    ok = sorted(c for c in found.get((p, li), ()) if lv < c <= lv + 3)
                    n = ok[0] if ok else None
            if n == -1:
                n = None
            if n is not None:
                lv = n
                blocks.append({"t": "v", "n": n, "text": ln, "indent": 1})
            else:
                blocks.append({"t": "v", "n": lv, "text": ln, "indent": 1, "cont": True})
        sections.append({"id": str(k), "title": f"Psalm {k}", "level": 1, "blocks": blocks})
    return sections


def main(argv):
    psalms = psalm_lines()
    if len(psalms) != 18:
        raise SystemExit("expected 18 psalms")
    found: dict = {}
    log: list[str] = []
    for ident in SCANS:
        numbers_from_scan(psalms, ident, found)
    sections = build(psalms, found, log)
    apply_corrections(sections, CORRECTIONS, log)
    for sec in sections:
        ns = [b["n"] for b in sec["blocks"] if b["t"] == "v" and not b.get("cont")]
        if ns != sorted(set(ns)):
            raise SystemExit(f"psalm {sec['id']}: verse numbers out of order {ns}")
    left = [g for g in gaps(sections) if (sections[g[0]]["id"], g[2]) not in PRINTED_GAPS]
    used = {(ps, words) for ps, _, words in NUMBERS
            if any(b["text"].startswith(words) for b in sections[ps - 1]["blocks"] if b["t"] == "v")}
    if len(used) != len(NUMBERS):
        raise SystemExit(f"manual numbers not matched: {[x for x in NUMBERS if (x[0], x[2]) not in used]}")
    m = meta("fbe-arch/fbe177.htm")
    work = {
        "id": "psalms-of-solomon",
        "title": "The Psalms of Solomon",
        "short_title": "Psalms of Solomon",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 4,
        "date": "1st century BC (Gray dates them between 70 and 40 BC)",
        "language": "Greek and Syriac, from a lost Hebrew original",
        "translator": "G. Buchanan Gray",
        "edition": "The Psalms of Solomon, translated by G. Buchanan Gray, in The Apocrypha and Pseudepigrapha of the Old Testament in English, edited by R. H. Charles, vol. 2 (Oxford: Clarendon Press, 1913), pages 625 to 652",
        "source_url": "https://archive.sacred-texts.com/bib/fbe/index.htm",
        "source_sha256": files_sha256(PAGES),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": f"Published in Oxford by the Clarendon Press in 1913; in the public domain in the United States because it was published before 1931. The words follow the 1926 reprint in The Forgotten Books of Eden (New York: Alpha House, 1926), also published before 1931; titles, verse numbers and wording checked against two archive.org scans of the 1913 printing ({SCANS[0]}, {SCANS[1]}).",
        "summary": "Eighteen Jewish psalms written after Pompey took Jerusalem in 63 BC, lamenting the city's fall, judging the sinners of Israel and, in Psalms 17 and 18, hoping for a son of David as the Lord's Anointed. They stand in some Greek Bible manuscripts but are outside every Jewish and Christian canon and are kept here for history and study. They are not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    nv = sum(1 for s in sections for b in s["blocks"] if b["t"] == "v" and not b.get("cont"))
    print(f"psalms {len(sections)}, numbered verses {nv}, lines {sum(len(x) for x in psalms)}, gaps left {len(left)}")
    for si, a, k in left:
        print("gap", sections[si]["id"], a, k, "next line:", next((b["text"][:50] for b in sections[si]["blocks"] if b["t"] == "v" and b["n"] == a and b.get("cont")), ""))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
