#!/usr/bin/env python3
"""Turn library work TOML files into speech chunks for the audiobook renderer.

Standard library only; runs on the Mac or on Parish1. Each section becomes a list of
chunks: whole sentences, at most MAX_CHARS characters, never crossing a paragraph.
Every chunk carries `text` (sent to the TTS model, after lexicon respellings),
`ref_text` (what a listener should hear; the WER reference), anchors (verse or block
ids with the word index where they start inside the chunk), a pause before it, and flags.

    python3 audio/prep.py library/bible/bsb/19-psalms.toml --section 23
    python3 audio/prep.py --queue library          # print the render queue
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tomllib
import unicodedata
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAX_CHARS = 380          # model quality drops on long inputs; Whisper also wants < 30 s
PREP_VERSION = 1         # bump when normalization changes; changed chunks re-render

PAUSE_LEAD_MS = 300      # silence at the start of a file
PAUSE_TITLE_MS = 1000    # after the chapter or section title
PAUSE_PARA_MS = 600
PAUSE_SENT_MS = 250

# ---------------------------------------------------------------- numbers

_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
         "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
         "eighteen", "nineteen"]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
_SCALES = [(10**9, "billion"), (10**6, "million"), (1000, "thousand")]


def cardinal(n: int) -> str:
    if n < 0:
        return "minus " + cardinal(-n)
    if n < 20:
        return _ONES[n]
    if n < 100:
        t, o = divmod(n, 10)
        return _TENS[t] + ("-" + _ONES[o] if o else "")
    if n < 1000:
        h, r = divmod(n, 100)
        return _ONES[h] + " hundred" + (" " + cardinal(r) if r else "")
    for value, name in _SCALES:
        if n >= value:
            q, r = divmod(n, value)
            return cardinal(q) + " " + name + (" " + cardinal(r) if r else "")
    raise ValueError(n)


_ORD_IRREG = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth",
              "nine": "ninth", "twelve": "twelfth"}


def ordinal(n: int) -> str:
    words = cardinal(n)
    m = re.match(r"(.*?)([a-z]+)$", words)
    head, last = m.group(1), m.group(2)
    if last in _ORD_IRREG:
        last = _ORD_IRREG[last]
    elif last.endswith("y"):
        last = last[:-1] + "ieth"
    else:
        last += "th"
    return head + last


def year_words(n: int) -> str:
    """1066 -> ten sixty-six, 1900 -> nineteen hundred, 1805 -> eighteen oh five, 397 -> three ninety-seven."""
    if not 100 <= n <= 2099 or 2000 <= n <= 2009:
        return cardinal(n)
    hi, lo = divmod(n, 100)
    if lo == 0:
        return cardinal(hi) + " hundred"
    return cardinal(hi) + " " + (("oh " + _ONES[lo]) if lo < 10 else cardinal(lo))


_ROMAN_RE = re.compile(r"^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$", re.I)
_ROMAN_VAL = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}


def roman_to_int(s: str) -> int | None:
    if not s or not _ROMAN_RE.match(s):
        return None
    total, prev = 0, 0
    for ch in reversed(s.lower()):
        v = _ROMAN_VAL[ch]
        total = total - v if v < prev else total + v
        prev = max(prev, v)
    return total


# ---------------------------------------------------------------- Bible names

BIBLE_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
    "First Samuel", "Second Samuel", "First Kings", "Second Kings", "First Chronicles",
    "Second Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "First Corinthians",
    "Second Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
    "First Thessalonians", "Second Thessalonians", "First Timothy", "Second Timothy", "Titus",
    "Philemon", "Hebrews", "James", "First Peter", "Second Peter", "First John", "Second John",
    "Third John", "Jude", "Revelation",
]

# Abbreviation (lowercase, no period) -> spoken name; a numeral prefix is handled separately.
BOOK_ABBR = {
    "gen": "Genesis", "ge": "Genesis", "gn": "Genesis", "ex": "Exodus", "exod": "Exodus",
    "lev": "Leviticus", "lv": "Leviticus", "num": "Numbers", "nm": "Numbers",
    "deut": "Deuteronomy", "dt": "Deuteronomy", "josh": "Joshua", "judg": "Judges",
    "jdg": "Judges", "ruth": "Ruth", "sam": "Samuel", "kings": "Kings", "kgs": "Kings",
    "ki": "Kings", "chron": "Chronicles", "chr": "Chronicles", "ezra": "Ezra", "neh": "Nehemiah",
    "esth": "Esther", "est": "Esther", "job": "Job", "ps": "Psalm", "psa": "Psalm", "psalm": "Psalm",
    "pss": "Psalms", "prov": "Proverbs", "pr": "Proverbs", "eccl": "Ecclesiastes",
    "eccles": "Ecclesiastes", "ecc": "Ecclesiastes", "song": "Song of Solomon",
    "cant": "Song of Songs", "isa": "Isaiah", "is": "Isaiah", "jer": "Jeremiah",
    "lam": "Lamentations", "ezek": "Ezekiel", "eze": "Ezekiel", "dan": "Daniel", "hos": "Hosea",
    "joel": "Joel", "amos": "Amos", "obad": "Obadiah", "jon": "Jonah", "jonah": "Jonah",
    "mic": "Micah", "nah": "Nahum", "hab": "Habakkuk", "zeph": "Zephaniah", "hag": "Haggai",
    "zech": "Zechariah", "mal": "Malachi", "matt": "Matthew", "mat": "Matthew", "mt": "Matthew",
    "mark": "Mark", "mk": "Mark", "mar": "Mark", "luke": "Luke", "lk": "Luke", "luk": "Luke",
    "john": "John", "jn": "John", "joh": "John", "acts": "Acts", "rom": "Romans",
    "cor": "Corinthians", "gal": "Galatians", "eph": "Ephesians", "phil": "Philippians",
    "col": "Colossians", "thess": "Thessalonians", "thes": "Thessalonians", "tim": "Timothy",
    "tit": "Titus", "philem": "Philemon", "phlm": "Philemon", "heb": "Hebrews", "jas": "James",
    "james": "James", "pet": "Peter", "jude": "Jude", "rev": "Revelation", "apoc": "Apocalypse",
    "wisd": "Wisdom", "wis": "Wisdom", "ecclus": "Ecclesiasticus", "sir": "Sirach",
    "tob": "Tobit", "macc": "Maccabees", "bar": "Baruch", "judith": "Judith",
}
_NUM_PREFIX = {"1": "First", "2": "Second", "3": "Third", "i": "First", "ii": "Second",
               "iii": "Third"}

# ---------------------------------------------------------------- lexicon


@dataclass
class Lexicon:
    respell: dict[str, str] = field(default_factory=dict)    # Name -> respelling for the TTS
    variants: dict[str, str] = field(default_factory=dict)   # asr spelling (lower) -> canonical (lower)

    @classmethod
    def load(cls, path: Path | None = None) -> "Lexicon":
        path = path or HERE / "lexicon.toml"
        lex = cls()
        if not path.exists():
            return lex
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        for entry in data.get("name", []):
            word = entry["word"]
            if entry.get("respell"):
                lex.respell[word] = entry["respell"]
            for v in entry.get("variants", []):
                lex.variants[v.lower()] = word.lower()
        for a, b in data.get("spelling", {}).items():
            lex.variants[a.lower()] = b.lower()
        return lex

    def apply(self, text: str) -> str:
        for word, sp in self.respell.items():
            text = re.sub(r"\b" + re.escape(word) + r"\b", sp, text)
        return text


# ---------------------------------------------------------------- normalization

_GREEK_RE = re.compile(r"[Ͱ-Ͽἀ-῿]+(?:[\s̀-ͯ]*[Ͱ-Ͽἀ-῿]+)*")
_HEBREW_RE = re.compile(r"[֐-׿יִ-ﭏ]+(?:\s+[֐-׿יִ-ﭏ]+)*")
_GREEK_MAP = {
    "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "ζ": "z", "η": "e", "θ": "th", "ι": "i",
    "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x", "ο": "o", "π": "p", "ρ": "r", "σ": "s",
    "ς": "s", "τ": "t", "υ": "u", "φ": "ph", "χ": "ch", "ψ": "ps", "ω": "o",
}


def transliterate_greek(word: str) -> str:
    out = []
    decomposed = unicodedata.normalize("NFD", word)
    rough = "̔" in decomposed
    for ch in decomposed:
        if unicodedata.category(ch) == "Mn":
            continue
        low = ch.lower()
        if low in _GREEK_MAP:
            out.append(_GREEK_MAP[low])
        elif ch.isspace():
            out.append(" ")
    s = "".join(out)
    s = s.replace("gg", "ng").replace("gk", "nk").replace("ou", "ou")
    if rough and s and s[0] in "aeiouy":
        s = "h" + s
    if rough and s.startswith("r"):
        s = "rh" + s[1:]
    if word[:1].isupper():
        s = s[:1].upper() + s[1:]
    return s


ABBREVIATIONS = [
    (r"\bcf\.", "compare"), (r"\bCf\.", "Compare"), (r"\bviz\.", "namely"),
    (r"\bi\.\s?e\.", "that is"), (r"\bI\.\s?e\.", "That is"), (r"\be\.\s?g\.", "for example"),
    (r"\bE\.\s?g\.", "For example"), (r"\betc\.", "et cetera"), (r"\bsc\.", "namely"),
    (r"\bibid\.", "in the same place"), (r"\bIbid\.", "In the same place"),
    (r"\bvs\.", "versus"), (r"\bMr\.", "Mister"), (r"\bMrs\.", "Missus"), (r"\bDr\.", "Doctor"),
    (r"\bSt\.(?=\s+[A-Z])", "Saint"), (r"\bSS\.(?=\s+[A-Z])", "Saints"),
    (r"\bvol\.", "volume"), (r"\bVol\.", "Volume"), (r"\bch\.(?=\s*\d)", "chapter"),
    (r"\bchap\.(?=\s*\d)", "chapter"), (r"\bver\.(?=\s*\d)", "verse"),
    (r"\bvv\.(?=\s*\d)", "verses"), (r"\bp\.(?=\s*\d)", "page"), (r"\bpp\.(?=\s*\d)", "pages"),
    (r"\bA\.\s?D\.", "A D"), (r"\bB\.\s?C\.", "B C"), (r"\bq\.(?=\s*\d)", "question"),
    (r"\ba\.(?=\s*\d)", "article"), (r"\bobj\.(?=\s*\d)", "objection"), (r"&", " and "),
]

ROMAN_KEYWORDS = (r"Book|Chapter|Part|Question|Article|Psalm|Epistle|Letter|Sermon|Homily|"
                  r"Tractate|Section|Canon|Lecture|Oration|Discourse|Volume|Treatise|Hymn|"
                  r"Fragment|Session|Council|Distinction|Lesson")

_BRACKET_NOTE = re.compile(r"\[(?:[^\]]*\b(?:see|note|cf|sic|pg|page|p\.|ed\.|comp\.)\b[^\]]*|[\d\s,.:;\-–]*)\]", re.I)
_BRACKET_ANY = re.compile(r"\[([^\]^]*)\]")

_REF_BOOK = r"(?:(?P<pre>[123]|i{1,3})\.?\s*)?(?P<book>[A-Z][a-z]{1,6})\.?"
_REF_ARABIC = re.compile(_REF_BOOK + r"\s+(?P<ch>\d{1,3})\s*[:.,]\s*(?P<v1>\d{1,3})(?:\s*[-–]\s*(?P<v2>\d{1,3}))?(?!\d)")
_REF_ROMAN = re.compile(_REF_BOOK + r"\s+(?P<ch>[ivxlc]{1,8})\.\s*(?P<v1>\d{1,3})(?:\s*[-–]\s*(?P<v2>\d{1,3}))?(?!\d)")


def _ref_sub(m: re.Match, roman: bool) -> str:
    book = BOOK_ABBR.get(m.group("book").lower())
    if not book:
        return m.group(0)
    ch = roman_to_int(m.group("ch")) if roman else int(m.group("ch"))
    if not ch:
        return m.group(0)
    pre = m.group("pre")
    name = (_NUM_PREFIX[pre.lower()] + " " + book) if pre else book
    v1 = int(m.group("v1"))
    out = f"{name} {cardinal(ch)}, verse {cardinal(v1)}"
    if m.group("v2"):
        out = f"{name} {cardinal(ch)}, verses {cardinal(v1)} to {cardinal(int(m.group('v2')))}"
    return out


def _number_sub(m: re.Match, years: bool) -> str:
    raw = m.group(0)
    if re.fullmatch(r"\d+(st|nd|rd|th)", raw):
        return ordinal(int(re.sub(r"\D", "", raw)))
    if "," in raw:
        return cardinal(int(raw.replace(",", "")))
    if "." in raw:
        a, b = raw.split(".", 1)
        return cardinal(int(a)) + " point " + " ".join(_ONES[int(d)] for d in b)
    n = int(raw)
    if years and len(raw) == 4 and 1000 <= n <= 2099:
        return year_words(n)
    return cardinal(n)


def normalize(text: str, *, bible: bool = False, flags: set[str] | None = None) -> str:
    """Raw block text -> text a narrator reads aloud (before lexicon respellings)."""
    flags = flags if flags is not None else set()
    t = unicodedata.normalize("NFC", text)
    t = re.sub(r"\[\^[^\]]+\]", "", t)                       # footnote markers
    t = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", t)             # italic / bold
    t = t.replace("*", "")
    if _HEBREW_RE.search(t):
        flags.add("hebrew-skipped")
        t = _HEBREW_RE.sub("", t)
    if _GREEK_RE.search(t):
        flags.add("greek-transliterated")
        t = _GREEK_RE.sub(lambda m: " ".join(transliterate_greek(w) for w in m.group(0).split()), t)
    t = _BRACKET_NOTE.sub("", t)                                # editorial notes and page refs
    t = _BRACKET_ANY.sub(r"\1", t)                              # supplied words: keep, drop brackets
    t = re.sub(r"\(\s*\)", "", t)
    t = _REF_ARABIC.sub(lambda m: _ref_sub(m, False), t)
    t = _REF_ROMAN.sub(lambda m: _ref_sub(m, True), t)
    for pat, rep in ABBREVIATIONS:
        t = re.sub(pat, rep, t)
    t = re.sub(rf"\b({ROMAN_KEYWORDS})\.?\s+([IVXLCivxlc]+)\b\.?",
               lambda m: (m.group(1) + " " + cardinal(roman_to_int(m.group(2))).title())
               if roman_to_int(m.group(2)) else m.group(0), t)
    t = re.sub(r"(?<=\d)\s*[–-]\s*(?=\d)", " to ", t)
    t = re.sub(r"(?<=\bA D )\d{3,4}\b|\b\d{3,4}(?= B C\b)", lambda m: year_words(int(m.group(0))), t)
    t = re.sub(r"\d{1,3}(?:,\d{3})+|\d+\.\d+|\d+(?:st|nd|rd|th)\b|\d+",
               lambda m: _number_sub(m, years=not bible), t)
    t = re.sub(r"\bLORD\b", "Lord", t)
    t = re.sub(r"\bGOD\b", "God", t)
    t = re.sub(r"\s*(?:—|--|―)\s*", ", ", t)                   # em dash -> spoken pause
    t = re.sub(r"\s*–\s*", ", ", t)
    t = t.replace("…", "...")
    t = re.sub(r",\s*([,.;:!?])", r"\1", t)                     # ", ." -> "."
    t = re.sub(r"([.;:!?])\s*,", r"\1", t)
    t = re.sub(r"^\s*,\s*", "", t)
    t = re.sub(r"\s+([,.;:!?”’)])", r"\1", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


# ---------------------------------------------------------------- sentence splitting

_NO_SPLIT_BEFORE = {"mr", "mrs", "dr", "st", "ss", "no", "vol", "ch", "cf", "viz", "ibid", "ver", "v"}
_SENT_END = re.compile(r"[.!?][\"'”’)\]]*\s+(?=[\"'“‘(\[]?[A-Z0-9])")


def split_sentences(text: str) -> list[str]:
    out, start = [], 0
    for m in _SENT_END.finditer(text):
        before = re.search(r"(\w+)[.!?][\"'”’)\]]*\s+$", text[start:m.end()])
        if before:
            w = before.group(1)
            if (len(w) == 1 and w.isupper()) or w.lower() in _NO_SPLIT_BEFORE:
                continue
        out.append(text[start:m.end()].strip())
        start = m.end()
    tail = text[start:].strip()
    if tail:
        out.append(tail)
    return [s for s in out if s]


def _pack(pieces: list[str], max_chars: int) -> list[str]:
    out, cur = [], ""
    for p in pieces:
        cand = (cur + " " + p).strip()
        if len(cand) <= max_chars:
            cur = cand
        else:
            if cur:
                out.append(cur)
            cur = p
    if cur:
        out.append(cur)
    return out


def split_long(sentence: str, max_chars: int) -> list[str]:
    """A sentence longer than max_chars splits at ; : then , then words."""
    if len(sentence) <= max_chars:
        return [sentence]
    for pat in (r"(?<=[;:])\s+", r"(?<=,)\s+"):
        parts = re.split(pat, sentence)
        if len(parts) > 1:
            out = []
            for piece in _pack(parts, max_chars):
                out.extend(split_long(piece, max_chars))
            return out
    return _pack(sentence.split(" "), max_chars)


def balanced_pack(sentences: list[str], max_chars: int) -> list[str]:
    """Pack sentences into chunks <= max_chars of roughly equal length (no tiny tail)."""
    total = sum(len(s) + 1 for s in sentences)
    n = max(1, -(-total // max_chars))
    while True:
        target = total / n
        out, cur = [], ""
        for s in sentences:
            cand = (cur + " " + s).strip()
            if cur and (len(cand) > max_chars or
                        (len(cur) >= target and abs(len(cand) - target) > abs(len(cur) - target))):
                out.append(cur)
                cur = s
            else:
                cur = cand
        if cur:
            out.append(cur)
        if all(len(c) <= max_chars for c in out) or n > len(sentences):
            return out
        n += 1


# ---------------------------------------------------------------- chunks


@dataclass
class Chunk:
    idx: int
    text: str                       # sent to the TTS (lexicon respellings applied)
    ref_text: str                   # expected transcript
    kind: str                       # title | heading | body
    pause_before_ms: int
    anchors: list[list] = field(default_factory=list)   # [[anchor_id, word_index], ...]
    flags: list[str] = field(default_factory=list)

    @property
    def words(self) -> int:
        return len(self.ref_text.split())

    @property
    def sha(self) -> str:
        return hashlib.sha256(f"{PREP_VERSION}\n{self.text}\n{self.ref_text}".encode()).hexdigest()[:16]


@dataclass
class SectionPlan:
    work_id: str
    section_id: str
    title: str
    spoken_title: str
    bible: bool
    chunks: list[Chunk]

    @property
    def words(self) -> int:
        return sum(c.words for c in self.chunks)


def _ensure_stop(s: str) -> str:
    s = s.strip()
    return s if not s or s[-1] in ".!?:;\"”’)" else s + "."


def bible_title(work: dict, section: dict) -> str:
    n = int(section["id"])
    bn = work.get("book_number")
    book = BIBLE_BOOKS[bn - 1] if bn else (work.get("short_title") or work["title"])
    if book == "Psalms":
        return f"Psalm {cardinal(n)}."
    if work.get("chapters") == 1:
        return f"{book}."
    return f"{book}, chapter {cardinal(n)}."


def _paragraphs(work: dict, section: dict, bible: bool):
    """Yield paragraphs as (kind, [(anchor_id, spoken_text), ...], flags)."""
    para: list[tuple[str, str]] = []
    pflags: set[str] = set()
    prev_t = None
    heading_break = False
    blocks = section.get("blocks", [])
    first = next((j for j, x in enumerate(blocks) if x["t"] != "note"), -1)
    # A Book or Part section repeats its title as its only heading; the title is already read.
    echo = first if first >= 0 and blocks[first]["t"] == "h" and blocks[first]["text"].strip() == str(section.get("title", "")).strip() else -1
    for i, b in enumerate(blocks):
        t = b["t"]
        if t in ("note", "ref") or i == echo:
            continue
        if t == "h" and bible:
            heading_break = True  # BSB headings are editorial: not read, but end the paragraph
            prev_t = t
            continue
        if t == "h":
            if para:
                yield "body", para, pflags
                para, pflags = [], set()
            prev_t = t
            hflags: set[str] = set()
            text = _ensure_stop(normalize(b["text"], flags=hflags))
            if text:
                yield "heading", [(f"b{i}", text)], hflags
            continue
        bflags: set[str] = set()
        text = normalize(b["text"], bible=bible, flags=bflags)
        if not text:
            continue
        anchor = f"v{b['n']}" if t == "v" else f"b{i}"
        if t == "v" and b.get("cont"):
            anchor = None         # same verse resumes after a heading: one sentence, no new anchor
            new_para = False
        else:
            new_para = ((t == "v" and (b.get("p") or heading_break)) or t in ("p", "bq")
                        or (t == "q" and prev_t != "q"))
        heading_break = False
        if new_para and para:
            yield "body", para, pflags
            para, pflags = [], set()
        para.append((anchor, text))
        pflags |= bflags
        prev_t = t
    if para:
        yield "body", para, pflags


def plan_section(work: dict, section: dict, lexicon: Lexicon | None = None,
                 max_chars: int = MAX_CHARS) -> SectionPlan:
    lexicon = lexicon or Lexicon()
    bible = work.get("collection") == "bible"
    if bible:
        spoken_title = bible_title(work, section)
    else:
        spoken_title = _ensure_stop(normalize(section.get("title", "")))
    chunks: list[Chunk] = []

    def add(ref: str, kind: str, pause: int, anchors, cflags):
        chunks.append(Chunk(len(chunks), lexicon.apply(ref), ref, kind, pause, anchors, sorted(cflags)))

    if spoken_title:
        add(spoken_title, "title", PAUSE_LEAD_MS, [["title", 0]], set())
    first_after_title = True
    for kind, units, pflags in _paragraphs(work, section, bible):
        text, offsets = "", []
        for anchor, t in units:
            if text:
                text += " "
            if anchor:
                offsets.append((anchor, len(text)))
            text += t
        text = _ensure_stop(text)
        cflags = set(pflags)
        pieces = []
        for s in split_sentences(text):
            if len(s) > max_chars:
                cflags.add("long-sentence-split")
            pieces.extend(split_long(s, max_chars))
        pos = 0
        for j, ch in enumerate(balanced_pack(pieces, max_chars)):
            start = text.index(ch, pos)
            end = start + len(ch)
            anchors = [[a, len(text[start:off].split())] for a, off in offsets if start <= off < end]
            pos = end
            if not chunks:
                pause = PAUSE_LEAD_MS
            elif first_after_title:
                pause = PAUSE_TITLE_MS
            elif j == 0:
                pause = PAUSE_PARA_MS
            else:
                pause = PAUSE_SENT_MS
            first_after_title = False
            add(ch, kind, pause, anchors, cflags)
    return SectionPlan(work["id"], str(section["id"]), section.get("title", ""), spoken_title, bible, chunks)


_EN_STOP = set("the and of to a in that is was he for it with as his on be at by i this had not are but "
               "from or have an they which you were her all she there would their we him been has when "
               "who will more no if out so said what up its about into than them can only other new "
               "some could time these two may then do first any my now such like our over man me even "
               "most made after also did many before must through back years where much your way well "
               "down should because each just those people how too little us very upon unto thee thou "
               "thy shall lord god art hath".split())


def english_ratio(plan: "SectionPlan") -> float:
    words = re.findall(r"[a-zA-Z]+", " ".join(c.ref_text for c in plan.chunks if c.kind != "title"))
    return sum(w.lower() in _EN_STOP for w in words) / max(1, len(words))


def is_english(plan: "SectionPlan") -> bool:
    """Original-language sections (Latin, transliterated Greek) are not read by the English narrator."""
    return english_ratio(plan) >= 0.15


def load_work(path: Path) -> dict:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    w = dict(data["work"])
    w["sections"] = data.get("section", [])
    w["path"] = str(path)
    return w


def plan_work(path: Path, lexicon: Lexicon | None = None) -> list[SectionPlan]:
    w = load_work(path)
    lexicon = lexicon or Lexicon.load()
    return [plan_section(w, s, lexicon) for s in w["sections"]]


# ---------------------------------------------------------------- queue order

PRIORITY_BOOKS = [19, 43, 1]          # Psalms, John, Genesis
COLLECTION_ORDER = ["apostolic", "creeds", "ante-nicene", "nicene", "medieval", "aquinas", "reformation", "apocrypha", "pseudepigrapha", "jewish"]


def queue(library: Path) -> list[tuple[int, Path]]:
    """Work files in render priority order: (priority, path). Lower renders first.
    Gnostic texts and encyclicals are not in the audiobook queue. Neither are the daily gate's
    prayers: Donovan reads those himself (public/gate-voice/)."""
    out: list[tuple[int, Path]] = []
    bible = sorted((library / "bible" / "bsb").glob("*.toml"))
    for p in bible:
        m = re.match(r"(\d+)-", p.name)
        bn = int(m.group(1)) if m else 99
        if bn in PRIORITY_BOOKS:
            prio = PRIORITY_BOOKS.index(bn)
        elif bn >= 40:
            prio = 10 + bn            # rest of NT
        else:
            prio = 100 + bn           # rest of OT
        out.append((prio, p))
    confessions = sorted((library / "nicene" / "augustine").glob("confessions*.toml"))
    for i, p in enumerate(confessions):
        out.append((200 + i, p))
    for ci, coll in enumerate(COLLECTION_ORDER):
        for i, p in enumerate(sorted((library / coll).rglob("*.toml"))):
            if p in confessions:
                continue
            out.append((1000 * (ci + 1) + i, p))
    return sorted(out)


# ---------------------------------------------------------------- CLI


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", type=Path)
    ap.add_argument("--section")
    ap.add_argument("--queue", action="store_true", help="path is the library root; print the queue")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    if args.queue:
        for prio, p in queue(args.path):
            print(prio, p)
        return 0
    lex = Lexicon.load()
    w = load_work(args.path)
    for s in w["sections"]:
        if args.section and str(s["id"]) != args.section:
            continue
        plan = plan_section(w, s, lex)
        if args.json:
            print(json.dumps({**{k: v for k, v in asdict(plan).items() if k != "chunks"},
                              "chunks": [asdict(c) | {"sha": c.sha} for c in plan.chunks]},
                             ensure_ascii=False, indent=2))
            continue
        print(f"== {plan.work_id}/{plan.section_id} ({plan.words} words, {len(plan.chunks)} chunks)")
        for c in plan.chunks:
            print(f"  [{c.idx:03d} {c.kind:7s} +{c.pause_before_ms}ms {len(c.text):3d}c] {c.text}")
            if c.anchors:
                print(f"        anchors={c.anchors} flags={c.flags}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
