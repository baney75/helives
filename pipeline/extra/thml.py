"""Minimal ThML/HTML fragment reader for the extra ingests.

Turns a fragment into paragraphs of inline text: <i>/<em> -> *x*, <b> -> **x**, notes -> [^n] with
the note text collected separately, page breaks and other markup dropped. Tables come back as
rows of cells, each cell a list of paragraphs.
"""
from __future__ import annotations

import html
import re
from html.parser import HTMLParser

BLOCK_TAGS = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br", "div", "blockquote"}


IT, BD = "\x02", "\x03"   # private italic/bold markers emitted by Reader


def _pairs(s: str, mark: str, md: str) -> str:
    parts = s.split(mark)
    out = [parts[0]]
    for k in range(1, len(parts), 2):
        inner = parts[k]
        rest = parts[k + 1] if k + 1 < len(parts) else ""
        core = inner.strip()
        if core:
            lead = inner[: len(inner) - len(inner.lstrip())]
            trail = inner[len(inner.rstrip()):]
            out.append(f"{lead}{md}{core}{md}{trail}")
        else:
            out.append(inner)
        out.append(rest)
    return "".join(out)


def clean_inline(s: str) -> str:
    s = html.unescape(s)
    s = s.replace("\u00ad", "").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s)
    # adjacent runs merge: "</i><i>" and "</i> <i>"
    s = re.sub(IT + r"(\s*)" + IT, r"\1", s)
    s = re.sub(BD + r"(\s*)" + BD, r"\1", s)
    s = _pairs(s, BD, "**")
    s = _pairs(s, IT, "*")
    s = s.replace(IT, "").replace(BD, "")
    s = re.sub(r"\s+([,.;:!?)\]])", r"\1", s)
    s = re.sub(r"([(\[])\s+", r"\1", s)
    s = re.sub(r"\s+(\[\^)", r"\1", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


class Reader(HTMLParser):
    def __init__(self, keep_notes: bool = True):
        super().__init__(convert_charrefs=False)
        self.keep_notes = keep_notes
        self.paras: list[str] = []
        self.buf: list[str] = []
        self.notes: list[tuple[str, str]] = []
        self.note_depth = 0
        self.note_buf: list[str] = []
        self.note_n = ""
        self.skip = 0

    def _flush(self):
        t = clean_inline("".join(self.buf))
        if t:
            self.paras.append(t)
        self.buf = []

    def _out(self):
        return self.note_buf if self.note_depth else self.buf

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "note":
            self.note_depth += 1
            if self.note_depth == 1:
                self.note_n = a.get("n", str(len(self.notes) + 1))
                self.note_buf = []
            return
        if tag in ("pb", "img", "hr"):
            return
        if tag in ("script", "style"):
            self.skip += 1
            return
        if tag in ("i", "em"):
            self._out().append(IT)
        elif tag in ("b", "strong"):
            self._out().append(BD)
        elif tag in BLOCK_TAGS and not self.note_depth:
            self._flush()
        elif tag in BLOCK_TAGS and self.note_depth:
            self.note_buf.append(" ")

    def handle_startendtag(self, tag, attrs):
        if tag == "br":
            self._out().append(" ")

    def handle_endtag(self, tag):
        if tag == "note":
            self.note_depth -= 1
            if self.note_depth == 0:
                text = clean_inline("".join(self.note_buf))
                if self.keep_notes and text:
                    self.notes.append((self.note_n, text))
                    self.buf.append(f"[^{self.note_n}]")
            return
        if tag in ("script", "style"):
            self.skip -= 1
            return
        if tag in ("i", "em"):
            self._out().append(IT)
        elif tag in ("b", "strong"):
            self._out().append(BD)
        elif tag in BLOCK_TAGS and not self.note_depth:
            self._flush()

    def handle_data(self, data):
        if not self.skip:
            self._out().append(data)

    def handle_entityref(self, name):
        self._out().append(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        self._out().append(html.unescape(f"&#{name};"))

    def close(self):
        super().close()
        self._flush()


def read(fragment: str, keep_notes: bool = True) -> tuple[list[str], list[tuple[str, str]]]:
    r = Reader(keep_notes)
    r.feed(fragment)
    r.close()
    return r.paras, r.notes


def table_cells(fragment: str) -> list[list[str]]:
    """Return rows -> list of raw cell fragments for every <table> in the fragment, in order."""
    rows = []
    for tr in re.findall(r"<tr\b.*?</tr>", fragment, flags=re.S):
        rows.append(re.findall(r"<td\b[^>]*>(.*?)</td>", tr, flags=re.S))
    return rows


def div(src: str, title: str) -> str:
    """Raw text of the div whose title attribute equals title, up to the next div start."""
    i = src.find(f'title="{title}"')
    if i < 0:
        raise KeyError(title)
    i = src.find(">", i) + 1
    j = src.find("<div", i)
    return src[i:j if j > 0 else len(src)]
