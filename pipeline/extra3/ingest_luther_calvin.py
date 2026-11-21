"""Ingest Luther (Wace and Buchheim, 1883) and Calvin's Institutes (Beveridge, 1845) from CCEL ThML.

Usage: python3 -I pipeline/extra3/ingest_luther_calvin.py [luther] [calvin]
Reads pipeline/cache/extra3/first_prin.xml and institutes.xml (fetch with fetch.py); writes
library/reformation/<slug>.toml.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import ccelwork  # noqa: E402
from common import chunk_numbered, order_notes, section_range, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from ingest_reformation import titlecase  # noqa: E402
from libtoml import LIBRARY, words_in, write_work  # noqa: E402

OUT = LIBRARY / "reformation"
LIMIT = 6000


def chunk_paras(blocks: list, target: int) -> list[list]:
    """Split at paragraph boundaries into chunks of about `target` words (notes stay with their paragraph)."""
    chunks, cur, n = [], [], 0
    for b in blocks:
        if b["t"] in ("p", "h", "bq") and cur and n >= target:
            chunks.append(cur)
            cur, n = [], 0
        cur.append(b)
        if b["t"] != "note":
            n += words_in(b["text"])
    if cur:
        if chunks and section_words(cur) < target / 3:
            chunks[-1].extend(cur)
        else:
            chunks.append(cur)
    return chunks


def split_long(secs: list, short_of, target: int = 3500) -> list:
    out = []
    for s in secs:
        if section_words(s["blocks"]) <= LIMIT:
            out.append(s)
            continue
        blocks = s["blocks"]
        # Calvin opens each chapter with a numbered summary of its sections; the body numbering
        # restarts at "1." after it, so split only from the last paragraph that starts "1. ".
        starts = [i for i, b in enumerate(blocks) if b["t"] == "p" and re.match(r"^1\. ", b["text"])]
        k = starts[-1] if starts else 0
        body = blocks[k:]
        chunks = chunk_numbered(body, target) if starts else chunk_paras(body, target)
        if len(chunks) == 1:
            chunks = chunk_paras(body, target)
        chunks[0] = blocks[:k] + chunks[0]
        out.append(dict(s, blocks=chunks[0]))
        for i, ch in enumerate(chunks[1:], 2):
            a, b = section_range(ch) if starts else ("", "")
            label = (f"Sections {a}-{b}" if a != b else f"Section {a}") if a else f"Part {i}"
            out.append({"title": f"{short_of(s)}, {label}", "level": min(4, s["level"] + 1), "blocks": ch})
    return out


def finish(secs: list) -> list:
    secs = ccelwork.finalize(secs)
    for s in secs:
        s["blocks"] = order_notes(s["blocks"])
    return secs


# ---------------------------------------------------------------- Luther, First Principles (1883)

LUTHER_EDITION = ("First Principles of the Reformation, or the Ninety-five Theses and the Three Primary Works of "
                  "Dr. Martin Luther, trans. and ed. Henry Wace and C. A. Buchheim (London: John Murray, 1883); "
                  "CCEL digitization (luther/first_prin)")
LUTHER_BASIS = "Published 1883 in London (John Murray); published before 1931, so public domain in the United States"


def luther() -> None:
    name = "first_prin.xml"
    v = ccelwork.load(name)
    m = meta(name)
    jobs = [
        ("luther-ninety-five-theses", "iv.i", "The Ninety-Five Theses", "Ninety-Five Theses", 11, "1517",
         "Luther's disputation on the power and efficacy of indulgences, posted at Wittenberg on 31 October 1517, "
         "with his covering letter to Archbishop Albert of Mainz and his protestation."),
        ("luther-christian-liberty", "v.ii", "Concerning Christian Liberty", "Christian Liberty", 12, "1520",
         "Luther's treatise on the freedom of a Christian, also known as On the Freedom of a Christian, with his "
         "dedicatory letter to Pope Leo X, holding that a Christian is free lord of all through faith and "
         "dutiful servant of all through love."),
    ]
    for slug, did, title, short, order, date, summary in jobs:
        secs = ccelwork.walk(v, v.by_id[did], 1, [])
        for s in secs:
            s["title"] = re.sub(r"\s+", " ", s["title"]).strip().rstrip(".").replace("Dedicatory. Letter", "Dedicatory Letter")
        secs = split_long(secs, lambda s: s["title"])
        secs = finish(secs)
        work = {
            "id": slug, "title": title, "short_title": short, "author": "luther", "collection": "reformation",
            "order": order, "date": date, "language": "Latin" if order == 11 else "Latin and German",
            "translator": "Henry Wace and C. A. Buchheim", "edition": LUTHER_EDITION, "source_url": m["url"],
            "source_sha256": m["sha256"], "retrieved": m["retrieved"], "license": "Public domain",
            "license_basis": LUTHER_BASIS, "summary": summary,
        }
        p = write_work(OUT / f"{slug}.toml", work, secs)
        print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections")


# ---------------------------------------------------------------- Calvin, Institutes (1845)

CALVIN_EDITION = ("John Calvin, Institutes of the Christian Religion, trans. Henry Beveridge, 3 vols. (Edinburgh: "
                  "Calvin Translation Society, 1845-1846), with the One Hundred Aphorisms by William Pringle; "
                  "CCEL digitization (calvin/institutes)")
CALVIN_BASIS = ("Published 1845-1846 in Edinburgh (Calvin Translation Society); published before 1931, so public "
                "domain in the United States. The CCEL file's modern introduction by John Murray and the prefaces "
                "from Thomas Norton's 1561 translation are not included.")
# CCEL front matter kept: Calvin's own prefatory address and epistles. Left out: John Murray's
# introduction (from a 20th century reprint, not public domain), the 1561 Norton prefaces (another
# translation), empty table stubs, the general index of chapters (a contents list) and the indexes.
CALVIN_SKIP = {"i", "ii.i", "ii.ii", "ii.iii", "ii.iv", "ii.v", "ii.vi", "ii.vii", "ii.xiii", "viii"}


def dash_case(t: str) -> str:
    """Capitalize a word after an em dash and drop trailing dashes and periods."""
    t = re.sub(r"—\s*([a-z])", lambda m: "—" + m.group(1).upper(), t)
    return re.sub(r"[\s.—-]+$", "", t)


def calvin_title(el) -> str:
    t = " ".join((el.get("title") or "").split()).strip()
    m = re.match(r"^CHAPTER (\d+)\.\s*-\s*(.*)$", t)
    if m:
        return f"Chapter {m.group(1)}. {dash_case(titlecase(m.group(2)))}"
    m = re.match(r"^BOOK (FIRST|SECOND|THIRD|FOURTH)\.\s*(.*)$", t)
    if m:
        return f"Book {titlecase(m.group(1))}. {titlecase(m.group(2)).rstrip('. ')}"
    return titlecase(t).rstrip(".,* ")


def calvin() -> None:
    name = "institutes.xml"
    v = ccelwork.load(name)
    m = meta(name)
    secs = ccelwork.walk(v, v.body, 1, [], skip=lambda el: el.get("id") in CALVIN_SKIP, title_of=calvin_title)
    # "Prefatory Material" is a wrapper: lift its children to level 1
    out = []
    for s in secs:
        if s["_id"] == "ii":
            # title-page lines only ("A New Translation by Henry Beveridge" and a line from the 1561 Norton title)
            assert sum(words_in(b["text"]) for b in s["blocks"]) < 60
            continue
        if s["_id"] and s["_id"].startswith("ii."):
            s["level"] = 1
        out.append(s)
    book_of = {}
    cur_book = ""
    for s in out:
        if s["level"] == 1:
            mm = re.match(r"^Book (\w+)", s["title"])
            cur_book = f"Book {mm.group(1)}" if mm else ""
        book_of[id(s)] = cur_book

    def short_of(s):
        ch = re.match(r"^(Chapter \d+)", s["title"])
        return ch.group(1) if ch else s["title"]

    secs = split_long(out, short_of)
    for s in secs:
        if s["level"] == 2 and re.match(r"^Chapter \d+", s["title"]) and id(s) in book_of:
            pass
    # chapter ids must be unique across books: prefix the book
    cur = ""
    for s in secs:
        mm = re.match(r"^Book (\w+)", s["title"])
        if s["level"] == 1:
            cur = {"First": "book-1", "Second": "book-2", "Third": "book-3", "Fourth": "book-4"}.get(mm.group(1), "") if mm else ""
            if s["title"].startswith("One Hundred Aphorisms"):
                cur = "aphorisms"
        s["_prefix"] = cur
    # "&c;" in one note is the CCEL file's typo for "&c." and reads as an HTML entity to the validator
    fixed = 0
    for s in secs:
        for b in s["blocks"]:
            if "&c;" in b["text"]:
                b["text"] = b["text"].replace("&c;", "&c.")
                fixed += 1
    assert fixed == 1, fixed
    secs = finish(secs)
    seen = set()
    for s in secs:
        pre = s.pop("_prefix", "")
        if pre and s["level"] > 1:
            s["id"] = f"{pre}-{s['id']}"
        elif pre and s["level"] == 1:
            s["id"] = pre if pre != "aphorisms" else s["id"]
        assert s["id"] not in seen, s["id"]
        seen.add(s["id"])
    work = {
        "id": "calvin-institutes", "title": "Institutes of the Christian Religion", "short_title": "Institutes",
        "author": "calvin", "collection": "reformation", "order": 20, "date": "1536; final Latin edition 1559",
        "language": "Latin", "translator": "Henry Beveridge", "edition": CALVIN_EDITION, "source_url": m["url"],
        "source_sha256": m["sha256"], "retrieved": m["retrieved"], "license": "Public domain",
        "license_basis": CALVIN_BASIS,
        "summary": "Calvin's systematic exposition of the Christian faith in four books, on God the Creator, God the "
                   "Redeemer in Christ, the way the grace of Christ is received, and the church, in the 1559 "
                   "edition as translated by Henry Beveridge.",
    }
    p = write_work(OUT / "calvin-institutes.toml", work, secs)
    print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections")


def main(argv: list[str]) -> int:
    if not argv or "luther" in argv:
        luther()
    if not argv or "calvin" in argv:
        calvin()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
