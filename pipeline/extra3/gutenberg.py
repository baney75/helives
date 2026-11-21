"""Tokenize a Project Gutenberg HTML edition into a flat list of items (stdlib html.parser).

Items, in document order:
  ("h", level, text)          heading h1 to h6
  ("pre", text)               preformatted block (Gutenberg uses these for some titles)
  ("p", text, cls, anchors)   paragraph; footnote references become \x00<target>\x00 markers,
                              anchors lists the name/id values of <a> elements inside it
Italic becomes *...*, bold is dropped (Gutenberg uses it only for contents links).
Downloads are untrusted data: this parses them, never executes them.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

NOTE_HREF = re.compile(r"^#(link\w*?note-\w+)$")


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    try:
        return raw.decode("utf-8").lstrip("﻿")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


class _P(HTMLParser):
    BLOCK = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "pre"}

    def __init__(self, note_href=NOTE_HREF, extra_blocks=()):
        super().__init__(convert_charrefs=True)
        self.extra = set(extra_blocks)
        self.note_href = note_href
        self.span_stack: list[bool] = []
        self.items: list = []
        self.cur: list | None = None
        self.kind = None
        self.cls = None
        self.anchors: list[str] = []
        self.skip = 0  # inside a note-reference link: drop its visible number
        self.a_stack: list[bool] = []
        self.in_style = False

    def start_block(self, tag, attrs):
        self.end_block()
        self.cur = []
        self.kind = "p" if tag in self.extra else tag
        self.cls = dict(attrs).get("class") or (tag if tag in self.extra else None)
        self.anchors = []

    def end_block(self):
        if self.cur is None:
            return
        text = "".join(self.cur)
        if self.kind == "pre":
            self.items.append(("pre", text))
        else:
            text = " ".join(text.split())
            if self.kind == "p":
                self.items.append(("p", text, self.cls, self.anchors))
            else:
                self.items.append(("h", int(self.kind[1]), text))
        self.cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("style", "script"):
            self.in_style = True
            return
        if tag in self.BLOCK or tag in self.extra:
            self.start_block(tag, attrs)
            return
        if tag == "blockquote":
            return
        if tag == "a":
            for k in ("name", "id"):
                if a.get(k) and a[k] not in self.anchors:
                    self.anchors.append(a[k])
            m = self.note_href.match(a.get("href") or "")
            is_ref = bool(m) and "noteref" not in (a.get("href") or "")
            self.a_stack.append(is_ref)
            if is_ref:
                if self.cur is None:
                    self.start_block("p", [])
                self.cur.append(f"\x00{m.group(1)}\x00")
                self.skip += 1
            return
        if tag == "span":
            pn = "pagenum" in (a.get("class") or "")
            self.span_stack.append(pn)
            if pn:
                self.skip += 1
            return
        if self.cur is None:
            return
        if tag in ("i", "em", "cite"):
            self.cur.append("\x01")
        elif tag == "br":
            self.cur.append("\n" if self.kind == "pre" else " ")

    def handle_endtag(self, tag):
        if tag in ("style", "script"):
            self.in_style = False
            return
        if tag in self.BLOCK or tag in self.extra:
            self.end_block()
            return
        if tag == "a":
            if self.a_stack and self.a_stack.pop():
                self.skip -= 1
            return
        if tag == "span":
            if self.span_stack and self.span_stack.pop():
                self.skip -= 1
            return
        if self.cur is not None and tag in ("i", "em", "cite"):
            self.cur.append("\x02")

    def handle_data(self, data):
        if self.in_style or self.skip:
            return
        if self.cur is None:
            if data.strip():
                self.start_block("p", [])
            else:
                return
        self.cur.append(data)

    def close(self):
        super().close()
        self.end_block()


def tokenize(html_text: str, note_href=NOTE_HREF, extra_blocks=()) -> list:
    """note_href: regex for the href of a footnote reference link; group 1 is the target id.
    extra_blocks: further tags (dd, dt, li) to read as paragraphs, with the tag name as class."""
    p = _P(note_href, extra_blocks)
    p.feed(html_text)
    p.close()
    out = []
    for it in p.items:
        if it[0] == "pre":
            out.append(it)
            continue
        text = italics(it[2] if it[0] == "h" else it[1])
        out.append((it[0], it[1], text) if it[0] == "h" else ("p", text, it[2], it[3]))
    return out


def italics(s: str) -> str:
    def rep(m):
        inner = m.group(1)
        if not inner.strip() or "*" in inner:
            return inner
        lead = inner[: len(inner) - len(inner.lstrip())]
        trail = inner[len(inner.rstrip()):]
        return f"{lead}*{inner.strip()}*{trail}"

    s = re.sub(r"\x01([^\x01\x02]*)\x02", rep, s)
    s = s.replace("\x01", "").replace("\x02", "")
    return " ".join(s.split()) if "\n" not in s else s
