"""Ingest Josephus in William Whiston's translation from the Project Gutenberg HTML editions.

Usage: python3 -I pipeline/extra3/ingest_josephus.py
Reads pipeline/cache/extra3/pg2846.htm (Life), pg2848.htm (Antiquities), pg2849.htm (Against Apion),
pg2850.htm (Wars); fetch them with fetch.py from the gutenberg.pglaf.org mirror.
Writes library/jewish/josephus/<slug>.toml. Book = level 1, chapter = level 2; Whiston's section
numbers stay as plain text at the start of each paragraph.

Why Gutenberg and not CCEL: a word-by-word comparison of Antiquities Book I found the CCEL file
(josephus/complete.xml) carries scan errors the Gutenberg text does not ("commanded ;hem",
"apellation", "hospiably", "And he him"); both carry the same notes.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import gutenberg  # noqa: E402
from common import chunk_numbered, fix_chars, order_notes, resolve_notes, section_range  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, slugify, write_work  # noqa: E402
from ccel.build import roman_to_int  # noqa: E402

OUT = LIBRARY / "jewish" / "josephus"
NOTE_ANCHOR = re.compile(r"^link\w*?note-\w+$")
EDITION = (
    "William Whiston, trans., The Works of Flavius Josephus (London, 1737), with Whiston's notes; "
    "Project Gutenberg transcription by David Reed (EBook #{n})"
)
BASIS = (
    "Whiston's translation and notes were first published in London in 1737 and the text has been in "
    "the public domain in the United States for well over a century; Project Gutenberg distributes this "
    "transcription as a public domain work in the United States"
)


def note_texts(items: list) -> dict:
    """Map note anchor name to its cleaned footnote text."""
    notes: dict[str, str] = {}
    pending = None
    last = None
    for it in items:
        if it[0] != "p":
            continue
        _, text, cls, anchors = it
        if cls == "foot":
            if pending is None:
                # a second paragraph of the previous note
                if last is None:
                    raise ValueError(f"footnote without anchor: {text[:60]}")
                notes[last] = fix_chars(notes[last] + " " + re.sub(r"\x00[^\x00]*\x00", "", text))
                continue
            t = re.sub(r"^\d+\s*\(return\)\s*", "", text)
            t = re.sub(r"\x00[^\x00]*\x00", "", t).strip()
            if t.startswith("[") and t.endswith("]"):
                t = t[1:-1].strip()
            notes[pending] = fix_chars(t)
            last, pending = pending, None
            continue
        for a in anchors:
            if NOTE_ANCHOR.match(a) and "noteref" not in a:
                pending = a
    return notes


def note_num(tgt: str) -> str:
    return re.search(r"note-(\w+)$", tgt).group(1)


# Transcription leftovers in the Gutenberg text, each checked against the CCEL file of the same
# translation. Every fix must apply exactly once (asserted in main).
FIXES = [
    # Antiquities I.3.3: a stray, unlinked "[15]"; note 15 is linked properly two lines later.
    ("noted down,[15] with great accuracy", "noted down, with great accuracy"),
]
USED: set[str] = set()


def para(text: str) -> str:
    for old, new in FIXES:
        if old in text:
            text = text.replace(old, new)
            USED.add(old)
    return fix_chars(text)


def is_notes_heading(t: str) -> bool:
    return bool(re.search(r"FOOTNOTES", t, re.I))


def build(items: list, start: int, kind: str) -> list[dict]:
    """Walk body items from `start` into sections. kind: 'ant', 'war', 'apion', 'life'."""
    notes = note_texts(items)
    sections: list[dict] = []
    cur = None  # current section dict
    book = None
    in_notes = False
    pending_title = None  # "CHAPTER 3" waiting for its title heading or pre
    prenote_used = []

    def new(sid, title, level):
        nonlocal cur
        cur = {"id": sid, "title": title, "level": level, "blocks": [], "_used": []}
        sections.append(cur)
        return cur

    def add_p(text, t="p"):
        if cur is None:
            raise ValueError(f"text before first section: {text[:60]}")
        if not re.sub(r"\x00[^\x00]*\x00", "", text).strip():
            return
        text = resolve_notes(text, notes, cur["_used"], note_num)
        cur["blocks"].append({"t": t, "text": para(text)})

    def heading_text(raw):
        """Strip note markers from a heading; return (clean text, has markers)."""
        return " ".join(re.sub(r"\x00[^\x00]+\x00", "", raw).split()), "\x00" in raw

    def title_note(raw_title):
        """A title that carries a footnote: repeat it as an h block holding the marker in place."""
        t = " ".join(raw_title.split())
        t = re.sub(r"\s+(\x00[^\x00]+\x00)", r"\1", t)
        add_p(t, "h")

    carry = None  # a titled note before the first section (Against Apion's title note)

    for it in items[start:]:
        if it[0] == "pre":
            raw = it[1]
            txt, marked = heading_text(raw)
            if "Project Gutenberg" in txt or "PROJECT GUTENBERG" in txt:
                break
            if in_notes:
                continue
            if pending_title is not None:
                cur["title"] = f"{pending_title}. {txt}"
                if marked:
                    title_note(f"{pending_title}. {raw}")
                pending_title = None
            else:
                add_p(" ".join(raw.split()))
            continue
        if it[0] == "h":
            raw = it[2]
            t, marked = heading_text(raw)
            if not t:
                continue
            if is_notes_heading(t):
                in_notes = True
                continue
            if cur is None and kind == "apion" and t.startswith("AGAINST APION"):
                carry = raw
                continue
            m = re.match(r"^BOOK ([IVXLC]+|\d+)\.?\s*(.*)$", t)
            if m:
                n = int(m.group(1)) if m.group(1).isdigit() else roman_to_int(m.group(1))
                in_notes = False
                if book == n:
                    continue  # the source repeats a book heading
                book = n
                new(f"book-{n}", f"Book {to_roman(n)}", 1)
                if carry:
                    title_note("Against Apion" + re.sub(r"^\s*AGAINST APION\.?", "", carry))
                    carry = None
                sub = re.sub(r"^BOOK ([IVXLC]+|\d+)\.?\s*", "", raw.strip())
                if sub.strip():
                    add_p(sub)
                continue
            m = re.match(r"^CHAPTER ([IVXLC]+|\d+)\.?\s*(.*)$", t)
            if m:
                in_notes = False
                n = int(m.group(1)) if m.group(1).isdigit() else roman_to_int(m.group(1))
                new(f"book-{book}-chapter-{n}" if book else f"chapter-{n}", f"Chapter {n}", 2)
                if m.group(2):
                    cur["title"] = f"Chapter {n}. {m.group(2).strip()}"
                    if marked:
                        title_note(f"Chapter {n}. " + re.sub(r"^\s*CHAPTER ([IVXLC]+|\d+)\.?\s*", "", raw))
                else:
                    pending_title = f"Chapter {n}"
                continue
            if re.match(r"^PREFACE", t):
                in_notes = False
                new("preface", "Preface", 1)
                if marked:
                    title_note("Preface" + re.sub(r"^\s*PREFACE\.?", "", raw))
                continue
            if cur is None and re.match(r"^(By Flavius Josephus|Translated by)", t):
                continue
            if pending_title is not None and not in_notes:
                cur["title"] = f"{pending_title}. {t}"
                if marked:
                    title_note(f"{pending_title}. {raw}")
                pending_title = None
                continue
            if in_notes:
                continue
            raise ValueError(f"unexpected heading: {t[:80]}")
        # paragraph
        _, text, cls, anchors = it
        if in_notes or cls in ("foot", "toc"):
            continue
        if not text.strip():
            continue
        if cur is None and carry is not None:
            carry += " " + text
            continue
        if cur is None and kind == "life":
            new("text", "The Life", 1)
        if pending_title is not None:
            pending_title = None
        add_p(text)
    for s in sections:
        s["blocks"].extend(s.pop("_used"))
        s["blocks"] = order_notes(s["blocks"])
    return sections


def to_roman(n: int) -> str:
    from ccel.build import to_roman as tr
    return tr(n)


def split_long(sections: list[dict], limit: int = 6000) -> list[dict]:
    """Split a chapter over `limit` words at Whiston's numbered paragraphs: the chapter keeps its id
    and first part; later parts become level 3 sections titled by their section numbers."""
    from common import section_words
    out = []
    for s in sections:
        chunks = chunk_numbered(s["blocks"], target=3500) if section_words(s["blocks"]) > limit else [s["blocks"]]
        if len(chunks) == 1:
            out.append(s)
            continue
        assert s["level"] == 2, s["id"]
        out.append(dict(s, blocks=chunks[0]))
        for ch in chunks[1:]:
            a, b = section_range(ch)
            label = f"Sections {a}-{b}" if a != b else f"Section {a}"
            out.append({"id": f"{s['id']}-{slugify(label)}", "title": f"{s['title'].split('.')[0]}, {label}",
                        "level": 3, "blocks": ch})
    return out


def split_life(sections: list[dict]) -> list[dict]:
    assert len(sections) == 1
    out = []
    for ch in chunk_numbered(sections[0]["blocks"], target=3000):
        a, b = section_range(ch)
        out.append({"id": f"sections-{a}-{b}", "title": f"Sections {a}-{b}", "level": 1, "blocks": ch})
    return out


def split_books(sections: list[dict]) -> list[dict]:
    """Against Apion: each book has numbered sections but no chapters; make level 2 parts."""
    out = []
    for s in sections:
        chunks = chunk_numbered(s["blocks"], target=3000)
        first = chunks[0]
        a, b = section_range(first)
        k = 0
        while k < len(first) and first[k]["t"] in ("h", "note"):
            k += 1
        out.append({"id": s["id"], "title": s["title"], "level": 1,
                    "blocks": first[:k] + [{"t": "h", "text": f"Sections {a}-{b}"}] + first[k:]})
        for ch in chunks[1:]:
            a, b = section_range(ch)
            out.append({"id": f"{s['id']}-sections-{a}-{b}", "title": f"{s['title']}, Sections {a}-{b}", "level": 2, "blocks": ch})
    return out


def body_start(items: list, kind: str) -> int:
    if kind == "ant":
        idx = [i for i, it in enumerate(items) if it[0] == "h" and it[2].startswith("PREFACE")]
        return idx[1]
    if kind == "war":
        idx = [i for i, it in enumerate(items) if it[0] == "h" and it[2].strip() == "PREFACE"]
        return idx[0]
    if kind == "apion":
        idx = [i for i, it in enumerate(items) if it[0] == "h" and it[2].startswith("AGAINST APION")]
        return idx[0]
    idx = [i for i, it in enumerate(items) if it[0] == "p" and it[1].startswith("1. The family")]
    return idx[0]


WORKS = [
    ("pg2848.htm", "ant", "antiquities", "The Antiquities of the Jews", "Antiquities", 1, "c. 93-94", 2848,
     "Josephus's history of the Jewish people in twenty books, from the creation to the outbreak of the "
     "war with Rome in 66, retelling the Hebrew Scriptures and continuing through the Hasmonean and "
     "Herodian periods, with Whiston's notes."),
    ("pg2850.htm", "war", "wars", "The Wars of the Jews", "Jewish War", 2, "c. 75-79", 2850,
     "Josephus's account in seven books of the Jewish revolt against Rome, from the Maccabean period to "
     "the destruction of Jerusalem and the Temple in 70 and the fall of Masada, with Whiston's notes."),
    ("pg2849.htm", "apion", "against-apion", "Against Apion", None, 3, "c. 94-100", 2849,
     "Josephus's defense in two books of the antiquity of the Jewish people and of the law of Moses "
     "against Greek and Egyptian critics, with Whiston's notes."),
    ("pg2846.htm", "life", "life", "The Life of Flavius Josephus", "Life", 4, "c. 94-100", 2846,
     "Josephus's account of his own family, education and conduct as a commander in Galilee during the "
     "revolt of 66 to 67, written in answer to the charges of Justus of Tiberias."),
]


def main() -> int:
    for fname, kind, slug, title, short, order, date, ebook, summary in WORKS:
        items = gutenberg.tokenize(gutenberg.read_text(CACHE / fname))
        secs = build(items, body_start(items, kind), kind)
        if kind == "life":
            secs = split_life(secs)
        elif kind == "apion":
            secs = split_books(secs)
        else:
            secs = split_long(secs)
        m = meta(fname)
        work = {
            "id": f"josephus-{slug}", "title": title, "short_title": short, "author": "josephus",
            "collection": "jewish", "order": order, "date": date, "language": "Greek",
            "translator": "William Whiston", "edition": EDITION.format(n=ebook),
            "source_url": m["url"], "source_sha256": m["sha256"], "retrieved": m["retrieved"],
            "license": "Public domain", "license_basis": BASIS, "summary": summary,
        }
        p = write_work(OUT / f"{slug}.toml", work, secs)
        notes = sum(1 for s in secs for b in s["blocks"] if b["t"] == "note")
        print(f"wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections, {notes} notes")
    missing = [o for o, _ in FIXES if o not in USED]
    assert not missing, f"fixes not applied: {missing}"
    return 0


if __name__ == "__main__":
    sys.exit(main())
