"""Read the English text of a confession from Schaff, The Creeds of Christendom, Vol. III (CCEL ThML).

Schaff prints most confessions in two columns, original (Latin, German or French) beside English,
in tables broken at each printed page. This module walks a document's div in reading order, keeps
only the English column, and returns a flat stream of blocks:
  {"t": "h", ...}   centered rows and headings
  {"t": "p", ...}   body paragraphs; a paragraph broken by a page turn is joined back together
  {"t": "note", ...} Schaff's notes on the English column, ids unique within the document
Inline conversion and notes reuse pipeline/ccel/thml.py (Inline, inline_of, finish, blocks_of).
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.append(str(HERE.parent / "ccel"))
import thml  # noqa: E402  (pipeline/ccel/thml.py)

CACHE = HERE.parent / "cache" / "extra3"
TERMINAL = re.compile(r"[.?!:;)\]\"'’”—]\**\s*(\[\^[^\]]+\])*\s*$")


def load(name: str = "creeds3.xml") -> thml.Volume:
    root = ET.parse(CACHE / name).getroot()
    head = root.find("ThML.head")
    body = root.find("ThML.body")
    v = thml.Volume(name, root, body, css=thml.parse_css(head) if head is not None else {})
    thml.strip_embedded_heads(body)
    for p in body.iter():
        for c in p:
            v.parent[c] = p
        if p.get("id"):
            v.by_id[p.get("id")] = p
    return v


def centered(el) -> bool:
    st = (el.get("style") or "").replace(" ", "").lower()
    return "text-align:center" in st


def cell_blocks(v, el, heading: bool) -> list:
    blocks: list = []
    if heading:
        acc = thml.Inline(v, [])
        thml.inline_of(v, el, acc)
        thml.finish(v, "h", acc, blocks)
    elif any(c.tag in ("p", "table", "blockquote", "ul", "ol") for c in el):
        thml.blocks_of(v, el, blocks)
    else:
        acc = thml.Inline(v, [])
        thml.inline_of(v, el, acc)
        thml.finish(v, "p", acc, blocks)
    return blocks


class Stream:
    def __init__(self, v, pick=None):
        self.v = v
        self.pick = pick or (lambda cells: [cells[-1]])
        self.blocks: list = []
        self.note_ids: set[str] = set()
        self.cont_next = False

    def add(self, new: list, row_cont: bool):
        # unique note ids across the document
        remap = {}
        for b in new:
            if b["t"] == "note":
                nid = b["id"]
                k = nid
                n = 2
                while k in self.note_ids:
                    k = f"{nid}-{n}"
                    n += 1
                self.note_ids.add(k)
                remap[nid] = k
                b["id"] = k
        if remap:
            for b in new:
                if b["t"] != "note":
                    b["text"] = re.sub(r"\[\^([^\]]+)\]", lambda m: f"[^{remap.get(m.group(1), m.group(1))}]", b["text"])
        body = [b for b in new if b["t"] != "note"]
        notes = [b for b in new if b["t"] == "note"]
        if body and body[0]["t"] == "p" and row_cont:
            prev = next((b for b in reversed(self.blocks) if b["t"] != "note"), None)
            lower = bool(re.match(r"^[a-z]", body[0]["text"]))
            if prev is not None and prev["t"] == "p" and (lower or not TERMINAL.search(prev["text"])):
                prev["text"] = prev["text"] + (" " if not prev["text"].endswith("-") else "") + body[0]["text"]
                body = body[1:]
        self.blocks.extend(body + notes)

    def walk(self, el):
        for c in el:
            tag = c.tag
            if tag == "table":
                self.table(c)
            elif tag in ("pb", "note") or tag in thml.DROP_TAGS:
                continue
            elif tag in ("p", "h1", "h2", "h3", "h4", "h5", "h6"):
                heading = tag.startswith("h") or centered(c)
                self.add(cell_blocks(self.v, c, heading), not heading)
            elif tag == "verse":
                b: list = []
                thml.block_el(self.v, c, b, 0)
                self.add(b, False)
            else:  # div wrappers, blockquote
                self.walk(c)

    def table(self, t):
        for tr in t.iter("tr"):
            cells = [x for x in tr if x.tag in ("td", "th")]
            if not cells:
                continue
            for cell in (self.pick(cells) if len(cells) > 1 else cells):
                heading = centered(tr) or centered(cell) or cell.tag == "th"
                txt = " ".join("".join(cell.itertext()).split())
                if not txt or re.fullmatch(r"[—\-–_ .*]+", txt):
                    continue
                self.add(cell_blocks(self.v, cell, heading), not heading)


def english(v, div_id: str, pick=None) -> list:
    s = Stream(v, pick)
    s.walk(v.by_id[div_id])
    return s.blocks
