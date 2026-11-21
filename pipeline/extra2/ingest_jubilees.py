"""Ingest the Book of Jubilees in R. H. Charles' translation (London: SPCK, 1917).

Usage: python3 -I pipeline/extra2/ingest_jubilees.py [--report]
Text: the sacred-texts.com transcription of the 1917 SPCK edition (archive.sacred-texts.com/bib/jub,
pages jub11 to jub87, cached in pipeline/cache/extra2/jub-arch/). Verse numbers the transcription lost
are restored from the OCR of the archive.org scan of the 1917 printing (bookofjubileesor01char), and
the text is then measured against that OCR with pipeline/extra2/verify.py.

Kept: the prologue, every chapter and verse, Charles' section headings with their chapter ranges,
his brackets and italics. Dropped: the introduction, the footnotes and the marginal Anno Mundi dates.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from common import apply_corrections, files_sha256, gaps, guard, renumber_cont, repair, roman  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from ia import ocr  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402
from stext import LINE, extract  # noqa: E402

PAGES = [CACHE / "jub-arch" / f"jub{i:02d}.htm" for i in range(11, 88)]
SCAN = "bookofjubileesor01char"
OUT = LIBRARY / "pseudepigrapha" / "jubilees.toml"
RANGE_LINE = re.compile(r"^\(?[ivxlc]+\.\s*[\d\-, ]+.*\)\.?$", re.I)
MARK = re.compile(r"(?:(?<=[\s\[(\"'\ue000])|^)(?:(\d{1,2})|([IVXL]+))\.(?:\s|(?=\ue000)|$)")

# Transcription slips fixed before verse splitting: (page, transcription, printed text), checked on the scan.
# The last three are misprints in the 1917 book itself (pages 49, 62 and 138 of the scan): the verse
# number is put right so that the verse is numbered as its place requires; the words are untouched.
PRE_FIXES = [("jub20", "V1. And on the new moon", "VI. And on the new moon"),
             ("jub15", "32. And God cursed the serpent", "23. And God cursed the serpent"),
             ("jub20", "rooted out. 15 And He gave", "rooted out. 15. And He gave"),
             ("jub56", "19. Fear not, mother", "10. Fear not, mother"),
             ("jub31", "after Hebron. 11 And it came to pass", "after Hebron. 13. And it came to pass"),  # transcription slip
             ("jub31", "unto the mountain . . . 3 Bethel", "unto the mountain . . . Bethel")]  # footnote mark 3
# Checked against the scan; (section, transcription, printed text).
CORRECTIONS: list[tuple[str, str, str]] = [
    ("2", "He hath hidden us to keep the Sabbath", "He hath bidden us to keep the Sabbath"),
    ("8", "and of the whole cast, it turneth", "and of the whole east, it turneth"),
    ("9", "And Sherri also divided", "And Shem also divided"),
]
DATE_LINE = re.compile(r"^[\dI ]+A\.M\.?$")  # a marginal Anno Mundi date that lost its table


def strip_stale_numbers(sections, log):
    """Where the transcription mistyped a verse number ("21," "26:" "9") and the verse was then
    restored from the scan, drop the leftover numeral; text after it moves into that verse."""
    for s in sections:
        vs = [b for b in s["blocks"] if b["t"] == "v"]
        for k, b in enumerate(vs[:-1]):
            nxt = next((x for x in vs[k + 1:] if x["n"] != b["n"]), None)
            if nxt is None:
                continue
            m = re.search(r"(?:^|\s)(\d{1,2})[.,:]?(\.{3,}[^.]{0,20})?$", b["text"])
            if not m or int(m.group(1)) != nxt["n"]:
                continue
            b["text"] = b["text"][:m.start()].rstrip()
            if m.group(2):
                nxt["text"] = m.group(2).strip() + " " + nxt["text"]
            log.append(f"stale number {s['id']}:{nxt['n']} removed after verse {b['n']}")
        s["blocks"] = [b for b in s["blocks"] if b["t"] != "v" or b["text"]]


def build():
    sections = [{"id": "prologue", "title": "Prologue", "level": 1, "blocks": []}]
    cur = sections[0]
    chapter, last = 0, 0
    pending: list[dict] = []
    for path in PAGES:
        blocks = extract(path, lines=True)
        for pg, old, new in PRE_FIXES:
            if pg == path.stem:
                hit = [b for b in blocks if old in b["text"]]
                if len(hit) != 1:
                    raise SystemExit(f"pre-fix not applied once: {pg} {old!r}")
                hit[0]["text"] = hit[0]["text"].replace(old, new)
        for i, b in enumerate(blocks):
            if b["kind"] == "h":
                if b["level"] == 1 or b["text"].lower() == "prologue":
                    continue
                pending.append({"t": "h", "level": 3, "text": b["text"]})
                continue
            text = b["text"]
            if DATE_LINE.match(text.replace(LINE, " ").strip()):
                continue
            if b["center"] and RANGE_LINE.match(text) and pending:
                pending[-1]["text"] += " " + text
                continue
            if chapter == 0 and not re.match(r"^1\.\s", text):
                cur["blocks"].append({"t": "p", "text": text})
                continue
            pos, out = 0, []
            ch, lv = chapter, last  # state as the markers are read
            for m in MARK.finditer(text):
                if m.group(1):
                    n = int(m.group(1))
                    ok = ch > 0 and lv < n <= lv + 3
                    if ch == 0 and n == 1 and m.start() == 0:
                        ok = True
                    new_ch = ch == 0
                else:
                    try:
                        r = roman(m.group(2))
                    except KeyError:
                        continue
                    ok = r == ch + 1
                    n, new_ch = 1, True
                if not ok:
                    continue
                ch, lv = (ch + 1, 1) if new_ch else (ch, n)
                out.append((text[pos:m.start()], None))
                out.append((None, (n, new_ch)))
                pos = m.end()
            out.append((text[pos:], None))
            for seg, mark in out:
                if mark:
                    n, new_ch = mark
                    if new_ch:
                        chapter += 1
                        cur = {"id": str(chapter), "title": f"Chapter {chapter}", "level": 1, "blocks": []}
                        sections.append(cur)
                    cur["blocks"].extend(pending)
                    pending = []
                    cur["blocks"].append({"t": "v", "n": n, "text": ""})
                    last = n if not new_ch else 1
                    continue
                seg = seg.strip(" " + LINE)
                if not seg:
                    continue
                tail = cur["blocks"][-1] if cur["blocks"] else None
                if tail and tail["t"] == "v":
                    tail["text"] = (tail["text"] + " " + seg).strip()
                elif tail and tail["t"] == "p":
                    tail["text"] += " " + seg
                else:
                    raise SystemExit(f"{path.name}: text with no verse: {seg[:60]}")
    if pending:
        raise SystemExit("headings left over at the end")
    for s in sections:
        out = []
        for b in s["blocks"]:
            if b["t"] == "v" and not b["text"]:
                continue
            if b["t"] != "v" or LINE not in b["text"]:
                b["text"] = b["text"].replace(LINE, " ")
                out.append(b)
                continue
            for k, line in enumerate(b["text"].split(LINE)):  # poetry: one block per printed line
                nb = {"t": "v", "n": b["n"], "text": line.strip(), "indent": 1}
                if k:
                    nb["cont"] = True
                out.append(nb)
        for b in out:
            if b["t"] == "p":
                b["text"] = b["text"].replace(LINE, " ")
        s["blocks"] = out
    return sections


def main(argv):
    sections = build()
    log: list[str] = []
    repair(sections, ocr(SCAN), log)
    strip_stale_numbers(sections, log)
    apply_corrections(sections, CORRECTIONS, log)
    renumber_cont(sections)
    left = list(gaps(sections))
    m = meta("jub-arch/jub11.htm")
    work = {
        "id": "jubilees",
        "title": "The Book of Jubilees",
        "short_title": "Jubilees",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 2,
        "date": "2nd century BC (Charles dates it between 109 and 105 BC)",
        "language": "Ge'ez (Ethiopic), from a Hebrew original; Latin and Hebrew fragments",
        "translator": "R. H. Charles",
        "edition": "The Book of Jubilees, or The Little Genesis, translated by R. H. Charles, with an introduction by G. H. Box (London: SPCK, 1917), Translations of Early Documents, Series I",
        "source_url": "https://archive.sacred-texts.com/bib/jub/index.htm",
        "source_sha256": files_sha256(PAGES),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": f"Published in London by the Society for Promoting Christian Knowledge in 1917; in the public domain in the United States because it was published before 1931. Text checked against the archive.org scan of the 1917 printing ({SCAN}).",
        "summary": "A Jewish retelling of Genesis and the first part of Exodus, revealed by an angel to Moses on Sinai and dated by a calendar of jubilees, with stress on the Law, the Sabbath and a solar year of 364 days. It is canonical in the Ethiopian Orthodox Tewahedo Church and is outside the Protestant and Catholic canons. It is not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    nv = sum(1 for s in sections for b in s["blocks"] if b["t"] == "v")
    print(f"sections {len(sections)}, verse blocks {nv}, restored {sum(1 for x in log if x.startswith('restored'))}, gaps left {len(left)}")
    for si, a, k in left:
        print("gap", sections[si]["id"], a, k)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
