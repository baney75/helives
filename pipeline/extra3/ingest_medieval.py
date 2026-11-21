"""Ingest medieval works from Project Gutenberg HTML editions into library/medieval/.

Usage: python3 -I pipeline/extra3/ingest_medieval.py [boethius] [bede] [imitation]
Reads pipeline/cache/extra3/pg14328.htm (Boethius, trans. H. R. James, 1897), pg38326.htm (Bede, trans.
A. M. Sellar, 1907) and pg1653.htm (The Imitation of Christ, trans. William Benham).
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from common import fix_chars, order_notes, resolve_notes, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from gutenberg import read_text, tokenize  # noqa: E402
from libtoml import LIBRARY, slugify, write_work  # noqa: E402
from ingest_reformation import titlecase  # noqa: E402

CACHE = HERE.parent / "cache" / "extra3"
OUT = LIBRARY / "medieval"
GUT = "https://www.gutenberg.org/ebooks/{n}"


def roman_int(r: str) -> int:
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    r = r.upper()
    total = 0
    for i, ch in enumerate(r):
        x = vals[ch]
        total += -x if i + 1 < len(r) and vals[r[i + 1]] > x else x
    return total


def finish_secs(secs: list) -> list:
    out = []
    for s in secs:
        if not any(b["t"] != "note" for b in s["blocks"]):
            s["blocks"] = [{"t": "h", "text": s["title"]}] + s["blocks"]
        s["blocks"] = order_notes(s["blocks"])
        for b in s["blocks"]:
            b["text"] = fix_chars(b["text"])
        out.append(s)
    ids = [s["id"] for s in out]
    assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
    return out


def base_work(name: str, n: int) -> dict:
    m = meta(name)
    return {"collection": "medieval", "source_url": m["url"], "source_sha256": m["sha256"],
            "retrieved": m["retrieved"], "license": "Public domain"}


def report(path: Path, secs: list):
    print(f"  wrote {path.relative_to(LIBRARY.parent)}: {len(secs)} sections, "
          f"{sum(section_words(s['blocks']) for s in secs)} words")


# ---------------------------------------------------------------- Boethius (James, 1897)

def poem_lines(html: str) -> str:
    """Turn each verse line inside <div class="poem"> into its own <p class="q"> block."""
    out, pos = [], 0
    for m in re.finditer(r'<div class="poem">', html):
        if m.start() < pos:
            continue
        # find the matching close of the poem div
        depth, i = 0, m.start()
        for t in re.finditer(r"<(/?)div\b[^>]*>", html[m.start():]):
            depth += -1 if t.group(1) else 1
            if depth == 0:
                i = m.start() + t.end()
                break
        region = html[m.start():i]
        region = re.sub(r'<div class="stanza">', '<p class="stanza"></p>', region)
        region = re.sub(r'<span(?: class="(i\d+)")?>(.*?)(?:<br />)?\s*</span>',
                        lambda k: f'<p class="q {k.group(1) or "i0"}">{k.group(2)}</p>', region, flags=re.S)
        out.append(html[pos:m.start()])
        out.append(region)
        pos = i
    out.append(html[pos:])
    return "".join(out)


def boethius():
    name = "pg14328.htm"
    html = read_text(CACHE / name)
    # the transcriber added "[Greek: P]" after the Greek letters the book prints
    html, k = re.subn(r"\s*\[Greek: [A-Za-z]+\]", "", html)
    assert k == 2, k
    toks = tokenize(poem_lines(html), re.compile(r"^#(Footnote_\w+)$"))
    # a footnote runs from its "[A]" anchor to the next anchor or heading, and may hold verse lines
    notes, last, infoot = {}, None, False
    for t in toks:
        if t[0] == "h":
            infoot, last = False, None
            continue
        if t[0] != "p":
            continue
        if t[1] == "FOOTNOTES:":
            infoot = True
            continue
        a = [x for x in t[3] if x.startswith("Footnote_")]
        if a:
            last = a[0]
            notes[last] = re.sub(r"^\[[A-Z]+\]\s*", "", t[1])
        elif infoot and last and t[1].strip():
            sep = " / " if (t[2] or "").startswith("q ") and notes[last] and not notes[last].endswith(":") else " "
            notes[last] = (notes[last] + sep + t[1]).strip(" /")
    secs, cur, book = [], None, 0
    state = "front"
    infoot = False
    for t in toks:
        if t[0] == "h":
            infoot = False
        elif t[0] == "p" and t[1] == "FOOTNOTES:":
            infoot = True
        if infoot:
            continue
        if t[0] == "h":
            txt = t[2]
            if txt in ("PREFACE.", "PROEM.", "EPILOGUE."):
                state = "body"
                title = txt.rstrip(".").title()
                cur = {"id": slugify(title), "title": title if txt != "PREFACE." else "Translator's Preface",
                       "level": 1, "blocks": []}
                secs.append(cur)
                continue
            if txt.startswith("INDEX") or txt in ("OF", "VERSE INTERLUDES.") or txt.startswith("REFERENCES"):
                state = "skip"
                continue
            m = re.match(r"^BOOK ([IVX]+)\.\s*(.*?)\.?$", txt)
            if m:
                state = "body"
                if m.group(2):  # "BOOK I. THE SORROWS OF BOETHIUS." opens the book with its summary
                    book = roman_int(m.group(1))
                    title = f"Book {m.group(1)}. {titlecase(m.group(2)).replace(' ILL ', ' Ill ')}"
                    cur = {"id": f"book-{book}", "title": title, "level": 1, "blocks": []}
                    secs.append(cur)
                continue  # the bare "BOOK I." repeat
            m = re.match(r"^SONG ([IVX]+)\.\s*(.*)$", txt)
            if m:
                n = roman_int(m.group(1))
                cur = {"id": f"book-{book}-song-{n}", "title": f"Song {m.group(1)}. {m.group(2).rstrip('.')}",
                       "level": 2, "blocks": []}
                secs.append(cur)
                continue
            m = re.match(r"^([IVX]+)\.$", txt)
            if m:
                n = roman_int(m.group(1))
                cur = {"id": f"book-{book}-prose-{n}", "title": f"Prose {m.group(1)}", "level": 2, "blocks": []}
                secs.append(cur)
                continue
            if state == "body" and cur is not None:
                cur["blocks"].append({"t": "h", "text": txt})
            continue
        if t[0] != "p" or state != "body" or cur is None:
            continue
        text, cls = t[1], t[2] or ""
        if text in ("FOOTNOTES:", "*Elliot Stock, Paternoster Row, London*") or any(
                x.startswith("Footnote_") for x in t[3]):
            continue
        if cls == "stanza":
            if cur["blocks"] and cur["blocks"][-1]["t"] == "q":
                cur["blocks"][-1]["stanza_end"] = True
            continue
        if text == "SUMMARY.":
            cur["blocks"].append({"t": "h", "text": "Summary"})
            continue
        if not text.strip():
            continue
        used: list = []
        text = resolve_notes(text, notes, used, lambda tg: tg.split("_")[1])
        if cls.startswith("q "):
            ind = int(cls.split()[1][1:]) // 2
            b = {"t": "q", "text": text}
            if ind:
                b["indent"] = min(3, ind)
            cur["blocks"].append(b)
        else:
            cur["blocks"].append({"t": "p", "text": text})
        cur["blocks"].extend(used)
    for s in secs:
        for b in s["blocks"]:
            b.pop("stanza_end", None)
    # each song leads into the prose chapter of the same number: one section per pair
    merged = []
    for s in secs:
        prev = merged[-1] if merged else None
        pair = prev and {prev["id"].replace("-song-", "-X-").replace("-prose-", "-X-"),
                         s["id"].replace("-song-", "-X-").replace("-prose-", "-X-")}
        if prev and len(pair) == 1 and prev["id"] != s["id"] and "-chapter-" not in prev["id"]:
            song, prose = (prev, s) if "-song-" in prev["id"] else (s, prev)
            num = prose["title"].split()[-1]
            parts = []
            for x in (prev, s):
                parts += [{"t": "h", "text": x["title"] if x is song else f"Chapter {num}"}] + x["blocks"]
            prev["blocks"] = parts
            prev["title"] = (f"{song['title']}, and Chapter {num}" if prev is song
                             else f"Chapter {num}, and {song['title']}")
            prev["id"] = prose["id"].replace("-prose-", "-chapter-")
            continue
        merged.append(s)
    secs = finish_secs(merged)
    work = dict(base_work(name, 14328), **{
        "id": "boethius-consolation-of-philosophy", "title": "The Consolation of Philosophy",
        "short_title": "Consolation of Philosophy", "author": "boethius", "order": 1, "date": "c. 524",
        "language": "Latin", "translator": "H. R. James",
        "edition": "The Consolation of Philosophy of Boethius, translated into English prose and verse by H. R. "
                   "James (London: Elliot Stock, 1897); Project Gutenberg EBook #14328",
        "license_basis": "Published in London in 1897, before 1931, so public domain in the United States. The "
                         "translator's list of page references to quotations is not included.",
        "summary": "Written in prison while Boethius awaited execution, a dialogue in prose and verse in which "
                   "Philosophy consoles him by leading him from the gifts of Fortune to the true good, which is "
                   "God, and to the question of providence and free will. Translated with the translator's "
                   "preface, introduction and epilogue.",
    })
    p = write_work(OUT / "boethius-consolation-of-philosophy.toml", work, secs)
    report(p, secs)


# ---------------------------------------------------------------- Bede (Sellar, 1907)

def bede():
    name = "pg38326.htm"
    toks = tokenize(read_text(CACHE / name), re.compile(r"^#(note_\d+)$"), ("dd", "dt", "li"))
    # a note's <dd> may hold several <p>: collect them until the next label
    notes, last, infoot = {}, None, False
    for t in toks:
        if t[0] == "h":
            infoot = t[2] == "Footnotes"
            last = None
            continue
        if not infoot or t[0] != "p":
            continue
        if t[2] == "tei tei-notelabel":
            last = next((a for a in t[3] if a.startswith("note_")), None)
            notes[last] = ""
        elif last and t[1].strip():
            notes[last] = (notes[last] + " " + t[1]).strip()
    front = {"Editor's Preface": "editors-preface", "Introduction": "introduction", "Life Of Bede": "life-of-bede",
             "Preface": "preface", "Continuation": "continuation"}
    skip = {"Contents", "Errata", "Index", "Footnotes", "Credits", "A Word from Project Gutenberg",
            "The Full Project Gutenberg License"}
    secs, cur, book, state = [], None, 0, "skip"
    for t in toks:
        if t[0] == "h":
            txt = t[2]
            if t[1] == 1:
                if txt in skip:
                    state = "skip"
                    continue
                state = "body"
                m = re.match(r"^Book ([IVX]+)$", txt)
                if m:
                    book = roman_int(m.group(1))
                    cur = {"id": f"book-{book}", "title": txt, "level": 1, "blocks": []}
                elif txt in front:
                    title = {"Life Of Bede": "Life of Bede", "Preface": "Bede's Preface"}.get(txt, txt)
                    cur = {"id": front[txt], "title": title, "level": 1, "blocks": []}
                else:
                    raise ValueError(f"unexpected heading {txt!r}")
                secs.append(cur)
                continue
            if state != "body":
                continue
            m = re.match(r"^Chap\. ([IVXL]+)\.\s*(.*)$", txt)
            if m and book:
                n = roman_int(m.group(1))
                cur = {"id": f"book-{book}-chapter-{n}", "title": f"Chapter {m.group(1)}. {m.group(2).rstrip('.')}",
                       "level": 2, "blocks": []}
                secs.append(cur)
                continue
            cur["blocks"].append({"t": "h", "text": txt})
            continue
        if state != "body" or t[0] != "p":
            continue
        text, cls = t[1], t[2]
        if cls is None or cls in ("tei tei-notelabel", "tei tei-notetext"):
            continue  # page markers "[pg 009]" and the Gutenberg header
        used: list = []
        text = resolve_notes(text, notes, used, lambda tg: tg.split("_")[1])
        cur["blocks"].append({"t": "p", "text": text})
        cur["blocks"].extend(used)
    secs = finish_secs(secs)
    work = dict(base_work(name, 38326), **{
        "id": "bede-ecclesiastical-history", "title": "The Ecclesiastical History of the English Nation",
        "short_title": "Ecclesiastical History", "author": "bede", "order": 2, "date": "731",
        "language": "Latin", "translator": "A. M. Sellar",
        "edition": "Bede's Ecclesiastical History of England: A Revised Translation, with Introduction, Life, "
                   "and Notes, by A. M. Sellar (London: George Bell and Sons, 1907); Project Gutenberg EBook #38326",
        "license_basis": "Published in London in 1907, before 1931, so public domain in the United States.",
        "summary": "Bede's history of Christianity in England in five books, from Roman Britain through the "
                   "mission of Augustine of Canterbury in 597 and the conversion of the English kingdoms to his "
                   "own day in 731, with Sellar's introduction, life of Bede and notes.",
    })
    p = write_work(OUT / "bede-ecclesiastical-history.toml", work, secs)
    report(p, secs)


# ---------------------------------------------------------------- Imitation of Christ (Benham)

def imitation():
    name = "pg1653.htm"
    toks = tokenize(read_text(CACHE / name))
    secs, cur, book, state, chap_title_next = [], None, 0, "skip", False
    pending_notes: list = []

    def flush_notes():
        # "(1) John viii. 12. (2) Revelations ii. 17." closes each chapter; text marks "(1)"
        nonlocal pending_notes
        if not pending_notes or cur is None:
            return
        found = dict(re.findall(r"\((\d+)\)\s*(.*?)(?=\s*\(\d+\)\s|$)", " ".join(pending_notes)))
        refs = [r for b in cur["blocks"] for r in re.findall(r"\((\d+)\)", b["text"])]
        assert sorted(set(refs), key=int) == sorted(found, key=int), (cur["id"], refs, list(found))
        out = []
        for b in cur["blocks"]:
            b["text"] = re.sub(r"\((\d+)\)", lambda m: f"[^{m.group(1)}]", b["text"])
            out.append(b)
        for k in sorted(found, key=int):
            out.append({"t": "note", "id": k, "text": found[k].strip()})
        cur["blocks"] = out
        pending_notes = []

    for t in toks:
        if t[0] == "h":
            txt = t[2]
            m = re.match(r"^THE (FIRST|SECOND|THIRD|FOURTH) BOOK (.*)$", txt)
            if m:
                flush_notes()
                book = ["FIRST", "SECOND", "THIRD", "FOURTH"].index(m.group(1)) + 1
                cur = {"id": f"book-{book}", "title": f"Book {['I', 'II', 'III', 'IV'][book - 1]}. "
                       f"{m.group(2).capitalize()}", "level": 1, "blocks": []}
                secs.append(cur)
                state = "body"
                continue
            m = re.match(r"^CHAPTER ([IVXL]+)$", txt)
            if m and state == "body":
                flush_notes()
                n = roman_int(m.group(1))
                cur = {"id": f"book-{book}-chapter-{n}", "title": f"Chapter {m.group(1)}", "level": 2,
                       "blocks": []}
                secs.append(cur)
                chap_title_next = True
                continue
            if txt in ("INTRODUCTORY NOTE", "THE IMITATION OF CHRIST", "Contents") or state != "body":
                continue
            cur["blocks"].append({"t": "h", "text": txt})
            continue
        if state != "body" or t[0] != "p":
            continue
        text, cls = t[1], t[2]
        if chap_title_next and cls == "center":
            cur["title"] += ". " + text.rstrip(".")
            chap_title_next = False
            continue
        chap_title_next = False
        if cls == "footnote":
            pending_notes.append(text)
            continue
        if re.search(r"END OF THE PROJECT GUTENBERG", text, re.I):
            break
        cur["blocks"].append({"t": "q" if cls == "poem" else "p", "text": text})
    flush_notes()
    secs = finish_secs(secs)
    work = dict(base_work(name, 1653), **{
        "id": "imitation-of-christ", "title": "The Imitation of Christ", "short_title": "Imitation of Christ",
        "author": "thomas-a-kempis", "order": 10, "date": "c. 1418-1427", "language": "Latin",
        "translator": "William Benham",
        "edition": "Thomas à Kempis, The Imitation of Christ, translated by the Rev. William Benham (1831-1910); "
                   "Project Gutenberg EBook #1653",
        "license_basis": "Benham's translation was first published in 1874, printed in London by J. C. Nimmo in "
                         "1886 and reprinted in The Harvard Classics, vol. 7 (New York: P. F. Collier & Son, 1909), "
                         "all before 1931, so it is public domain in the United States. The unsigned introductory "
                         "note in the Gutenberg file is not included.",
        "summary": "A devotional book in four parts on following Christ in humility, self-denial and inward "
                   "peace, closing with a book on Holy Communion, traditionally attributed to Thomas à Kempis.",
    })
    p = write_work(OUT / "imitation-of-christ.toml", work, secs)
    report(p, secs)


def main(argv: list[str]) -> int:
    jobs = {"boethius": boethius, "bede": bede, "imitation": imitation}
    for k in argv or list(jobs):
        jobs[k]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
