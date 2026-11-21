"""Ingest 1 Enoch in R. H. Charles' translation (London: SPCK, 1917, Translations of Early Documents).

Usage: python3 -I pipeline/extra2/ingest_enoch.py [--report]
Base text: the sacred-texts.com transcription of the 1917 edition (archive.sacred-texts.com/bib/boe/),
cached in pipeline/cache/extra2/boe-arch/. Checked word by word against the archive.org scan of the
1917 printing (bookofenoch0000unse, OCR in pipeline/cache/extra2/enoch1917_djvu.txt).

Kept: Charles' list of brackets and symbols, the translation (chapters 1 to 108 in the order the 1917
edition prints them), his section headings, his critical signs (corner brackets, angle brackets, square
and round brackets, daggers) and his thick type for emended words (as bold), the parallel Ethiopic (E)
and Greek (Gg) columns (each column in turn), and the editors' one footnote.
Dropped: the editors' preface, Oesterley's introduction, page numbers and the transcriber's errata link.
Repaired from the scan: verse numbers the transcription dropped (found by aligning the text with the
OCR and locating the printed number), and the readings listed in CORRECTIONS.
"""
from __future__ import annotations

import hashlib
import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from align import align, as_number, ocr_tokens, words_with_pos  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

BOE = CACHE / "boe-arch"
OCR = CACHE / "enoch1917_djvu.txt"
OUT = LIBRARY / "pseudepigrapha" / "1-enoch.toml"

ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}

# Readings where the transcription differs from the 1917 printing, each checked on the scan.
# (section id or "*", wrong text, printed text)
CORRECTIONS: list[tuple[str, str, str]] = [
    ("68", "astonished", "astonied"),  # transcriber's erratum changed the printed word
    # seen on the page image
    ("4", "burns with growing heat", "burns with glowing heat"),
    ("61", "the Cherubic, Seraphin", "the Cherubin, Seraphin"),
    ("71", "Seraphin, Cherubic, and", "Seraphin, Cherubin, and"),
    ("76", "The Twelve Windows and", "The Twelve Winds and"),
    ("94", "nor in the paths of death", "nor on the paths of death"),
    ("102", "shall be cursed for ever", "shall be accursed for ever"),
    ("104", "away your hopes for", "away your hope; for"),
    ("104", "searched out and be written down", "searched out and written down"),
    ("108", "they indeed will go", "they indeed shall go"),
    # the OCR shows a clean, different word (British or older spelling, or a transcription slip)
    ("14", "As He has created", "As He hath created"),
    ("20", "XX. Name and Functions", "XX. Names and Functions"),
    ("22", "'Why as one separated", "'Why is one separated"),
    ("22", "in which there as the", "in which there is the"),
    ("26", "marveled", "marvelled"),
    ("39", "For so has it been", "For so hath it been"),
    ("47", "His counselors", "His counsellors"),
    ("60", "forsaken his chambers", "forsaken his chamber"),
    ("65", "who practice sorcery", "who practise sorcery"),
    ("71", "never forsaketh", "never forsakes"),
    ("72", "is equalized with", "is equalised with"),
    ("73", "setting change every", "setting changes every"),
    ("80", "thou shouldst see", "thou shouldest see"),
    ("80", "Bodies owning to", "Bodies owing to"),
    ("81", "who practice righteousness", "who practise righteousness"),
    ("89", "no more of ought", "no more of aught"),
    ("90", "had beer folded", "had been folded"),
    ("95", "to practice reproaches", "to practise reproaches"),
    ("99", "have worshiped", "have worshipped"),
    ("100", "godlessness as wrought", "godlessness has wrought"),
    ("104", "and practice great deceits", "and practise great deceits"),
    ("104", "minish ought", "minish aught"),
    ("106", "have begot children", "have begotten children"),
    # words dropped, added or reordered by the transcription (OCR of the page reads cleanly)
    ("9", "and Thou seest all things,", "and all things Thou seest,"),
    ("39", "And their lips extol", "And their lips shall extol"),
    ("61", "On that day shall raise", "On that day shall they raise"),
    ("62", "And the darkness grow deeper", "And the darkness shall grow deeper"),
    ("63", "We follow hard upon and obtain", "We follow hard upon (it) and obtain"),
    ("68", "in the book in the Parables", "in the book and in the Parables"),
    ("78", "it is s transferred", "it is transferred"),
    ("78", "accomplished full in the heaven", "accomplished in the heaven"),
    ("103", "and not hoped to see", "and hoped not to see"),
    ("13", "bidding (me)⌉ I to tell", "bidding (me)⌉ to tell"),
]


# Fixes to the transcription HTML before parsing, each checked on the scan: (page, wrong, printed).
PRE_FIXES: list[tuple[str, str, str]] = [
    ("boe033.htm", "1 .And beyond", "1. And beyond"),  # misplaced period
    ("boe049.htm", "4, And this Son", "4. And this Son"),
    ("boe049.htm", "This is the son of Man", "This is the Son of Man"),  # scan p. 64
    ("boe104.htm", "2 .For a man", "2. For a man"),
    ("boe107.htm", "Honoured and 2 Mighty", "Honoured and Mighty"),  # stray page-line number
    ("boe081.htm", "CHAPTER LXXVII.", "CHAPTER LXXVIII."),  # scan p. 104: LXXVIII
    ("boe085.htm", "13. And the names of those who lead them", "14. And the names of those who lead them"),
]


def roman(s: str) -> int:
    s = s.upper()
    total = 0
    for i, c in enumerate(s):
        v = ROMAN[c]
        total += -v if i + 1 < len(s) and ROMAN[s[i + 1]] > v else v
    return total


class Page(HTMLParser):
    """Turn one page into blocks: {kind, lines: [[(text, bold, italic), ...]], poetry, table, col}."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict] = []
        self.notes: dict[str, str] = {}
        self.cur: dict | None = None
        self.bold = False
        self.ital = 0
        self.dir = 0
        self.skip = 0
        self.a_stack: list[bool] = []
        self.span_stack: list[bool] = []
        self.table = 0
        self.col = None
        self.tdi = -1
        self.in_notes = False
        self.note_id = ""
        self.note_buf: list[str] = []
        self.started = False

    def _open(self, kind):
        self._close()
        self.cur = {"kind": kind, "lines": [[]], "poetry": self.dir > 0,
                    "table": self.table if self.col is not None else 0, "col": self.col}

    def _close(self):
        if self.cur is not None:
            self.blocks.append(self.cur)
        self.cur = None

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if self.in_notes:
            if tag == "a" and a.get("name", "").startswith("fn_"):
                self.note_id = a["name"][3:]
                self.note_buf = []
            elif tag == "a" and a.get("href", ""):
                self.skip += 1
                self.a_stack.append(True)
            elif tag == "a":
                self.a_stack.append(False)
            return
        if tag == "span":
            cn = a.get("class", "") == "contnote"
            self.span_stack.append(cn)
            if cn:
                self.skip += 1
                if self.cur is not None:
                    self.cur["contnote"] = True
            return
        if tag == "b":
            self.bold = True
        elif tag == "i":
            self.ital += 1
        elif tag == "dir":
            self.dir += 1
        elif tag == "table":
            self._close()
            self.table += 1
        elif tag == "tr":
            self.tdi = -1
        elif tag == "td":
            self._close()
            self.tdi += 1
            self.col = self.tdi
        elif tag in ("p", "h1", "h2", "h3"):
            kind = tag
            if tag == "p" and a.get("align", "").upper() == "CENTER":
                kind = "center"
            self._open(kind)
        elif tag == "br":
            if self.cur is not None:
                self.cur["lines"].append([])
        elif tag == "a":
            name, href = a.get("name", ""), a.get("href", "")
            if name.startswith("page_"):
                self._close()
                self.blocks.append({"kind": "page", "table": self.table if self.col is not None else 0,
                                    "col": self.col})
                self.skip += 1
                self.a_stack.append(True)
            elif href.startswith("#fn_"):
                self._text(f"[^{href[4:]}]", raw=True)
                self.skip += 1
                self.a_stack.append(True)
            elif name:
                self.a_stack.append(False)
            else:
                self.a_stack.append(False)  # errata link: keep its text

    def handle_endtag(self, tag):
        if tag == "a":
            if self.a_stack and self.a_stack.pop():
                self.skip -= 1
            return
        if tag == "span":
            if self.span_stack and self.span_stack.pop():
                self.skip -= 1
            return
        if self.in_notes:
            if tag == "p" and self.note_id:
                self.notes[self.note_id] = "".join(self.note_buf)
                self.note_id = ""
            return
        if tag == "b":
            self.bold = False
        elif tag == "i":
            self.ital = max(0, self.ital - 1)
        elif tag == "dir":
            self.dir = max(0, self.dir - 1)
        elif tag in ("p", "h1", "h2", "h3"):
            self._close()
        elif tag == "td":
            self._close()
            self.col = None
        elif tag == "table":
            self._close()
            self.col = None

    def _text(self, s, raw=False):
        if self.cur is None:
            if not s.strip():
                return
            self._open("p")
        self.cur["lines"][-1].append((s, self.bold and not raw, bool(self.ital) and not raw, raw))

    def handle_data(self, data):
        if self.in_notes:
            if self.note_id and not self.skip:
                self.note_buf.append(data)
            return
        if data.strip() == "Footnotes" and self.cur and self.cur["kind"] == "h3":
            self.cur = None
            self.in_notes = True
            return
        if self.skip:
            return
        self._text(data)

    def close(self):
        super().close()
        self._close()


def body(path: Path) -> str:
    t = path.read_text(encoding="utf-8")
    t = t.replace("&#146;", "’").replace("&#145;", "‘")
    for page, old, new in PRE_FIXES:
        if page == path.name:
            if old not in t:
                raise SystemExit(f"pre-fix not found: {page} {old!r}")
            t = t.replace(old, new)
    i = t.find("</FONT></P><HR>")
    j = min(x for x in (t.find('<div class="filenav">', i), t.find("<nav", i), len(t)) if x > 0)
    out = t[i + len("</FONT></P><HR>"):j]
    guard(out, path.name)
    return out


BAD = ("contentDocument", "__cf_chl", "challenge-platform", "<script", "function(")


def guard(text: str, where: str) -> None:
    """Refuse a scraped page or block that holds script or a Cloudflare challenge instead of text."""
    for bad in BAD:
        if bad in text:
            raise SystemExit(f"{where}: page content holds {bad!r}; refetch from a source that serves the text")


def render_line(chunks) -> str:
    """Chunks to text with *italic* and **bold**; markers hug the words, never the spaces."""
    runs: list[list] = []
    for text, b, it, raw in chunks:
        text = text.replace("\xa0", " ").replace("\n", " ")
        style = "raw" if raw else ("b" if b else ("i" if it else ""))
        if runs and runs[-1][0] == style:
            runs[-1][1] += text
        else:
            runs.append([style, text])
    out = []
    for style, text in runs:
        if style in ("b", "i") and text.strip():
            m = re.match(r"^(\s*)(.*?)(\s*)$", text, re.S)
            mk = "**" if style == "b" else "*"
            inner = m.group(2)
            # keep closing punctuation outside the marker as typeset
            out.append(f"{m.group(1)}{mk}{inner}{mk}{m.group(3)}")
        else:
            out.append(text)
    s = re.sub(r"\s+", " ", "".join(out)).strip()
    s = s.replace("--", "\u2014")
    s = re.sub(r"\*\*\s*\*\*", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def plain(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("*", "")).strip()


RANGE_ONLY = re.compile(r"^\(?[IVXLC]+-[IVXLC]+\.?\)?$")
CHAPTER = re.compile(r"^chapter\s+([IVXLC]+)\.?$", re.I)
MARK = re.compile(r"(?:(?<=[\s\[{])|^)(\d{1,3}|l)(\*[a-f]\*|[a-f])?(\.?)(?=\s)")


def page_blocks(path: Path):
    p = Page()
    p.feed(body(path))
    p.close()
    # reorder each table column by column
    out, i, blocks = [], 0, p.blocks
    while i < len(blocks):
        b = blocks[i]
        if b.get("table"):
            tid = b["table"]
            j = i
            while j < len(blocks) and blocks[j].get("table") == tid:
                j += 1
            grp = blocks[i:j]
            for col in sorted({g["col"] for g in grp}):
                cb = [g for g in grp if g["col"] == col]
                # the column label is printed again after a page turn: keep the first only
                labels = [g for g in cb if g["kind"] == "center"]
                if labels:
                    first = render_line(labels[0]["lines"][0]) if labels[0]["lines"] else ""
                    cb = [g for g in cb if not (g["kind"] == "center" and g is not labels[0]
                                                and g["lines"] and render_line(g["lines"][0]) == first)]
                cb[0] = dict(cb[0], colstart=True)
                out += cb
            i = j
        else:
            out.append(b)
            i += 1
    return out, p.notes


def split_verses(text: str, st: dict):
    """Split text at verse numbers. st holds the chapter state: last number, numbers used.

    Returns [(n, letter, text, numbered)]. Charles prints some verses out of order (51: 1, 5a, 2;
    106: 14, 17, 15, 16), so an unused number with a period is accepted even when it goes back.
    """
    segs, pos, cur_n, cur_l, numbered = [], 0, st["last"], "", False
    carry = lead = ""
    for m in MARK.finditer(text):
        tok, letter, dot = m.group(1), m.group(2) or "", m.group(3)
        if letter and "*" not in letter:
            if not dot and not text[m.end():m.end() + 2].strip()[:1].isupper():
                continue
            letter = f"*{letter}*"
        k = 1 if tok == "l" else int(tok)
        if tok == "l" and not (st["last"] == 0 and m.start() == 0 and dot):
            continue
        nxt = text[m.end():m.end() + 3].lstrip()
        capital = nxt[:1].isupper() or nxt[:1] in "'‘\"⌈〈[(†"
        top = max(st["used"] | {st["last"]})
        if letter:
            ok = k <= top + 8
        elif st["last"] < k <= st["last"] + 8 and k not in st["used"]:
            ok = bool(dot) or capital
        else:
            ok = bool(dot) and capital and k not in st["used"] and k <= top + 30
        if not ok:
            continue
        before = text[pos:m.start()].strip()
        if before in ("[", "{", "(", "⌈", "〈"):
            carry, before = before.replace("{", "["), ""
        if before:
            segs.append((cur_n, cur_l, lead + before, numbered))
        cur_n, cur_l, pos, numbered = k, letter, m.end(), True
        lead = carry
        carry = ""
        if letter and k != st["last"] + 1 and k != st["last"]:
            pass  # a transposed half verse: do not move the counter
        else:
            st["last"] = k
            if not letter:
                st["used"].add(k)
    rest = text[pos:].strip()
    if rest:
        segs.append((cur_n, cur_l, lead + rest, numbered))
    return segs


def build():
    pages = sorted(BOE.glob("boe[0-9][0-9][0-9].htm"))
    sections: list[dict] = []
    # Charles' key to the brackets (boe003)
    blocks3, _ = page_blocks(BOE / "boe003.htm")
    key = []
    for b in blocks3:
        if b["kind"] in ("p", "center"):
            for ln in b["lines"]:
                t = render_line(ln)
                if t:
                    key.append({"t": "p", "text": plain(t) if b["kind"] == "center" else t})
    sections.append({"id": "abbreviations", "title": "Abbreviations, Brackets and Symbols", "level": 1, "blocks": key})

    chapter = None
    pending: list[dict] = []
    seen_ids: set[str] = set()
    unused_digits: list[str] = []
    for path in pages[4:]:
        blocks, notes = page_blocks(path)
        seen_chapter_on_page = False
        after_page = False
        table_st = None
        for b in blocks:
            kind = b["kind"]
            if kind == "page":
                after_page = True
                continue
            lines = [render_line(ln) for ln in b["lines"]]
            lines = [x for x in lines if x]
            if not lines:
                continue
            if kind == "h3" and CHAPTER.match(plain(lines[0])):
                n = roman(CHAPTER.match(plain(lines[0])).group(1))
                sid = str(n)
                title = f"Chapter {n}"
                if n == 91:
                    sid, title = ("91", "Chapter 91 (1-11, 18-19)") if "91" not in seen_ids else ("91-12", "Chapter 91 (12-17)")
                seen_ids.add(sid)
                start = 11 if sid == "91-12" else 0
                chapter = {"id": sid, "title": title, "level": 1, "blocks": pending, "n": n,
                           "st": {"last": start, "used": set(range(1, start + 1))}}
                pending = []
                sections.append(chapter)
                seen_chapter_on_page = True
                after_page = False
                continue
            if chapter is not None:
                st = chapter["st"]
                if b.get("colstart"):
                    if table_st is None:
                        table_st = {"last": st["last"], "used": set(st["used"])}
                    saved = st
                    chapter["st"] = {"last": table_st["last"], "used": set(table_st["used"])}
                    chapter["st"]["used_all"] = saved.get("used_all", set()) | saved["used"]
                elif not b.get("table") and table_st is not None:
                    table_st = None
                    st["used"] |= st.pop("used_all", set())
            if kind in ("h1", "h2", "h3", "center") or (b.get("table") and kind == "center"):
                text = " ".join(plain(x) for x in lines)
                text = re.sub(r"\s+([.,])", r"\1", text)
                if b.get("table"):
                    hb = {"t": "h", "level": 4, "text": text}
                elif kind == "h1":
                    hb = {"t": "h", "level": 2, "text": text}
                else:
                    hb = {"t": "h", "level": 3, "text": text}
                target = pending if not seen_chapter_on_page else chapter["blocks"]
                if (kind in ("h2", "center") and RANGE_ONLY.match(text) and target and target[-1]["t"] == "h"):
                    target[-1]["text"] += " " + text
                else:
                    target.append(hb)
                continue
            # body text
            if chapter is None:
                raise SystemExit(f"text before first chapter in {path.name}: {lines[0][:60]}")
            st = chapter["st"]
            vb = chapter["blocks"]
            if not b["poetry"]:
                text = " ".join(lines)
                segs = split_verses(text, st)
                join = (b.get("contnote") or text.lstrip("*")[:1].islower()) and vb and vb[-1]["t"] == "v" and not vb[-1].get("indent")
                for i, (n, letter, t, numbered) in enumerate(segs):
                    if i == 0 and join and not numbered:
                        vb[-1]["text"] += " " + t  # paragraph split by a page break: rejoin
                    else:
                        vb.append(vblock(n, letter, t, numbered, i == 0, False))
            else:
                first = True
                for ln in lines:
                    for n, letter, t, numbered in split_verses(ln, st):
                        vb.append(vblock(n, letter, t, numbered, first, True))
                        first = False
            after_page = False
        for nid, ntext in notes.items():
            t = re.sub(r"\s+", " ", ntext).strip().replace("--", "\u2014")
            chapter["blocks"].append({"t": "note", "id": nid, "text": t})
    for s in sections:
        for b in s["blocks"]:
            if b["t"] == "v" and b["n"] == 0:
                # one-verse chapters (3, 4, 44) print no verse number; cite them as verse 1
                b["n"] = 1
                b.pop("cont", None)
        s.pop("n", None)
        s.pop("st", None)
    # renumber the one footnote to 1 and drop the transcriber's label
    for s in sections:
        for b in s["blocks"]:
            b["text"] = b["text"].replace("[^22]", "[^1]")
            if b["t"] == "note" and b["id"] == "22":
                b["id"] = "1"
    return sections


def vblock(n, letter, text, numbered, p, poetry):
    if letter:
        text = f"{letter}. {text}"
    b = {"t": "v", "n": n, "text": text}
    if not numbered:
        b["cont"] = True
    if p:
        b["p"] = True
    if poetry:
        b["indent"] = 1
    return b


def gaps(sections):
    """Missing verse numbers; yields (section index, nearest lower verse present, missing k)."""
    for si, s in enumerate(sections):
        have = sorted({b["n"] for b in s["blocks"] if b["t"] == "v" and not b.get("cont")})
        if not have:
            continue
        for k in range(1, have[-1]):
            if k not in have:
                lower = [h for h in have if h < k]
                if lower:
                    yield si, lower[-1], k


def repair(sections, ocr_raw: str, log: list[str]):
    toks = ocr_tokens(ocr_raw)
    theirs = [t[0] for t in toks]
    for _round in range(3):
        todo = list(gaps(sections))
        if not todo:
            return
        ours, owner = [], []
        for si, s in enumerate(sections):
            for bi, b in enumerate(s["blocks"]):
                if b["t"] != "v":
                    continue
                for w, pos in words_with_pos(b["text"]):
                    ours.append(w)
                    owner.append((si, bi, pos))
        m = align(ours, theirs)
        splits: dict[tuple[int, int], list[tuple[int, int]]] = {}
        for si, after, k in todo:
            idx = [i for i, (s_, bi, _) in enumerate(owner)
                   if s_ == si and sections[si]["blocks"][bi]["n"] == after]
            got = [m[i] for i in idx if m[i] >= 0]
            if not got:
                continue
            lo, hi = min(got), max(got)
            for j in range(lo, hi + 1):
                if as_number(toks[j][1]) == k:
                    # first of our words aligned after the printed number
                    cand = [i for i in idx if m[i] > j]
                    if not cand:
                        break
                    i = min(cand, key=lambda x: m[x])
                    _, bi, pos = owner[i]
                    splits.setdefault((si, bi), []).append((pos, k))
                    break
        if not splits:
            return
        for (si, bi), lst in sorted(splits.items(), reverse=True):
            blocks = sections[si]["blocks"]
            b = blocks[bi]
            new = []
            text = b["text"]
            for pos, k in sorted(lst, reverse=True):
                head, tail = text[:pos].rstrip(), text[pos:].strip()
                if head.count("**") % 2:
                    head, tail = head + "**", "**" + tail
                nb = {"t": "v", "n": k, "text": tail}
                if b.get("indent"):
                    nb["indent"] = b["indent"]
                new.insert(0, nb)
                text = head
                log.append(f"restored verse {sections[si]['id']}:{k} before: {tail[:50]}")
            if text:
                b["text"] = text
                blocks[bi + 1:bi + 1] = new
            else:
                first = new[0]
                for key in ("p",):
                    if b.get(key):
                        first[key] = b[key]
                blocks[bi:bi + 1] = new


def apply_corrections(sections, log):
    for sid, old, new in CORRECTIONS:
        hit = 0
        for s in sections:
            if sid not in ("*", s["id"]):
                continue
            for b in s["blocks"]:
                if old in b["text"]:
                    b["text"] = b["text"].replace(old, new)
                    hit += 1
        log.append(f"correction {sid}: {old!r} -> {new!r} ({hit} blocks)")
        if not hit:
            raise SystemExit(f"correction not applied: {sid} {old!r}")


def pages_sha256() -> str:
    """sha256 over the cached transcription pages used (boe003 to boe112), in file order."""
    h = hashlib.sha256()
    for path in sorted(BOE.glob("boe[0-9][0-9][0-9].htm"))[3:]:
        h.update(path.read_bytes())
    return h.hexdigest()


def main(argv):
    sections = build()
    log: list[str] = []
    repair(sections, OCR.read_text(encoding="utf-8", errors="replace"), log)
    apply_corrections(sections, log)
    for sec in sections:  # an unnumbered line belongs to the verse printed before it
        cur = None
        for b in sec["blocks"]:
            if b["t"] != "v":
                continue
            if b.get("cont") and cur is not None:
                b["n"] = cur
            cur = b["n"]
    # 91:12-17 are printed later, as section 91-12, so those are not gaps
    left = [(sections[si]["id"], a, k) for si, a, k in gaps(sections)
            if not (sections[si]["id"] == "91" and 12 <= k <= 17)]
    m = meta("boe-arch/index.htm")
    work = {
        "id": "1-enoch",
        "title": "The Book of Enoch",
        "short_title": "1 Enoch",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 1,
        "date": "3rd to 1st century BC (Charles dates its parts from before 170 BC to about 64 BC)",
        "language": "Ge'ez (Ethiopic), from Aramaic and Hebrew originals; Greek fragments",
        "translator": "R. H. Charles",
        "edition": "The Book of Enoch, translated by R. H. Charles, with an introduction by W. O. E. Oesterley (London: SPCK, 1917), Translations of Early Documents, Series I",
        "source_url": "https://archive.sacred-texts.com/bib/boe/index.htm",
        "source_sha256": pages_sha256(),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": "Published in London by the Society for Promoting Christian Knowledge in 1917; in the public domain in the United States because it was published before 1931. Text checked against the archive.org scan of the 1917 printing (bookofenoch0000unse).",
        "summary": "An ancient Jewish apocalypse, written in parts between the third and first centuries BC, that tells of Enoch's visions of the fallen Watchers, the judgment and the Messiah. It is quoted in Jude 14 and 15, was read by many early Christians, and is canonical in the Ethiopian Orthodox Tewahedo Church, but it is outside the Protestant and Catholic canons. It is not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    print(f"sections {len(sections)}, restored {sum(1 for x in log if x.startswith('restored'))}, gaps left {len(left)}")
    for g in left:
        print("gap", g)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
