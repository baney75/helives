"""Ingest the Ascension of Isaiah in R. H. Charles' translation from the Ethiopic (London: A. and C. Black, 1900).

Usage: python3 -I pipeline/extra2/ingest_ascension.py [--report]
Text: the Early Christian Writings transcription (earlychristianwritings.com/text/ascension.html, cached in
pipeline/cache/extra2/ecw/ascension.html), one paragraph per verse with "CHAPTER N" lines. It is checked
word by word against the OCR of two archive.org scans of the 1900 book (cu31924014590529 and
ascensionofisaia00unse); verse numbers the transcription lost are restored from the scans, and its
typing slips are put right from the page images (CORRECTIONS). Charles' notes and his parallel Greek,
Latin and Slavonic texts are not included.
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from common import apply_corrections, files_sha256, gaps, guard, ocr_spelling, repair  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from ia import ocr  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

SRC = CACHE / "ecw" / "ascension.html"
OUT = LIBRARY / "pseudepigrapha" / "ascension-of-isaiah.toml"
SCANS = ("cu31924014590529", "ascensionofisaia00unse")
EM = "—"
# Checked against the 1900 scans; (section, transcription, printed text).
CORRECTIONS: list[tuple[str, str, str]] = [
    ("1", "reign of Hezediah", "reign of Hezekiah"),
    ("1", "As the Lord liveth, and th3e Spirit", "As the Lord liveth, whose name has not been sent into this world, and as the Beloved of my Lord liveth, and the Spirit"),
    ("2", "fornication, a [and adultery]", "fornication, [and adultery]"),
    ("2", "John of Anathoth, an by", "John of Anathoth, and by"),
    ("2", "into the had of Leba Nasr", "into the hand of Leba Nasr"),
    ("2", "brother of Zedekiah\u2014when they persuaded", "brother of Zedekiah\u2014when they had heard, they persuaded"),
    ("3", "had come and captive", "had come and captured Samaria and taken the nine (and a half) tribes captive"),
    ("3", "and the torturers wherewith", "and the tortures wherewith"),
    ("3", "forsake the teachings of the Twelve", "forsake the teaching of the Twelve"),
    ("3", "of their own hearts", "of their own heart"),
    ("4", "he will descent from", "he will descend from"),
    ("4", "will come and there will come and there will come", "will come and there will come"),
    ("4", "And they greater number", "And the greater number"),
    ("4", "give rest of the godly", "give rest to the godly"),
    ("4", "the sun wil be", "the sun will be"),
    ("4", "the things of earth and the things of earth", "the things of earth"),
    ("4", "written in three parables", "written in the parables"),
    ("4", "Haggai and Malachi", "Haggai and Zephaniah and Zechariah and Malachi"),
    ("5", "Damned and accused be thou and all they powers", "Damned and accursed be thou and all thy powers"),
    ("5", "I will turn their hearts", "I will turn their heart"),
    ("6", "and Macaiah and the aged", "and Micaiah and the aged"),
    ("6", "who rest among His", "who rests among His"),
    ("6", "taken form him", "taken from him"),
    ("7", "on high [though the (various)", "on high [through the (various)"),
    ("7", "a grater also that I am", "a greater also than I am"),
    ("7", "ont he earth", "on the earth"),
    ("7", "those who were out he left", "those who were on the left"),
    ("7", "from the haven to the earth", "from the heaven to the earth"),
    ("7", "but he angel who conducted me", "but the angel who conducted me"),
    ("7", "conduct thee j\u2014until", "conduct thee\u2014until"),
    ("7", "And he raise me", "And he raised me"),
    ("7", "how it is know,", "how it is known,"),
    ("7", "they praised and glory of him", "they praised and the glory of him"),
    ("7", "the height from the third to the height from the third to the forth heaven", "the height from the third to the fourth heaven"),
    ("7", "greater glory that those of the forth heaven", "greater glory than those of the fourth heaven"),
    ("7", "on the several heaves", "on the several heavens"),
    ("8", "manifested he shall be", "manifested He who shall be"),
    ("9", "He who forbade thee, is he", "He who forbade thee, this is he"),
    ("9", "Beloved will descent in the form", "Beloved will descend in the form"),
    ("9", "see Him descent [will descent, I say]", "see Him descend [will descend, I say]"),
    ("1", "eternal judgments and torments", "eternal judgements and the torments"),
    ("*", "judgment", "judgement"),  # the 1900 printing spells it so throughout
    ("9", "was on he left of", "was on the left of"),
    ("10", "descent through all", "descend through all"),
    ("10", "wilt descent to the", "wilt descend to the"),
    ("10", "that Thou art with Me of the seven", "that Thou art Lord with Me of the seven"),
    ("10", "that you mayest judge", "that you mayst judge"),
    ("10", "Isaiah, and see the transformation", "Isaiah, and see how the transformation"),
    ("10", "into the forth heaven", "into the fourth heaven"),
    ("11", "named Mary, and Virgin", "named Mary, a Virgin"),
    ("11", "did not approach May", "did not approach Mary"),
    ("11", "Mary straight-way looked", "Mary straightway looked"),
    ("11", "astonished", "astonied"),
    ("11", "was noised broad in", "was noised abroad in"),
    ("11", "indeed I was Him", "indeed I saw Him"),
    ("11", "it is enough for thee;... for thou", "it is enough for thee; for these are great things; for thou"),
    ("11", "in order they ye may", "in order that ye may"),
    ("11", "the son of Amoz, the prophet, by the hand", "the son of Amos, the prophet, by the hand"),
]
# 9:7 to 9:9 as printed (p. 61): the transcription lost verse 7, numbered Abel's verse 7 and typed Enoch's twice.
NINE = {7: "And there I saw all the righteous from the time of Adam.",
        8: "And there I saw the holy Abel and all the righteous."}


def paragraphs() -> list[str]:
    raw = SRC.read_text(encoding="latin-1")
    start = raw.find("<h1 align=center>The Ascension of Isaiah</h1>")
    end = raw.find("Go to the <a href=", start)
    if start < 0 or end < 0:
        raise SystemExit("text bounds not found")
    body = raw[start:end]
    body = body[body.find("</h1>") + 5:]
    guard(body, SRC.name)
    out = []
    for p in re.findall(r"(?is)<p[^>]*>(.*?)</p>", body):
        p = re.sub(r"(?i)<br\s*/?>", " ", p)
        p = re.sub(r"(?i)</?i>", "*", p)
        p = html.unescape(re.sub(r"<[^>]+>", "", p))
        p = p.replace("`", "'").replace("--", EM)
        p = re.sub(r"\s+", " ", p).strip()
        p = re.sub(r"\s+-\s*|(?<=\w)-\s+", EM, p)  # a spaced hyphen is the printed dash
        p = re.sub(r"\*\s*\*", "", p)
        if p:
            out.append(p)
    return out


def build():
    sections, cur, last = [], None, 0
    for p in paragraphs():
        m = re.fullmatch(r"CHAPTER (\d+)", p)
        if m:
            k = int(m.group(1))
            if k != len(sections) + 1:
                raise SystemExit(f"chapter {k} out of order")
            cur = {"id": str(k), "title": f"Chapter {k}", "level": 1, "blocks": []}
            sections.append(cur)
            last = 0
            continue
        if cur is None:
            raise SystemExit(f"text before chapter 1: {p[:60]}")
        m = re.match(r"(\d{1,2})\.\s*", p)
        if m and last < int(m.group(1)) <= last + 3:
            last = int(m.group(1))
            cur["blocks"].append({"t": "v", "n": last, "text": p[m.end():]})
        elif last == 0:
            last = 1
            cur["blocks"].append({"t": "v", "n": 1, "text": p})
        else:
            cur["blocks"][-1]["text"] += " " + p
    if len(sections) != 11:
        raise SystemExit(f"{len(sections)} chapters, expected 11")
    return sections


def scan_region(ident: str) -> str:
    raw = ocr(ident)
    i = raw.find("twenty-sixth year")
    j = raw.find("Here endeth the vision", i)
    if i < 0 or j < 0:
        raise SystemExit(f"{ident}: text not found in OCR")
    return raw[i - 200:j + 80]


def main(argv):
    sections = build()
    log: list[str] = []
    for ident in SCANS:
        repair(sections, scan_region(ident), log)
    nine = sections[8]["blocks"]
    vs = [b for b in nine if b["t"] == "v" and b["n"] in (7, 8, 9)]
    if [b["n"] for b in vs] != [7, 8, 9] or vs[1]["text"] != vs[2]["text"] or "Abel" not in vs[0]["text"]:
        raise SystemExit("chapter 9 verses 7 to 9 not as expected")
    vs[0]["text"], vs[1]["text"] = NINE[7], NINE[8]
    log.append("chapter 9: verses 7 and 8 set as printed")
    left = list(gaps(sections))
    apply_corrections(sections, CORRECTIONS, log)
    if "--spelling" in argv:
        ocr_spelling(sections, scan_region(SCANS[0]), log)
    m = meta("ecw/ascension.html")
    work = {
        "id": "ascension-of-isaiah",
        "title": "The Ascension of Isaiah",
        "short_title": "Ascension of Isaiah",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 5,
        "date": "1st to 2nd century AD (a Jewish account of Isaiah's martyrdom joined with Christian visions)",
        "language": "Ge'ez (Ethiopic), from a lost Greek original; Greek, Latin and Slavonic fragments",
        "translator": "R. H. Charles",
        "edition": "The Ascension of Isaiah, translated from the Ethiopic version by R. H. Charles (London: Adam and Charles Black, 1900)",
        "source_url": "https://www.earlychristianwritings.com/text/ascension.html",
        "source_sha256": files_sha256([SRC]),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": f"Published in London by Adam and Charles Black in 1900; in the public domain in the United States because it was published before 1931. Text checked against two archive.org scans of the 1900 printing ({SCANS[0]}, {SCANS[1]}).",
        "summary": "An account of the martyrdom of the prophet Isaiah, sawn in two under King Manasseh, joined to a Christian vision in which Isaiah is taken up through the seven heavens and sees the descent and ascent of the Beloved. It is outside the Jewish, Protestant and Catholic canons and is kept here for history and study. It is not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    nv = sum(1 for s in sections for b in s["blocks"] if b["t"] == "v")
    print(f"sections {len(sections)}, verses {nv}, restored {sum(1 for x in log if x.startswith('restored'))}, gaps left {len(left)}")
    for si, a, k in left:
        print("gap", sections[si]["id"], a, k)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
