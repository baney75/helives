"""Ingest Pistis Sophia in G. R. S. Mead's translation (revised edition, London: J. M. Watkins, 1921).

Usage: python3 -I pipeline/extra/ingest_pistis.py
Text: the Gnostic Society Library transcription of the 1921 edition
(http://gnosis.org/library/pistis-sophia/), cached in pipeline/cache/extra/ps/. Checked word by word
against the archive.org scan of the 1921 printing (pistissophiagnos1921mead, OCR in
pipeline/cache/extra/ps1921.txt) by pipeline/extra/compare_ocr.py.

Kept: the translation (Books 1 to 6 and the postscript), Mead's bracketed editorial insertions and his
one footnote. Dropped: Mead's introduction and bibliography, his green marginal summaries, the codex
page numbers printed in the margin (and the "|" marks that key them), and the printed page numbers.
"""
from __future__ import annotations

import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from fetch import CACHE  # noqa: E402
from libtoml import LIBRARY, sha256_file, write_work  # noqa: E402

PS = CACHE / "ps"
FIRST, LAST = 5, 154  # ps005.htm (Chapter 1) .. ps154.htm (postscript)


class Page(HTMLParser):
    """Turn one transcription page into events: ('h', tag, text), ('p', text), ('note', n, text)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.events: list[tuple] = []
        self.buf: list[str] = []
        self.skip = 0          # inside margnote / rmargnote / page anchor
        self.span_stack: list[bool] = []
        self.in_body = False
        self.block: str | None = None
        self.in_notes = False
        self.note_id = ""
        self.anchor_skip = False
        self.ref_pending = ""

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "hr" and not self.in_body:
            self.in_body = True  # body starts after the navigation rule
            return
        if not self.in_body:
            return
        if tag == "span":
            sk = a.get("class", "") in ("margnote", "rmargnote")
            self.span_stack.append(sk)
            if sk:
                self.skip += 1
            return
        if tag == "a":
            name, href = a.get("name", ""), a.get("href", "")
            if name.startswith("page_"):
                self.anchor_skip = True
                self.skip += 1
            elif name.startswith("fn_"):
                self.note_id = name[3:]
            elif href.startswith("#fn_"):
                self.ref_pending = href[4:]
                self.skip += 1
                self.anchor_skip = True
            elif href:
                self.skip += 1
                self.anchor_skip = True
            return
        if tag in ("p", "h1", "h2", "h3"):
            self._flush()
            self.block = tag
            return
        if tag == "i" and not self.skip:
            self.buf.append("\x02")
        if tag == "br" and not self.skip:
            self.buf.append(" ")

    def handle_endtag(self, tag):
        if not self.in_body:
            return
        if tag == "span" and self.span_stack:
            if self.span_stack.pop():
                self.skip -= 1
            return
        if tag == "a":
            if self.anchor_skip:
                self.anchor_skip = False
                self.skip -= 1
                if self.ref_pending:
                    self.buf.append(f"[^{self.ref_pending}]")
                    self.ref_pending = ""
            return
        if tag == "i" and not self.skip:
            self.buf.append("\x02")
        if tag in ("p", "h1", "h2", "h3"):
            self._flush()

    def handle_data(self, data):
        if self.in_body and not self.skip:
            self.buf.append(data)

    def _flush(self):
        t = "".join(self.buf)
        self.buf = []
        tag, self.block = self.block, None
        t = t.replace("\xa0", " ")
        t = re.sub(r"\s+", " ", t).strip()
        t = re.sub("\x02(\\s*)\x02", r"\1", t)
        # pair italic markers
        parts = t.split("\x02")
        out = [parts[0]]
        for k in range(1, len(parts), 2):
            inner = parts[k].strip()
            out.append(f"*{inner}*" if inner else "")
            out.append(parts[k + 1] if k + 1 < len(parts) else "")
        t = "".join(out)
        t = t.replace("|", " ")
        # transcription marker where a paragraph runs across a printed page; not in the book
        t = t.replace("[paragraph continues]", " ")
        t = re.sub(r"\s{2,}", " ", t).strip()
        t = t.replace(". . .", "\x04")
        t = re.sub(r"\s+([,.;:!?])", r"\1", t)
        t = t.replace("\x04", ". . .")
        t = t.replace("--", "\u2014")  # the transcription's "--" is the printed em dash
        # chapter openings print the first word in capitals ("IT came to pass")
        t = re.sub(r"^([\"'\u201c]?)([A-Z]{2,})(?= [a-z])", lambda m: m.group(1) + m.group(2).capitalize(), t)
        if not t or tag is None:
            return
        if t.startswith("Next:") or t.startswith("Return to the"):
            return
        if t == "Footnotes":
            self.in_notes = True
            return
        if self.in_notes:
            m = re.match(r"\d+:\d+\s+(.*)", t)
            self.events.append(("note", self.note_id or "1", m.group(1) if m else t))
            return
        self.events.append(("h", tag, t) if tag.startswith("h") else ("p", t))


def chapter_no(t: str) -> int | None:
    m = re.match(r"(?i)chapter (\d+)\.?$", t)
    return int(m.group(1)) if m else None


TERMINAL = re.compile(r"""[.!?:;"'”’)\]—-]$""")


def build() -> tuple[list[dict], list[str]]:
    sections: list[dict] = []
    log: list[str] = []
    cur: dict | None = None
    pending_heads: list[dict] = []
    for n in range(FIRST, LAST + 1):
        f = PS / f"ps{n:03d}.htm"
        if not f.exists():
            continue
        pg = Page()
        raw = f.read_bytes()
        try:
            src = raw.decode("utf-8")
        except UnicodeDecodeError:
            src = raw.decode("latin-1")
        pg.feed(src)
        pg.close()
        for ev in pg.events:
            if ev[0] == "h":
                _, tag, t = ev
                c = chapter_no(t)
                if c is not None:
                    cur = {"id": f"chapter-{c}", "title": f"Chapter {c}", "level": 1, "blocks": pending_heads}
                    pending_heads = []
                    sections.append(cur)
                    continue
                if t.startswith("A SIXTH BOOK") and "Chapter 144" in t:
                    pending_heads.append({"t": "h", "text": "A Sixth Book"})
                    cur = {"id": "chapter-144", "title": "Chapter 144", "level": 1, "blocks": pending_heads}
                    pending_heads = []
                    sections.append(cur)
                    continue
                if t in ("[THE NOTE OF A SCRIBE]", "[A LATER POSTSCRIPT]"):
                    sid = "note-of-a-scribe" if "SCRIBE" in t else "later-postscript"
                    cur = {"id": sid, "title": t.strip("[]").title().replace(" Of ", " of ").replace(" A ", " a "),
                           "level": 1, "blocks": []}
                    sections.append(cur)
                    continue
                heading = {"t": "h", "text": t}
                if tag in ("h1", "h2") and (cur is None or ("BOOK" in t or t == "PISTIS SOPHIA")):
                    pending_heads.append(heading)
                elif cur is not None:
                    cur["blocks"].append(heading)
                else:
                    pending_heads.append(heading)
            elif ev[0] == "p":
                t = ev[1]
                if cur is None:
                    log.append(f"text before first chapter: {t[:60]}")
                    continue
                blocks = cur["blocks"]
                prev = blocks[-1] if blocks and blocks[-1]["t"] == "p" else None
                if prev and not TERMINAL.search(prev["text"]) and not t.startswith(". .") \
                        and not re.match(r"""^["'\u201c\u2018]*\d+\.\s""", t):
                    prev["text"] = prev["text"] + " " + t
                    log.append(f"joined across page: ...{prev['text'][-40 - len(t):][:40]} | {t[:30]}")
                else:
                    blocks.append({"t": "p", "text": t})
            elif ev[0] == "note":
                if cur is not None:
                    cur["blocks"].append({"t": "note", "id": ev[1], "text": ev[2]})
    # tidy headings: Title Case the shouted book titles
    for s in sections:
        for b in s["blocks"]:
            if b["t"] == "h":
                b["text"] = tidy_head(b["text"])
    return sections, log


def tidy_head(t: str) -> str:
    t = t.replace("[THE FIRST BOOK OF]", "The First Book of")
    if t.isupper() or re.fullmatch(r"[\[\]A-Z .:,'-]+", t):
        small = {"of", "the", "a", "and", "in", "to"}
        words = t.lower().split()
        t = " ".join(w if (i and w.strip("[]:") in small) else w[:1].upper() + w[1:] if w[0] != "[" else "[" + w[1:2].upper() + w[2:]
                     for i, w in enumerate(words))
    return t


def main() -> int:
    sections, log = build()
    # merge "The First Book of" + "Pistis Sophia" into one heading
    for s in sections:
        bl = s["blocks"]
        for i in range(len(bl) - 1):
            if bl[i]["t"] == "h" and bl[i]["text"] == "The First Book of" and bl[i + 1]["t"] == "h":
                bl[i]["text"] = "The First Book of Pistis Sophia"
                del bl[i + 1]
                break
    first = sorted(PS.glob("ps*.htm"))
    shas = {p.name: sha256_file(p) for p in first}
    combined = __import__("hashlib").sha256("".join(f"{k}:{v}\n" for k, v in sorted(shas.items())).encode()).hexdigest()
    meta = (PS / "ps005.htm.meta").read_text()
    retrieved = re.search(r"retrieved=(\S+)", meta).group(1)
    work = {
        "id": "pistis-sophia",
        "title": "Pistis Sophia",
        "author": "gnostic-anonymous",
        "collection": "gnostic",
        "order": 1,
        "date": "3rd century (Coptic Askew Codex, 4th century)",
        "language": "Coptic",
        "translator": "G. R. S. Mead",
        "edition": "G. R. S. Mead, Pistis Sophia: A Gnostic Miscellany, revised edition (London: J. M. Watkins, 1921)",
        "source_url": "http://gnosis.org/library/pistis-sophia/index.htm",
        "source_sha256": combined,
        "retrieved": retrieved,
        "license": "Public domain",
        "license_basis": "Published 1921 (London: J. M. Watkins); published before 1931, so in the public domain in the United States",
        "summary": "A Gnostic dialogue from the Coptic Askew Codex in which the risen Jesus teaches the disciples "
                   "about the fall and rescue of Sophia and the heavenly mysteries. It is a historical document "
                   "of a movement the early church rejected.",
    }
    path = write_work(LIBRARY / "gnostic" / "pistis-sophia.toml", work, sections)
    (CACHE / "pistis-join.log").write_text("\n".join(log), encoding="utf-8")
    print("wrote", path.relative_to(LIBRARY.parent), len(sections), "sections;", len(log), "log lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
