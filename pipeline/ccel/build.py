"""Turn planned works (lists of ThML divs) into library sections and TOML files."""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from libtoml import slugify, words_in  # noqa: E402
from thml import Volume, blocks_of, div_title, is_div  # noqa: E402

LIMIT = 8000  # words of body text (notes excluded) above which a div splits at its child divs

ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
LABEL_RX = re.compile(
    r"^(?:the\s+)?(book|chapter|chap|homily|letter|epistle|sermon|psalm|question|article|part|section|"
    r"oration|lecture|discourse|treatise|tractate|canon|session|fragment|vision|commandment|similitude|"
    r"argument|catechetical lecture|exhortation|ep|hom|tract|session|act|letter)\.?\s+"
    r"([ivxlcdm]+|\d+)\b",
    re.I,
)


def to_roman(n: int) -> str:
    vals = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
            (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, r in vals:
        while n >= v:
            out += r
            n -= v
    return out


def roman_to_int(s: str) -> int | None:
    s = s.lower()
    if not s or any(ch not in ROMAN for ch in s):
        return None
    total = 0
    for i, ch in enumerate(s):
        v = ROMAN[ch]
        if i + 1 < len(s) and ROMAN[s[i + 1]] > v:
            total -= v
        else:
            total += v
    return total


def label_id(title: str) -> tuple[str, bool]:
    """Return (id, generic). generic means a numbered label that needs a parent prefix to be unique."""
    m = LABEL_RX.match(title.strip())
    if m:
        word = slugify(m.group(1))
        word = {"chap": "chapter", "ep": "letter", "hom": "homily", "tract": "tractate"}.get(word, word)
        num = m.group(2)
        n = int(num) if num.isdigit() else roman_to_int(num)
        if n is not None:
            return f"{word}-{n}", True
    s = slugify(title)
    parts = s.split("-")[:7]
    return "-".join(parts) or "section", False


def body_words(blocks: list) -> int:
    return sum(words_in(b["text"]) for b in blocks if b["t"] != "note")


def subtree_words(v: Volume, el) -> int:
    return body_words(flatten(v, el))


def norm(s: str) -> str:
    s = re.sub(r"\[\^[^\]]+\]", "", s).replace("*", "")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def toks(s: str) -> set:
    s = re.sub(r"\[\^[^\]]+\]", "", s).replace("*", "").lower()
    return set(re.findall(r"[a-z0-9À-ɏ]+", s)) - {"the", "of", "a", "an", "to", "and", "s"}


def tokens_match(head: str, titles) -> bool:
    h = toks(head)
    if not h:
        return False
    for t in titles:
        tt = toks(t or "")
        if tt and (tt <= h or h <= tt) and len(h & tt) >= max(1, min(len(h), len(tt)) * 0.8):
            return True
    return False


def strip_leading_heads(blocks: list, *titles: str) -> list:
    """Drop heading blocks at the start of a section that repeat the section title."""
    keys = [norm(t) for t in titles if t]
    out = list(blocks)
    while out and out[0]["t"] == "h":
        h = norm(out[0]["text"])
        if h and (any(h == k or (len(h) >= 4 and (h in k or k in h)) for k in keys) or tokens_match(out[0]["text"], titles)):
            refs = re.findall(r"\[\^([^\]]+)\]", out[0]["text"])
            out.pop(0)
            notes = []
            while out and out[0]["t"] == "note":
                notes.append(out.pop(0))
            if refs:
                # the heading carried footnotes: keep them on the first text block that follows
                for i, b in enumerate(out):
                    if b["t"] in ("p", "bq", "q", "h"):
                        b["text"] = "".join(f"[^{r}]" for r in refs) + " " + b["text"]
                        j = i + 1
                        while j < len(out) and out[j]["t"] == "note":
                            j += 1
                        out[j:j] = []
                        # notes must follow the block in marker order: put heading notes first
                        out[i + 1:i + 1] = notes
                        break
                else:
                    out = [{"t": "p", "text": "".join(f"[^{r}]" for r in refs) or "-"}] + notes + out
            continue
        break
    return out


def flatten(v: Volume, el, depth: int = 0) -> list:
    """All content of el, child divs rendered inline with their titles as h blocks."""
    blocks: list = []
    blocks_of(v, el, blocks, depth=depth)
    kids = [c for c in el if is_div(c)]
    if kids:
        # interleave: blocks_of skipped child divs; content after a child div is rare, so append
        for k in kids:
            kb = flatten(v, k, depth + 1)
            t = div_title(k)
            has_head = kb and kb[0]["t"] == "h"
            if not has_head:
                lvl = min(4, 2 + depth)
                hb = {"t": "h", "text": t}
                if lvl != 2:
                    hb["level"] = lvl
                blocks.append(hb)
            blocks.extend(kb)
    return blocks


class Builder:
    def __init__(self, v: Volume):
        self.v = v
        self.used: set[str] = set()  # div ids consumed
        self.unsplit: list[tuple[str, int]] = []

    def mark(self, el):
        for d in el.iter():
            if is_div(d) and d.get("id"):
                self.used.add(d.get("id"))

    def group_force(self, kids: list) -> bool:
        return any(any(is_div(g) for g in k) and subtree_words(self.v, k) > LIMIT for k in kids)

    def sectionize(self, el, level: int, title: str | None = None, force: bool = False) -> list:
        v = self.v
        if re.match(r"^\s*title page", el.get("title") or "", re.I) and subtree_words(v, el) < 80:
            return []
        title = title or div_title(el)
        kids = [c for c in el if is_div(c)]
        total = subtree_words(v, el)
        if not kids or (total <= LIMIT and not force):
            blocks = strip_leading_heads(flatten(v, el), title, el.get("title", ""), el.get("shorttitle", ""))
            if total > LIMIT:
                self.unsplit.append((el.get("id"), total))
            return [self.section(title, level, blocks, el)]
        lead: list = []
        blocks_of(v, el, lead)
        lead = strip_leading_heads(lead, title, el.get("title", ""), el.get("shorttitle", ""))
        out = []
        if any(b["t"] != "h" for b in lead):
            out.append(self.section(title, level, lead, el))
            pending = []
        else:
            pending = lead
        first = True
        gf = self.group_force(kids)
        for k in kids:
            if first and not out and not self.sectionize_probe(k):
                continue
            if first and not out:
                # container has no text of its own: its first child carries the container title
                sub = self.sectionize(k, level + 1, force=gf)
                head = sub[0]
                kt = div_title(k)
                hb = {"t": "h", "text": kt}
                head["blocks"] = pending + [hb] + head["blocks"]
                head["title"] = title
                head["level"] = level
                head["_el"] = el
                out.extend(sub)
            else:
                sub = self.sectionize(k, level + 1, force=gf)
                if not sub:
                    continue
                if pending:
                    sub[0]["blocks"] = pending + sub[0]["blocks"]
                    pending = []
                out.extend(sub)
            first = False
        return out

    def sectionize_probe(self, k) -> bool:
        return not (re.match(r"^\s*title page", k.get("title") or "", re.I) and subtree_words(self.v, k) < 80)

    def section(self, title: str, level: int, blocks: list, el) -> dict:
        return {"title": title, "level": level, "blocks": blocks, "_el": el}

    def work_sections(self, divs: list, unwrap: set, label=None, label_from=None) -> list:
        out = []
        gf_top = self.group_force([d for d in divs if d.get("id") not in unwrap])
        for el in divs:
            self.mark(el)
            if el.get("id") in unwrap:
                kids = [c for c in el if is_div(c)]
                lead: list = []
                blocks_of(self.v, el, lead)
                t = div_title(el)
                lead = strip_leading_heads(lead, t, el.get("title", ""), el.get("shorttitle", ""), getattr(self, "work_title", ""))
                pending = []
                if any(b["t"] != "h" for b in lead):
                    out.append(self.section(t, 1, lead, el))
                else:
                    pending = lead
                gf = self.group_force(kids)
                n = 0
                counting = False
                for k in kids:
                    kt = None
                    if label and (counting or k.get("id") == label_from):
                        counting = True
                        n += 1
                        kt = f"{label} {to_roman(n)}. {div_title(k)}"
                    sub = self.sectionize(k, 1, title=kt, force=gf)
                    if not sub:
                        continue
                    if pending:
                        sub[0]["blocks"] = pending + sub[0]["blocks"]
                        pending = []
                    out.extend(sub)
                if pending and out:
                    out[-1]["blocks"].extend(pending)
            else:
                out.extend(self.sectionize(el, 1, force=gf_top))
        return finalize(out)


def finalize(sections: list) -> list:
    """Assign unique ids, make note ids unique per section, drop empty sections, fix levels."""
    out = []
    for s in sections:
        if not any(b["t"] != "note" for b in s["blocks"]):
            if out:
                continue
        out.append(s)
    # ids
    seen: dict[str, int] = {}
    stack: list[tuple[int, str]] = []
    prev = 0
    for s in out:
        lvl = max(1, min(s["level"], prev + 1))
        s["level"] = lvl
        prev = lvl
        base, generic = label_id(s["title"])
        while stack and stack[-1][0] >= lvl:
            stack.pop()
        if generic and stack:
            sid = f"{stack[-1][1]}-{base}"
        else:
            sid = base
        sid = sid[:80].strip("-")
        if sid in seen:
            seen[sid] += 1
            sid2 = f"{sid}-{seen[sid]}"
            while sid2 in seen:
                seen[sid] += 1
                sid2 = f"{sid}-{seen[sid]}"
            sid = sid2
        seen[sid] = seen.get(sid, 1)
        s["id"] = sid
        stack.append((lvl, base if not (generic and len(stack)) else sid))
        fix_notes(s)
        if not s["blocks"]:
            s["blocks"] = [{"t": "p", "text": s["title"]}]
    return out


def fix_notes(s: dict):
    """Make note ids unique within the section and match markers to notes in order."""
    blocks = s["blocks"]
    used: dict[str, int] = {}
    new = []
    # map marker occurrences to following notes: process each text block with its trailing notes
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if b["t"] == "note":
            i += 1
            continue
        j = i + 1
        notes = []
        while j < len(blocks) and blocks[j]["t"] == "note":
            notes.append(blocks[j])
            j += 1
        refs = re.findall(r"\[\^([^\]]+)\]", b["text"])
        rename = {}
        k = 0
        text = b["text"]
        for r in refs:
            nid = r
            if nid in used:
                used[nid] += 1
                nn = f"{nid}-{used[nid]}"
                while nn in used:
                    used[nid] += 1
                    nn = f"{nid}-{used[nid]}"
                nid = nn
            used[nid] = used.get(nid, 1)
            rename[k] = nid
            k += 1
        cnt = iter(range(len(refs)))
        text = re.sub(r"\[\^([^\]]+)\]", lambda m: f"[^{rename[next(cnt)]}]", text)
        new.append(dict(b, text=text))
        # notes follow in marker order
        for idx, nb in enumerate(notes):
            if idx < len(refs):
                new.append(dict(nb, id=rename[idx]))
            # extra notes without marker are dropped (should not happen)
        i = j
    s["blocks"] = new
