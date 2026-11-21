"""ThML (CCEL) to library blocks.

Standard library only. Source files are untrusted: run with `python3 -I`.
Converts a ThML element subtree into SCHEMA.md blocks:
  h, p, q, bq, note (with [^id] markers inline).
Drops: pb page breaks, index/insertIndex tags, scripCom/scripContext, images, hr rules.
Scripture references (scripRef) become plain text. Italic -> *...*, bold -> **...**.
"""
from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

CACHE = Path(__file__).resolve().parent.parent / "cache" / "ccel"

DIV_RX = re.compile(r"^div(\d)$")
HEAD_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
DROP_TAGS = {"pb", "index", "insertIndex", "scripCom", "scripContext", "img", "hr", "style"}
# characters the validator forbids in text; replaced with typographic look-alikes
CHAR_FIX = {"<": "‹", ">": "›", "{": "(", "}": ")", "\\": "/", "�": ""}
RULE_ONLY = re.compile(r"^[\s\-–—_‒―=·.•*]*$")


def is_div(el) -> bool:
    return bool(DIV_RX.match(el.tag)) or el.tag == "div"


def div_level(el) -> int:
    m = DIV_RX.match(el.tag)
    return int(m.group(1)) if m else 0


@dataclass
class Volume:
    name: str
    root: ET.Element
    body: ET.Element
    css: dict = field(default_factory=dict)
    by_id: dict = field(default_factory=dict)
    parent: dict = field(default_factory=dict)
    stats: dict = field(default_factory=lambda: {"img": 0, "table": 0, "charfix": 0, "nested_note": 0})

    def style(self, el) -> dict:
        cls = el.get("class")
        if not cls:
            return {}
        return self.css.get((el.tag, cls)) or self.css.get(("", cls)) or {}


def parse_css(head: ET.Element) -> dict:
    css: dict = {}
    for st in head.iter("style"):
        if st.get("type") != "text/css":
            continue
        for m in re.finditer(r"([A-Za-z0-9]*)\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}", st.text or ""):
            tag, cls, body = m.groups()
            props = {}
            for decl in body.split(";"):
                if ":" in decl:
                    k, v = decl.split(":", 1)
                    props[k.strip().lower()] = v.strip().lower()
            css[(tag.lower(), cls)] = props
    return css


def load(name: str) -> Volume:
    root = ET.parse(CACHE / f"{name}.xml").getroot()
    head = root.find("ThML.head")
    body = root.find("ThML.body")
    v = Volume(name, root, body, css=parse_css(head) if head is not None else {})
    strip_embedded_heads(body)
    for p in body.iter():
        for c in p:
            v.parent[c] = p
        if is_div(p) and p.get("id"):
            v.by_id[p.get("id")] = p
    return v


def strip_embedded_heads(body) -> int:
    """Remove ThML.head metadata blocks that CCEL embeds inside the body before each sub-work
    (authorID, workID, DC.Title, DC.Identifier URL). They are catalog data, not text; keep any tail text."""
    n = 0
    for parent in list(body.iter()):
        kids = list(parent)
        for i, c in enumerate(kids):
            if c.tag != "ThML.head":
                continue
            tail = c.tail or ""
            if tail.strip():
                if i > 0:
                    kids[i - 1].tail = (kids[i - 1].tail or "") + tail
                else:
                    parent.text = (parent.text or "") + tail
            parent.remove(c)
            n += 1
    return n


def header_text(v: Volume, tag: str) -> list[str]:
    head = v.root.find("ThML.head")
    return [" ".join("".join(e.itertext()).split()) for e in head.iter(tag)]


# ---------------------------------------------------------------- inline


def clean(s: str, v: Volume | None = None) -> str:
    if "&" in s:
        s = html.unescape(s)
    out = []
    for ch in s:
        if ch in CHAR_FIX:
            if v is not None:
                v.stats["charfix"] += 1
            out.append(CHAR_FIX[ch])
        else:
            out.append(ch)
    s = "".join(out)
    s = s.replace("­", "")  # soft hyphen
    s = re.sub(r"[ \t\r\n  -   　]+", " ", s)
    return s


class Inline:
    """Accumulates inline text for one block; collects footnotes."""

    def __init__(self, v: Volume, notes: list, in_note: bool = False):
        self.v = v
        self.parts: list[str] = []
        self.notes = notes
        self.in_note = in_note

    def text(self) -> str:
        s = "".join(self.parts)
        s = re.sub(r"\s+", " ", s).strip()
        # a footnote marker never follows a space
        s = re.sub(r"\s+(\[\^[^\]]+\])", r"\1", s)
        s = fix_page_marker(s)
        return s


def fix_page_marker(s: str) -> str:
    # "p. 23]" in editors' bracketed notes trips the page-marker lint; separate digit and bracket
    return re.sub(r"(\bp\.\s*\d+)\]", r"\1 ]", s)


def emph_wrap(inner: str, mark: str) -> str:
    """Wrap inner text in *...* or **...**, keeping surrounding whitespace outside."""
    if not inner.strip():
        return inner
    if "*" in inner:  # nested emphasis or a literal asterisk: drop this layer
        return inner
    m = re.match(r"^(\s*)(.*?)(\s*)$", inner, re.S)
    lead, core, trail = m.groups()
    # move leading/trailing punctuation-free footnote markers inside is fine; keep simple
    return f"{lead}{mark}{core}{mark}{trail}"


def span_kind(v: Volume, el) -> str | None:
    st = v.style(el)
    if st.get("font-style") == "italic":
        return "i"
    if st.get("font-weight") in ("bold", "700", "800", "900"):
        return "b"
    return None


def inline_of(v: Volume, el, acc: Inline, include_tail=False):
    """Append the inline rendering of el's content (not el's tail unless asked) to acc.parts."""
    if el.text:
        acc.parts.append(clean(el.text, v))
    for c in el:
        render_inline_child(v, c, acc)
        if c.tail:
            acc.parts.append(clean(c.tail, v))


def sub_text(v: Volume, el, acc: Inline) -> str:
    sub = Inline(v, acc.notes, acc.in_note)
    inline_of(v, el, sub)
    return "".join(sub.parts)


def render_inline_child(v: Volume, c, acc: Inline):
    tag = c.tag
    if tag in DROP_TAGS:
        if tag == "img":
            v.stats["img"] += 1
        return
    if tag == "note":
        if acc.in_note:
            v.stats["nested_note"] += 1
            # nested note: inline its text in brackets
            acc.parts.append(" [" + note_text(v, c) + "]")
            return
        nid = c.get("n") or str(len(acc.notes) + 1)
        nid = re.sub(r"[^A-Za-z0-9_.-]", "", nid) or str(len(acc.notes) + 1)
        acc.notes.append((nid, note_text(v, c)))
        acc.parts.append(f"\x00{len(acc.notes) - 1}\x00")
        return
    if tag == "br":
        acc.parts.append(" ")
        return
    if tag in ("i", "em", "cite"):
        if tag == "cite" and not c.get("class"):
            acc.parts.append(sub_text(v, c, acc))
            return
        acc.parts.append(emph_wrap(sub_text(v, c, acc), "*"))
        return
    if tag in ("b", "strong"):
        acc.parts.append(emph_wrap(sub_text(v, c, acc), "**"))
        return
    if tag == "span":
        k = span_kind(v, c)
        t = sub_text(v, c, acc)
        if k == "i":
            t = emph_wrap(t, "*")
        elif k == "b":
            t = emph_wrap(t, "**")
        acc.parts.append(t)
        return
    if tag in ("p", "div") or is_div(c) or tag in HEAD_TAGS:
        # block inside inline context (e.g. p inside note): separate by space
        acc.parts.append(" " + sub_text(v, c, acc) + " ")
        return
    if tag == "table":
        v.stats["table"] += 1
    # scripRef, a, name, sup, sub, q, attr, span-like and unknown: keep text
    acc.parts.append(sub_text(v, c, acc))


def note_text(v: Volume, note) -> str:
    acc = Inline(v, [], in_note=True)
    inline_of(v, note, acc)
    t = acc.text()
    t = t.replace("\x00", "")
    return t


# ---------------------------------------------------------------- blocks


def finish(v: Volume, kind: str, acc: Inline, blocks: list, extra: dict | None = None, nmap=None):
    """Turn an Inline accumulator into a block plus its note blocks."""
    s = acc.text()
    notes = acc.notes
    out_notes = []

    def sub(m):
        idx = int(m.group(1))
        nid, ntext = notes[idx]
        if not ntext.strip():
            v.stats["empty_note"] = v.stats.get("empty_note", 0) + 1
            return ""
        nid = nmap(nid) if nmap else nid
        out_notes.append({"t": "note", "id": nid, "text": ntext})
        return f"[^{nid}]"

    s = re.sub(r"\x00(\d+)\x00", sub, s)
    s = re.sub(r"\s+(\[\^)", r"\1", s).strip()
    if s and not RULE_ONLY.match(re.sub(r"\[\^[^\]]+\]", "", s)):
        b = {"t": kind, "text": s}
        if extra:
            b.update(extra)
        blocks.append(b)
    elif out_notes:
        # a note attached to nothing visible: keep the notes, marker on an empty line is lost,
        # so attach marker to previous block if any
        if blocks:
            prev = blocks[-1]
            prev["text"] = prev["text"] + "".join(f"[^{n['id']}]" for n in out_notes)
        else:
            blocks.append({"t": "p", "text": "".join(f"[^{n['id']}]" for n in out_notes) or "—"})
    blocks.extend(out_notes)


def heading_like(v: Volume, el) -> bool:
    st = v.style(el)
    if st.get("text-align") == "center":
        n = len("".join(el.itertext()).split())
        return 0 < n <= 30
    return False


def blockquote_like(v: Volume, el) -> bool:
    st = v.style(el)
    ml = st.get("margin-left", "")
    m = re.match(r"([\d.]+)(in|pt|em|cm|px)", ml)
    if not m:
        return False
    val, unit = float(m.group(1)), m.group(2)
    inches = {"in": 1, "pt": 1 / 72, "em": 1 / 6, "cm": 1 / 2.54, "px": 1 / 96}[unit] * val
    ti = st.get("text-indent", "")
    hanging = ti.startswith("-")
    return inches >= 0.4 and not hanging


def blocks_of(v: Volume, el, blocks: list, depth: int = 0, stop_at_div=True):
    """Convert the block-level children of el (not descending into child divs) to blocks.

    Text directly inside el (not in a p) is treated as a paragraph."""
    loose = Inline(v, [])

    def flush_loose():
        nonlocal loose
        if "".join(loose.parts).strip():
            finish(v, "p", loose, blocks)
        loose = Inline(v, [])

    if el.text and el.text.strip():
        loose.parts.append(clean(el.text, v))
    for c in el:
        tag = c.tag
        if is_div(c) and stop_at_div:
            flush_loose()
            # caller handles child divs; tails after divs are rare whitespace
            if c.tail and c.tail.strip():
                loose.parts.append(clean(c.tail, v))
            continue
        if tag in DROP_TAGS or tag == "note" and False:
            if tag == "img":
                v.stats["img"] += 1
            if c.tail and c.tail.strip():
                loose.parts.append(clean(c.tail, v))
            continue
        if tag in ("p",) or tag in HEAD_TAGS or tag in ("blockquote", "verse", "table", "ul", "ol", "li", "l") or is_div(c):
            flush_loose()
            block_el(v, c, blocks, depth)
            if c.tail and c.tail.strip():
                loose.parts.append(clean(c.tail, v))
        else:
            render_inline_child(v, c, loose)
            if c.tail:
                loose.parts.append(clean(c.tail, v))
    flush_loose()


def has_block_children(el) -> bool:
    return any(c.tag in ("p", "blockquote", "verse", "table", "ul", "ol") or c.tag in HEAD_TAGS for c in el)


def block_el(v: Volume, c, blocks: list, depth: int):
    tag = c.tag
    if tag in HEAD_TAGS:
        acc = Inline(v, [])
        inline_of(v, c, acc)
        lvl = min(4, 2 + depth)
        finish(v, "h", acc, blocks, {"level": lvl} if lvl != 2 else None)
        return
    if tag == "p":
        if has_block_children(c):
            blocks_of(v, c, blocks, depth)
            return
        acc = Inline(v, [])
        inline_of(v, c, acc)
        if heading_like(v, c):
            plain = re.sub(r"\x00\d+\x00", "", acc.text())
            if len(plain.split()) <= 30:
                lvl = min(4, 2 + depth)
                finish(v, "h", acc, blocks, {"level": lvl} if lvl != 2 else None)
                return
        kind = "bq" if blockquote_like(v, c) else "p"
        finish(v, kind, acc, blocks)
        return
    if tag == "blockquote":
        if has_block_children(c):
            sub: list = []
            blocks_of(v, c, sub, depth)
            for b in sub:
                if b["t"] in ("p",):
                    b["t"] = "bq"
            blocks.extend(sub)
        else:
            acc = Inline(v, [])
            inline_of(v, c, acc)
            finish(v, "bq", acc, blocks)
        return
    if tag == "verse":
        for l in c:
            if l.tag == "l":
                block_el(v, l, blocks, depth)
            elif l.tag in DROP_TAGS:
                continue
            else:
                block_el(v, l, blocks, depth)
        return
    if tag == "l":
        acc = Inline(v, [])
        inline_of(v, c, acc)
        cls = c.get("class") or ""
        m = re.match(r"t(\d)", cls)
        ind = int(m.group(1)) - 1 if m else 0
        finish(v, "q", acc, blocks, {"indent": min(3, ind)} if ind > 0 else None)
        return
    if tag == "table":
        v.stats["table"] += 1
        for tr in c.iter("tr"):
            cells = []
            for td in tr:
                if td.tag not in ("td", "th"):
                    continue
                acc_cell = Inline(v, [])
                inline_of(v, td, acc_cell)
                cells.append(acc_cell)
            # merge cells into one row block, keeping notes
            row = Inline(v, [])
            parts = []
            for ac in cells:
                t = "".join(ac.parts).strip()
                if t:
                    # renumber note placeholders into the row accumulator
                    def rn(m, ac=ac):
                        row.notes.append(ac.notes[int(m.group(1))])
                        return f"\x00{len(row.notes) - 1}\x00"

                    parts.append(re.sub(r"\x00(\d+)\x00", rn, t))
            row.parts = [" | ".join(parts)]
            finish(v, "p", row, blocks)
        return
    if tag in ("ul", "ol"):
        for li in c:
            block_el(v, li, blocks, depth)
        return
    if tag == "li":
        if has_block_children(c):
            blocks_of(v, c, blocks, depth)
        else:
            acc = Inline(v, [])
            inline_of(v, c, acc)
            finish(v, "p", acc, blocks)
        return
    if is_div(c):
        blocks_of(v, c, blocks, depth)
        return
    acc = Inline(v, [])
    inline_of(v, c, acc)
    finish(v, "p", acc, blocks)


def div_title(el) -> str:
    t = " ".join((el.get("title") or "").split())
    st = " ".join((el.get("shorttitle") or "").split())
    trunc = st.endswith("...") or st.endswith("…")
    if not t:
        return st.rstrip(".…") or "Untitled"
    if st and not trunc and st != t:
        if len(t) > 220:
            return st
        if not t.lower().startswith(st.lower().rstrip(".")):
            return f"{st.rstrip('.')}. {t}"
    return t
