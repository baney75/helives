"""Ingest the Berean Standard Bible (USFM) into library/bible/bsb/NN-<slug>.toml.

Usage: python3 -I pipeline/bsb/ingest.py
Downloads bsb_usfm.zip once into pipeline/cache/bsb/ (cached; the retrieval date is kept in
retrieved.json beside it), parses every book, and writes one TOML per book with libtoml.write_work.
The zip is read in memory with zipfile; nothing from it is executed or extracted.

Mapping (see library/SCHEMA.md):
  \\c            -> one [[section]] per chapter, id "<n>", level 1
  \\v            -> one v block per verse (n, text); p = true when the verse opens a paragraph or
                   stanza (\\p \\pmo \\pc \\li* \\d, or the first line after \\b, a heading or a chapter
                   start); indent = 1..3 when the verse opens a \\q1..\\q3 or \\li1..\\li2 line
  \\s1 \\s2 \\ms  -> h blocks, levels 2, 3, 2
  \\d (no verse) and \\qa -> h level 4 ("Psalms 1-41", acrostic letters in Psalm 119)
  \\d with verse -> the superscription stays inside the verse text (bsb.txt counts it as part of
                   verse 1) and is wrapped in *italics* so it reads as a title
  \\r            -> ref block
  \\f ... \\f*    -> note block (ids a, b, ... z, aa, ab ...) with [^id] in the text where it stood;
                   \\fqa runs are italic, \\fr is dropped, \\ref keeps its display text
  \\wj           -> dropped (the schema has no red-letter markup)
"""
from __future__ import annotations

import datetime
import difflib
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from libtoml import LIBRARY, ROOT, sha256_file, slugify, write_work  # noqa: E402

CACHE = ROOT / "pipeline" / "cache" / "bsb"
OUT = LIBRARY / "bible" / "bsb"
ZIP_URL = "https://bereanbible.com/bsb_usfm.zip"
TXT_URL = "https://bereanbible.com/bsb.txt"

# (USFM code, common English name, SBL abbreviation)
BOOKS = [
    ("GEN", "Genesis", "Gen"), ("EXO", "Exodus", "Exod"), ("LEV", "Leviticus", "Lev"),
    ("NUM", "Numbers", "Num"), ("DEU", "Deuteronomy", "Deut"), ("JOS", "Joshua", "Josh"),
    ("JDG", "Judges", "Judg"), ("RUT", "Ruth", "Ruth"), ("1SA", "1 Samuel", "1 Sam"),
    ("2SA", "2 Samuel", "2 Sam"), ("1KI", "1 Kings", "1 Kgs"), ("2KI", "2 Kings", "2 Kgs"),
    ("1CH", "1 Chronicles", "1 Chr"), ("2CH", "2 Chronicles", "2 Chr"), ("EZR", "Ezra", "Ezra"),
    ("NEH", "Nehemiah", "Neh"), ("EST", "Esther", "Esth"), ("JOB", "Job", "Job"),
    ("PSA", "Psalms", "Ps"), ("PRO", "Proverbs", "Prov"), ("ECC", "Ecclesiastes", "Eccl"),
    ("SNG", "Song of Solomon", "Song"), ("ISA", "Isaiah", "Isa"), ("JER", "Jeremiah", "Jer"),
    ("LAM", "Lamentations", "Lam"), ("EZK", "Ezekiel", "Ezek"), ("DAN", "Daniel", "Dan"),
    ("HOS", "Hosea", "Hos"), ("JOL", "Joel", "Joel"), ("AMO", "Amos", "Amos"),
    ("OBA", "Obadiah", "Obad"), ("JON", "Jonah", "Jonah"), ("MIC", "Micah", "Mic"),
    ("NAM", "Nahum", "Nah"), ("HAB", "Habakkuk", "Hab"), ("ZEP", "Zephaniah", "Zeph"),
    ("HAG", "Haggai", "Hag"), ("ZEC", "Zechariah", "Zech"), ("MAL", "Malachi", "Mal"),
    ("MAT", "Matthew", "Matt"), ("MRK", "Mark", "Mark"), ("LUK", "Luke", "Luke"),
    ("JHN", "John", "John"), ("ACT", "Acts", "Acts"), ("ROM", "Romans", "Rom"),
    ("1CO", "1 Corinthians", "1 Cor"), ("2CO", "2 Corinthians", "2 Cor"), ("GAL", "Galatians", "Gal"),
    ("EPH", "Ephesians", "Eph"), ("PHP", "Philippians", "Phil"), ("COL", "Colossians", "Col"),
    ("1TH", "1 Thessalonians", "1 Thess"), ("2TH", "2 Thessalonians", "2 Thess"),
    ("1TI", "1 Timothy", "1 Tim"), ("2TI", "2 Timothy", "2 Tim"), ("TIT", "Titus", "Titus"),
    ("PHM", "Philemon", "Phlm"), ("HEB", "Hebrews", "Heb"), ("JAS", "James", "Jas"),
    ("1PE", "1 Peter", "1 Pet"), ("2PE", "2 Peter", "2 Pet"), ("1JN", "1 John", "1 John"),
    ("2JN", "2 John", "2 John"), ("3JN", "3 John", "3 John"), ("JUD", "Jude", "Jude"),
    ("REV", "Revelation", "Rev"),
]
assert len(BOOKS) == 66

HEADER_MARKERS = {"id", "usfm", "h", "toc1", "toc2", "toc3", "mt1", "mt2"}
PARA_MARKERS = {"p", "m", "pmo", "pc", "li1", "li2", "d", "mr"}
INDENT = {"q1": 1, "q2": 2, "q3": 3, "li1": 1, "li2": 2}
TEXT_MARKERS = PARA_MARKERS | {"q1", "q2", "q3", "qr"}
HEADINGS = {"s1": 2, "s2": 3, "ms": 2}

LINE = re.compile(r"^\\([a-z]+[0-9]?)(?:\s(.*))?$")
INLINE = re.compile(r"\\f \+ (.*?)\\f\*|\\v (\d+)\s?|\\wj\*?|\\ref ([^|\\]*)(?:\|[^\\]*)?\\ref\*")
REF = re.compile(r"\\ref ([^|\\]*)(?:\|[^\\]*)?\\ref\*")
FV = re.compile(r"\\fv (\S+?)\s*\\fv\*\s*")
FR = re.compile(r"\\fr [^\\]*")
FOOT_SPLIT = re.compile(r"\\(ft|fqa) ")
LEFTOVER = re.compile(r"\\|\|")
STRAY_QUOTES = re.compile(r"\[[’‘”“]+\]")


def download(url: str, dest: Path) -> Path:
    """Fetch url into dest once; record the retrieval date in retrieved.json."""
    CACHE.mkdir(parents=True, exist_ok=True)
    stamp_file = CACHE / "retrieved.json"
    stamps = json.loads(stamp_file.read_text()) if stamp_file.exists() else {}
    if not dest.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "helives-library-ingest"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(dest)
        stamps[dest.name] = datetime.date.today().isoformat()
    stamps.setdefault(dest.name, datetime.date.fromtimestamp(dest.stat().st_mtime).isoformat())
    stamp_file.write_text(json.dumps(stamps, indent=2, sort_keys=True) + "\n")
    return dest


def note_text(raw: str) -> str:
    """Turn the body of \\f + ... \\f* into plain text with *italic* alternate readings."""
    raw = REF.sub(lambda m: m.group(1), raw)
    raw = FV.sub(lambda m: f"({m.group(1)}) ", raw)
    raw = FR.sub("", raw)
    parts = FOOT_SPLIT.split(raw)
    out = [parts[0]]
    for i in range(1, len(parts), 2):
        kind, seg = parts[i], parts[i + 1]
        if kind == "fqa" and seg.strip():
            lead = seg[: len(seg) - len(seg.lstrip())]
            trail = seg[len(seg.rstrip()):]
            seg = f"{lead}*{seg.strip()}*{trail}"
        out.append(seg)
    text = tidy("".join(out))
    if LEFTOVER.search(text):
        raise ValueError(f"unparsed footnote markup: {raw!r}")
    return text


def tidy(text: str) -> str:
    """Clean the USFM generator's typography in footnote text (bsb.txt style)."""
    text = STRAY_QUOTES.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*—\s*", "—", text)                    # "earth — every" -> "earth—every"
    text = re.sub(r"\s+([,;:?!)’”]|\.(?!\s?\.))", r"\1", text)  # "GOD ," -> "GOD,"; keeps ". . ."
    text = re.sub(r"([(“‘])\s+", r"\1", text)                # "( which" -> "(which"
    return text


SPLIT = "\x00"  # internal marker: a heading fell here inside the verse
ANCHOR = re.compile(r"\[\^[a-z]+\]|\*|\x00")


def alnum_positions(s: str) -> list[int]:
    return [i for i, ch in enumerate(s) if ch.isalnum()]


def realign(usfm_text: str, txt: str, where: str, fallbacks: list[str]) -> str:
    """Put the USFM verse's footnote markers and title italics into the bsb.txt wording.

    Each anchor ([^x] or *) is tied to the letter or digit it followed in the USFM text (its index
    among all letters and digits, which ignores spacing and punctuation differences) plus the
    punctuation between that letter and the anchor. It is placed after the same letter in bsb.txt,
    then after the same punctuation if bsb.txt has it there. When the letters around it differ, or
    the punctuation does not match, a footnote marker goes to the end of the verse and is listed.
    """
    txt = " ".join(txt.split())
    plain_parts: list[str] = []
    anchors: list[tuple[int, str, str]] = []  # (letters before, trailing punctuation, anchor)
    pos = 0
    letters = 0
    for m in ANCHOR.finditer(usfm_text):
        chunk = usfm_text[pos:m.start()]
        plain_parts.append(chunk)
        letters += sum(ch.isalnum() for ch in chunk)
        so_far = "".join(plain_parts)
        tail = re.search(r"[^0-9A-Za-z\w]*$", so_far).group(0)
        anchors.append((letters, "".join(tail.split()), m.group(0)))
        pos = m.end()
    plain_parts.append(usfm_text[pos:])
    if not anchors:
        return txt
    U = "".join(ch for ch in "".join(plain_parts) if ch.isalnum())
    tpos = alnum_positions(txt)
    T = "".join(txt[i] for i in tpos)
    if U == T:
        def map_index(k: int) -> int | None:
            return k
    else:
        blocks = difflib.SequenceMatcher(None, U, T, autojunk=False).get_matching_blocks()

        def map_index(k: int) -> int | None:
            for a, b, size in blocks:
                if a <= k < a + size:
                    return b + (k - a)
            return None

    placed: list[tuple[int, int, str]] = []
    for order, (k, punct, anchor) in enumerate(anchors):
        p: int | None
        if k == 0:
            p = 0
        else:
            j = map_index(k - 1)
            p = None if j is None else tpos[j] + 1
        if p is not None and punct:
            # the USFM sometimes wraps words in [ ] that bsb.txt prints bare ("[of silver]")
            for cand in (punct, punct.replace("[", "").replace("]", "")):
                if txt[p:p + len(cand)] == cand:
                    p += len(cand)
                    break
            else:
                p = None
        if p is None:
            if anchor in ("*", SPLIT):
                raise ValueError(f"{where}: cannot place title italics in bsb.txt wording")
            fallbacks.append(f"{where} {anchor}")
            p = len(txt)
        placed.append((p, order, anchor))
    out, last = [], 0
    for p, _o, anchor in sorted(placed):
        out.append(txt[last:p])
        out.append(anchor)
        last = p
    out.append(txt[last:])
    result = "".join(out)
    assert " ".join(re.sub(r"\[\^[a-z]+\]", "", result).replace("*", "").replace(SPLIT, " ").split()) == txt, where
    return result


def note_id(i: int) -> str:
    letters = "abcdefghijklmnopqrstuvwxyz"
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = letters[r] + s
    return s


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


class Chapter:
    def __init__(self, book: str, n: int):
        self.book, self.n = book, n
        self.blocks: list[dict] = []
        self.notes: list[dict] = []
        self.verse: dict | None = None  # current v block; its text is a list of pieces until finish()
        self.pending_break = True
        self.headings_mid_verse = 0
        self.mid_verse_refs: list[str] = []

    def heading(self, block: dict):
        if self.verse is not None:
            self.verse["_open"] = False  # later text for this verse would follow the heading
        self.blocks.append(block)
        self.pending_break = True

    def add_note(self, raw: str) -> str:
        nid = note_id(len(self.notes))
        self.notes.append({"t": "note", "id": nid, "text": note_text(raw)})
        return f"[^{nid}]"

    def line(self, marker: str, rest: str):
        if marker in PARA_MARKERS or marker == "b":
            self.pending_break = True
        if marker == "b":
            return
        indent = INDENT.get(marker)
        italic = marker == "d"
        buf: list[str] = []  # text of the current verse on this line
        at_line_start = True

        def flush():
            if not buf:
                return
            piece = clean("".join(buf))
            buf.clear()
            if not piece:
                return
            if self.verse is None:
                raise ValueError(f"{self.book} {self.n}: text before first verse: {piece!r}")
            if italic:
                m = re.match(r"^(.*?)((?:\[\^[a-z]+\])*)$", piece)
                piece = f"*{m.group(1).strip()}*{m.group(2)}"
            if not self.verse["_open"]:
                # a heading fell inside this verse: continue it in a cont block after the heading,
                # which always starts a new line (p = true, the line's indent)
                self.headings_mid_verse += 1
                self.mid_verse_refs.append(f"{self.book} {self.n}:{self.verse['n']}")
                head = self.verse.get("_head", self.verse)
                cont = {"t": "v", "n": head["n"], "cont": True, "p": True, "_parts": [], "_open": True, "_head": head}
                if indent:
                    cont["indent"] = indent
                head.setdefault("_conts", []).append(cont)
                self.blocks.append(cont)
                self.verse = cont
            self.verse["_parts"].append(piece)

        pos = 0
        for m in INLINE.finditer(rest):
            buf.append(rest[pos:m.start()])
            pos = m.end()
            if m.group(1) is not None:
                buf.append(self.add_note(m.group(1)))
            elif m.group(2) is not None:
                starts_line = at_line_start and not clean("".join(buf))
                flush()
                v = {"t": "v", "n": int(m.group(2)), "_parts": [], "_open": True}
                if starts_line and self.pending_break:
                    v["p"] = True
                if starts_line and indent:
                    v["indent"] = indent
                self.verse = v
                self.blocks.append(v)
                self.pending_break = False
            elif m.group(3) is not None:
                buf.append(m.group(3))
            # \wj and \wj* are dropped
            if m.group(2) is not None or m.group(1) is not None or clean("".join(buf)):
                at_line_start = False
        buf.append(rest[pos:])
        if clean("".join(buf)):
            self.pending_break = False
        flush()

    def finish(self, txt: dict[tuple[int, int], str], fallbacks: list[str]) -> dict:
        for b in self.blocks:
            if b["t"] != "v" or b.get("cont"):
                continue
            pieces = [b] + b.get("_conts", [])
            where = f"{self.book} {self.n}:{b['n']}"
            texts = []
            for piece in pieces:
                text = clean(" ".join(piece["_parts"]))
                text = re.sub(r"\s+(\[\^[a-z]+\])", r"\1", text)
                if not text:
                    raise ValueError(f"{where}: empty verse part")
                if LEFTOVER.search(text) or SPLIT in text:
                    raise ValueError(f"{where}: leftover markup {text!r}")
                texts.append(text)
            source = txt.get((self.n, b["n"]))
            if not source or not source.strip():
                raise ValueError(f"{where}: verse missing or empty in bsb.txt")
            # one realignment for the whole verse; SPLIT marks where each heading fell
            parts = realign(f" {SPLIT} ".join(texts), source, where, fallbacks).split(SPLIT)
            if len(parts) != len(pieces) or not all(x.strip() for x in parts):
                raise ValueError(f"{where}: cannot split the verse at its heading")
            for piece, text in zip(pieces, parts):
                piece["text"] = text.strip()
        blocks = []
        for b in self.blocks:
            if b["t"] == "v":
                for k in ("_parts", "_open", "_head", "_conts"):
                    b.pop(k, None)
            blocks.append(b)
        title = f"Psalm {self.n}" if self.book == "Psalms" else f"{self.book} {self.n}"
        return {"id": str(self.n), "title": title, "level": 1, "blocks": blocks + self.notes}


def parse_book(code: str, name: str, usfm: str, txt: dict[tuple[int, int], str]) -> tuple[list[dict], dict]:
    chapters: list[Chapter] = []
    ch: Chapter | None = None
    qa: list[str] = []
    stats = {"headings_mid_verse": 0}

    def flush_qa():
        if qa:
            ch.heading({"t": "h", "level": 4, "text": clean(" ".join(qa))})
            qa.clear()

    for lineno, raw in enumerate(usfm.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        m = LINE.match(line)
        if not m:
            raise ValueError(f"{code}:{lineno}: line does not start with a marker: {line[:60]!r}")
        marker, rest = m.group(1), (m.group(2) or "").strip()
        if marker in HEADER_MARKERS:
            continue
        if marker != "qa":
            if ch is not None:
                flush_qa()
        if marker == "c":
            n = int(rest)
            if n != len(chapters) + 1:
                raise ValueError(f"{code}: chapter {n} out of order")
            ch = Chapter(name, n)
            chapters.append(ch)
            continue
        if ch is None:
            raise ValueError(f"{code}:{lineno}: content before first chapter: {line[:60]!r}")
        if marker in HEADINGS:
            ch.heading({"t": "h", "level": HEADINGS[marker], "text": clean(rest)})
        elif marker == "qa":
            qa.append(rest)
        elif marker == "r":
            ch.heading({"t": "ref", "text": clean(REF.sub(lambda r: r.group(1), rest))})
        elif marker == "d" and "\\v " not in rest:
            ch.heading({"t": "h", "level": 4, "text": clean(rest)})
        elif marker in TEXT_MARKERS or marker == "b":
            ch.line(marker, rest)
        else:
            raise ValueError(f"{code}:{lineno}: unhandled marker \\{marker}")
    if ch is not None:
        flush_qa()
    fallbacks: list[str] = []
    sections = [c.finish(txt, fallbacks) for c in chapters]
    stats["fallbacks"] = fallbacks
    used = {(int(s["id"]), b["n"]) for s in sections for b in s["blocks"] if b["t"] == "v"}
    extra = sorted(k for k, v in txt.items() if v.strip() and k not in used)
    if extra:
        raise ValueError(f"{code}: verses in bsb.txt but not in USFM: {extra}")
    stats["headings_mid_verse"] = [r for c in chapters for r in c.mid_verse_refs]
    for s in sections:
        for b in s["blocks"]:
            if b["t"] != "note" and LEFTOVER.search(b["text"]):
                raise ValueError(f"{code} {s['id']}: leftover markup {b['text']!r}")
    return sections, stats


def load_bsb_txt(path: Path) -> list[dict[tuple[int, int], str]]:
    """bsb.txt as one {(chapter, verse): text} dict per book, in book order."""
    books: list[dict[tuple[int, int], str]] = []
    names: list[str] = []
    for line in path.read_text(encoding="utf-8-sig").splitlines()[3:]:
        ref, _, text = line.partition("\t")
        m = re.match(r"^(.+) (\d+):(\d+)$", ref.strip())
        if not m:
            raise ValueError(f"bsb.txt: cannot parse {line[:60]!r}")
        if not names or names[-1] != m.group(1):
            names.append(m.group(1))
            books.append({})
        books[-1][(int(m.group(2)), int(m.group(3)))] = text.strip()
    if len(books) != 66:
        raise ValueError(f"bsb.txt has {len(books)} books")
    return books


def main() -> int:
    zpath = download(ZIP_URL, CACHE / "bsb_usfm.zip")
    txt_books = load_bsb_txt(download(TXT_URL, CACHE / "bsb.txt"))
    stamps = json.loads((CACHE / "retrieved.json").read_text())
    zsha = sha256_file(zpath)
    total_ch = total_v = 0
    mid: list[str] = []
    fallbacks: list[str] = []
    with zipfile.ZipFile(zpath) as z:
        members = {Path(n).name: n for n in z.namelist() if n.endswith(".usfm")}
        for num, (code, name, abbr) in enumerate(BOOKS, 1):
            member = members.get(f"{code}.usfm")
            if member is None:
                raise SystemExit(f"{code}.usfm missing from {zpath.name}")
            usfm = z.read(member).decode("utf-8-sig")
            sections, stats = parse_book(code, name, usfm, txt_books[num - 1])
            fallbacks += stats["fallbacks"]
            mid += stats["headings_mid_verse"]
            nverses = sum(1 for s in sections for b in s["blocks"] if b["t"] == "v" and not b.get("cont"))
            slug = slugify(name)
            work = {
                "id": f"bsb-{slug}",
                "title": name,
                "short_title": abbr,
                "author": "bible",
                "collection": "bible",
                "order": num,
                "language": "Hebrew, Aramaic" if num <= 39 else "Greek",
                "translator": "Berean Standard Bible",
                "edition": "Berean Standard Bible (2023 public domain edition)",
                "source_url": ZIP_URL,
                "source_sha256": zsha,
                "retrieved": stamps["bsb_usfm.zip"],
                "license": "Public domain",
                "license_basis": "Dedicated to the public domain by the Berean Bible Translation Committee (2023)",
                "testament": "OT" if num <= 39 else "NT",
                "book_number": num,
                "chapters": len(sections),
                "verses": nverses,
            }
            write_work(OUT / f"{num:02d}-{slug}.toml", work, sections)
            total_ch += len(sections)
            total_v += nverses
    print(f"ingest: 66 books, {total_ch} chapters, {total_v} verses -> {OUT.relative_to(ROOT)}")
    print(f"ingest: {len(fallbacks)} footnote markers moved to verse end (no confident anchor): {', '.join(fallbacks) or 'none'}")
    print(f"ingest: {len(mid)} verse continuations after a heading inside the verse (cont blocks): {', '.join(mid)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
