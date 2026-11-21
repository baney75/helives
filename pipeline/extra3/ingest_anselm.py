"""Ingest Anselm from the CCEL text of the Open Court 1903 volume into library/medieval/.

Usage: python3 -I pipeline/extra3/ingest_anselm.py          write the four works
       python3 -I pipeline/extra3/ingest_anselm.py check    compare with the 1903 scans

Source: pipeline/cache/extra3/anselm.xml (CCEL basic_works.xml), the electronic text of
"St. Anselm: Proslogium; Monologium; An Appendix in Behalf of the Fool by Gaunilon; and Cur Deus Homo",
translated by Sidney Norton Deane (Chicago: Open Court, 1903). The Cur Deus Homo in that volume is
James Gardiner Vose's translation from Bibliotheca Sacra, 1854 and 1855. The editor's introduction,
the reprinted opinions of philosophers and the bibliography are not included.
Checked word by word against two scans of the 1903 printing on archive.org: cu31924014583540 (Cornell)
and stanselmeproslog00anseuoft (Toronto).
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import ccelwork  # noqa: E402
import scancheck  # noqa: E402
from common import fix_chars, order_notes, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

CACHE = HERE.parent / "cache" / "extra3"
OUT = LIBRARY / "medieval"
SOURCE = "anselm.xml"
SCAN_A = "cu31924014583540.txt"
SCAN_B = "stanselmeproslog00anseuoft.txt"
VOLUME = ("St. Anselm: Proslogium; Monologium; An Appendix in Behalf of the Fool by Gaunilon; and Cur Deus "
          "Homo (Chicago: Open Court Publishing Company, 1903)")
SCAN_NOTE = ("Electronic text from the Christian Classics Ethereal Library, checked against the 1903 printing "
             "(archive.org cu31924014583540)")
DEANE_BASIS = ("Sidney Norton Deane's translation was published by the Open Court Publishing Company, Chicago, in "
               "1903, before 1931, so it is public domain in the United States.")
VOSE_BASIS = ("James Gardiner Vose's translation was published in Bibliotheca Sacra (Andover: Warren F. Draper) in "
              "1854 and 1855 and reprinted by the Open Court Publishing Company, Chicago, in 1903, all before 1931, so "
              "it is public domain in the United States.")
INTRO_NOTE = " The 1903 editor's introduction, reprinted opinions and bibliography are not included."

WORKS = [
    # div id, slug, title, short, author, date, translator, basis, summary
    ("iii", "anselm-proslogium", "Proslogium", "Proslogium", "anselm", "1077-1078", "Sidney Norton Deane",
     DEANE_BASIS,
     "Anselm's address to God in which he seeks a single argument for God's existence, setting out the "
     "argument from that than which nothing greater can be conceived, followed by reflections on God's "
     "attributes."),
    ("iv", "anselm-monologium", "Monologium", "Monologium", "anselm", "1076", "Sidney Norton Deane",
     DEANE_BASIS,
     "A meditation that reasons, without appeal to Scripture, to the existence of one supreme Being and "
     "then to the Trinity of Father, Son and Holy Spirit."),
    ("v.i", "gaunilo-in-behalf-of-the-fool", "In Behalf of the Fool", "In Behalf of the Fool", "gaunilo",
     "c. 1078", "Sidney Norton Deane", DEANE_BASIS,
     "Gaunilo of Marmoutier's objection to the argument of Anselm's Proslogium, comparing it to proving "
     "that a perfect island exists because it can be imagined."),
    ("v.ii", "anselm-apologetic", "Anselm's Apologetic: In Reply to Gaunilo's Answer in Behalf of the Fool",
     "Anselm's Apologetic", "anselm", "c. 1078", "Sidney Norton Deane", DEANE_BASIS,
     "Anselm's reply to Gaunilo, restating and defending the argument of the Proslogium."),
    ("vi", "anselm-cur-deus-homo", "Cur Deus Homo", "Cur Deus Homo", "anselm", "1094-1098",
     "James Gardiner Vose", VOSE_BASIS,
     "A dialogue between Anselm and his pupil Boso on why God became man, arguing that only one who is "
     "both God and man could make satisfaction for human sin."),
]
# Leading title lines printed at the head of a part, which the work title already carries.
TITLE_LINES = re.compile(r"^(APPENDIX|IN BEHALF OF THE FOOL|AN ANSWER TO THE ARGUMENT OF ANSELM IN THE PROSLOGIUM|"
                         r"BY GAUNILON, A MONK OF MARMOUTIER|ANSELM['’]S APOLOGETIC|"
                         r"IN REPLY TO GAUNILON['’]S ANSWER IN BEHALF OF THE FOOL|ANSELM['’]S PROSLOGIUM|"
                         r"OR DISCOURSE ON THE EXISTENCE OF GOD|ANSELM['’]S MONOLOGIUM.*|ANSELM['’]S CUR DEUS HOMO)\.?$")


def small_caps(text: str) -> str:
    """The printed book sets the first word of a chapter in capitals: 'UP now' becomes 'Up now'."""
    return re.sub(r"^((?:\d+\. )?)([A-Z])([A-Z]+)\b(?=[\s,;:.!?—])", lambda m: m.group(1) + m.group(2)
                  + m.group(3).lower(), text)


def chapter_title(t: str) -> str:
    t = t.strip().rstrip(".")
    m = re.search(r"Chapter (XVIII) \((a|b)\.?\)", t)
    if m:
        return f"Chapter XVIII ({m.group(2)})"
    return re.sub(r"^chapter", "Chapter", t, flags=re.I)


def sections(v, did: str) -> list:
    root = v.by_id[did]
    if did.startswith("v."):
        own = ccelwork.div_blocks(v, root)
        secs = [{"title": WORK_FIRST[did], "level": 1, "blocks": own, "_id": did}]
        ccelwork.walk(v, root, 1, secs)
    else:
        secs = ccelwork.walk(v, root, 1, [])
    out = []
    for s in secs:
        s["title"] = chapter_title(s["title"])
        blocks = [b for b in s["blocks"] if not (b["t"] in ("h", "p") and TITLE_LINES.match(b["text"].strip()))]
        # a repeated chapter heading that carries a note: keep the note, drop the heading text
        if blocks and blocks[0]["t"] == "h" and "[^" in blocks[0]["text"] and blocks[0]["text"].upper().startswith(
                "CHAPTER"):
            ref = re.findall(r"\[\^[^\]]+\]", blocks[0]["text"])
            blocks.pop(0)
            for b in blocks:
                if b["t"] == "p":
                    b["text"] = b["text"] + "".join(ref)
                    break
        for b in blocks:
            if b["t"] in ("p", "q"):
                b["text"] = small_caps(b["text"])
        s["blocks"] = blocks
        out.append(s)
    for s in out:
        if s["title"] in ("Book First", "Book Second"):
            s["level"] = 1
        for b in s["blocks"]:
            b["text"] = fix_chars(b["text"])
            if b["t"] == "note":
                b["text"] = b["text"].lstrip(",;. ")  # CCEL carries a stray comma into one note
        s["blocks"] = order_notes(s["blocks"])
    return ccelwork.finalize(out)


WORK_FIRST = {"v.i": "In Behalf of the Fool", "v.ii": "In Reply to Gaunilo"}


def write() -> int:
    v = ccelwork.load(SOURCE)
    m = meta(SOURCE)
    for n, (did, slug, title, short, author, date, translator, basis, summary) in enumerate(WORKS):
        secs = sections(v, did)
        work = {
            "id": slug, "title": title, "short_title": short, "author": author, "collection": "medieval",
            "order": 3 + n, "date": date, "language": "Latin", "translator": translator,
            "edition": f"{title}, translated by {translator}, in {VOLUME}. {SCAN_NOTE}",
            "source_url": m["url"], "source_sha256": m["sha256"], "retrieved": m["retrieved"],
            "license": "Public domain", "license_basis": basis + INTRO_NOTE,
            "words": sum(section_words(s["blocks"]) for s in secs), "summary": summary,
        }
        p = write_work(OUT / f"{slug}.toml", work, secs)
        print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections, {work['words']} words")
    return 0


def check(n_sample: int = 25) -> int:
    """Align every sentence with both scans; print match rates and a 25 sentence sample with diffs."""
    a = scancheck.Scan([CACHE / SCAN_A])
    b = scancheck.Scan([CACHE / SCAN_B])
    v = ccelwork.load(SOURCE)
    allsent = []
    for did, slug, *_ in WORKS:
        eq = found = total = 0
        for s in sections(v, did):
            for blk in s["blocks"]:
                if blk["t"] not in ("p", "q"):
                    continue
                text = re.sub(r"\[\^[^\]]+\]", "", blk["text"])
                for sa, sb in scancheck.sentences(text):
                    w = [t[0] for t in scancheck.tokens(text[sa:sb])]
                    total += len(w)
                    r = a.align(w)
                    if r is None:
                        continue
                    found += len(w)
                    eq += sum(i2 - i1 for t, i1, i2, *_ in r[0] if t == "equal")
                    allsent.append((slug, text[sa:sb], w, r))
        print(f"{slug:34} match {100 * eq / max(1, found):6.2f}%  found {100 * found / max(1, total):5.1f}%")
    random.seed(1903)
    for slug, sent, w, (ops, seg) in random.sample(allsent, n_sample):
        diffs = [(" ".join(w[i1:i2]), " ".join(seg[j1:j2])) for t, i1, i2, j1, j2 in ops if t != "equal"]
        rb = b.align(w)
        diffs_b = [(" ".join(w[i1:i2]), " ".join(rb[1][j1:j2])) for t, i1, i2, j1, j2 in rb[0] if t != "equal"] \
            if rb else None
        print(f"\n[{slug}] {sent[:160]}")
        print(f"   Cornell: {diffs or 'exact'}   Toronto: {diffs_b if diffs_b is not None else 'no anchor'}"
              if diffs_b != [] else f"   Cornell: {diffs or 'exact'}   Toronto: exact")
    return 0


if __name__ == "__main__":
    sys.exit(check() if sys.argv[1:] == ["check"] else write())
