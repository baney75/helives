"""Shared reader for archive.sacred-texts.com pages (Jubilees, Forgotten Books of Eden and the like).

extract(path) returns the page body as blocks: {"kind": "h", "level", "text"} or
{"kind": "p", "text", "center", "italic"}. It skips page-number anchors, footnote reference marks,
marginal tables, scripts and the site navigation, turns <i> into *italic* and "--" into an em dash
(as the printed books have it), and refuses any page or block that looks like a bot challenge.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

BAD = ("contentDocument", "__cf_chl", "challenge-platform", "<script", "function(")
EM = "\u2014"
LINE = "\ue000"  # stands for a <br> line break inside a block until the caller decides


def guard(text: str, where: str) -> None:
    for b in BAD:
        if b in text:
            raise SystemExit(f"{where}: refusing text containing {b!r} (bot challenge or script)")


def body_html(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="replace")
    ends = [i for i in (raw.find('<H3 ALIGN="CENTER">Footnotes'), raw.find('<nav'), raw.find('<div class="filenav"'),
                        raw.find("<p><HR>\n <CENTER>\n <A HREF=")) if i > 0]
    end = min(ends) if ends else len(raw)
    start = raw.find("</CENTER>\n <HR>")
    m = re.search(r"at sacred-texts\.com</FONT></P><HR>", raw[:end])
    if m:
        start = m.end()
    if start < 0:
        raise SystemExit(f"{path.name}: page start not found")
    html = raw[start:end]
    html = re.sub(r"(?is)<script.*?</script>", " ", html)
    guard(html, path.name)
    return html


class _Page(HTMLParser):
    SKIP = {"table", "script", "style", "sup"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict] = []
        self.cur: list[str] | None = None
        self.kind = None
        self.attrs: dict = {}
        self.skip = 0
        self.askip: list[bool] = []
        self.italic_all = 0
        self.fontskip: list[bool] = []  # green FONT marks page numbers and "[paragraph continues]"

    def _open(self, kind, attrs, level=0):
        self._close()
        self.cur, self.kind, self.attrs = [], kind, dict(attrs)
        self.attrs["level"] = level

    def _close(self):
        if self.cur is None:
            return
        text = clean("".join(self.cur))
        if text.strip("* "):
            b = {"kind": self.kind, "text": text}
            if self.kind == "h":
                b["level"] = self.attrs["level"]
            else:
                b["center"] = (self.attrs.get("align") or "").lower() == "center"
                b["italic"] = self.italic_all > 0
            self.blocks.append(b)
        self.cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in self.SKIP:
            self.skip += 1
            return
        if tag == "font" and (a.get("color") or "").lower() == "green":
            self.fontskip.append(True)
            self.skip += 1
            return
        if tag == "font":
            self.fontskip.append(False)
        if tag == "a":
            name, href = a.get("name") or "", a.get("href") or ""
            hide = name.startswith("page_") or "#fn_" in href
            self.askip.append(hide)
            if hide:
                self.skip += 1
            return
        if self.skip:
            return
        if tag in ("h1", "h2", "h3", "h4"):
            self._open("h", attrs, int(tag[1]))
        elif tag == "p":
            self._open("p", attrs)
        elif tag == "i":
            if self.cur is None:
                self.italic_all += 1
            else:
                self.cur.append("*")
        elif tag == "br" and self.cur is not None:
            self.cur.append(LINE)

    def handle_endtag(self, tag):
        if tag == "font":
            if self.fontskip and self.fontskip.pop():
                self.skip = max(0, self.skip - 1)
            return
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag == "a":
            if self.askip and self.askip.pop():
                self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag in ("h1", "h2", "h3", "h4", "p"):
            self._close()
        elif tag == "i":
            if self.cur is None:
                self.italic_all = max(0, self.italic_all - 1)
            else:
                self.cur.append("*")

    def handle_data(self, data):
        if self.skip:
            return
        if self.cur is None:
            if data.strip():
                self._open("p", [])
            else:
                return
        self.cur.append(data)


def clean(s: str) -> str:
    s = s.replace("\xa0", " ").replace("--", EM)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\*(\s*)\*", r"\1", s)                     # empty or touching italics
    s = re.sub(r"\*\s+([^*]+?)\s*\*", r" *\1* ", s)       # spaces inside italics go outside
    s = re.sub(r"\*([^*]+?)\s+\*", r"*\1* ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([,;:!?])", r"\1", s)
    s = re.sub(r"(?<=[^\s.])\s+\.(?!\s?\.)", ".", s)    # a lone period, not a spaced ". . ."
    s = re.sub(rf"\s*{LINE}[\s{LINE}]*", LINE, s).strip(LINE + " ")
    return s


def extract(path: Path, lines: bool = False) -> list[dict]:
    """Blocks of the page; with lines=True a <br> inside a block stays as stext.LINE."""
    p = _Page()
    p.feed(body_html(path))
    p.close()
    p._close()
    for b in p.blocks:
        guard(b["text"], path.name)
        if not lines:
            b["text"] = b["text"].replace(LINE, " ")
    return p.blocks
