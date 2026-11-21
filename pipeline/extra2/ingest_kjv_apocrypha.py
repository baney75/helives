"""Ingest the Apocrypha of the King James Version, one work per book, in the order of the 1611 printing.

Usage: python3 -I pipeline/extra2/ingest_kjv_apocrypha.py
Text: eBible.org "King James Version + Apocrypha" USFM (eng-kjv_usfm.zip, from the CrossWire KJV text),
which is the standard Oxford text of 1769 (Benjamin Blayney's revision), the text printed in KJV Bibles
with the Apocrypha ever since. Spelling is the 1769 standard, not the 1611 original spelling.
Cached in pipeline/cache/extra2/kjv/. Cross-checked verse by verse against Project Gutenberg's KJV
Apocrypha (ebook 124) by pipeline/extra2/check_kjv_apocrypha.py when that file is cached.

Kept: every verse, the KJV italics for supplied words (as *italic*), the section headings, the
prologues of Ecclesiasticus, and the KJV marginal notes (as notes). Dropped: Strong's tags.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, sha256_file, write_work  # noqa: E402

USFM = CACHE / "kjv" / "usfm"
OUT = LIBRARY / "apocrypha" / "kjv"

# (code, slug, title, short title, section label, date, language, summary), 1611 order.
BOOKS = [
    ("1ES", "1-esdras", "The First Book of Esdras", "1 Esdras", "1 Esdras", "2nd century BC", "Greek",
     "A Greek retelling of the history from Josiah's Passover to Ezra's reading of the Law, parallel to 2 Chronicles 35 and 36, Ezra and part of Nehemiah, with the added story of the three guardsmen. It is canonical in the Eastern Orthodox churches but not in the Catholic canon, where it stands in an appendix to the Vulgate, and it is outside the Protestant canon."),
    ("2ES", "2-esdras", "The Second Book of Esdras", "2 Esdras", "2 Esdras", "late 1st century AD, with later Christian additions", "Latin (from a lost Greek and Hebrew original)",
     "A Jewish apocalypse (chapters 3 to 14) in which Ezra questions an angel about the suffering of Israel after the fall of Jerusalem, framed by later Christian chapters. It is not in the Catholic canon (it stands in an appendix to the Vulgate) or the Greek Orthodox canon, and it is outside the Protestant canon."),
    ("TOB", "tobit", "Tobit", "Tobit", "Tobit", "3rd or 2nd century BC", "Aramaic or Hebrew (the KJV follows the Greek)",
     "The story of Tobit, a devout Israelite exile in Nineveh, and of his son Tobias, who travels with the angel Raphael and marries Sarah. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("JDT", "judith", "Judith", "Judith", "Judith", "2nd century BC", "Hebrew (the KJV follows the Greek)",
     "The story of Judith, a widow of Bethulia, who delivers Israel from the Assyrian general Holofernes. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("ESG", "rest-of-esther", "The Rest of the Chapters of the Book of Esther", "Rest of Esther", "Rest of Esther", "2nd or 1st century BC", "Greek",
     "Additions found in the Greek text of Esther but not in the Hebrew, including Mardocheus' dream, the king's letters and the prayers of Mardocheus and Esther; the KJV prints them together as chapters 10:4 to 16. They are received as deuterocanonical by the Catholic and Orthodox churches and are outside the Protestant canon."),
    ("WIS", "wisdom-of-solomon", "The Wisdom of Solomon", "Wisdom", "Wisdom", "1st century BC", "Greek",
     "A Jewish book of wisdom written in Solomon's name on righteousness, immortality and the folly of idolatry. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("SIR", "ecclesiasticus", "The Wisdom of Jesus the Son of Sirach, or Ecclesiasticus", "Ecclesiasticus", "Ecclesiasticus", "about 180 BC (Greek translation about 132 BC)", "Hebrew (the KJV follows the Greek)",
     "Proverbs and instruction by Jesus the son of Sirach of Jerusalem, translated into Greek by his grandson, ending with the praise of famous men. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("BAR", "baruch", "Baruch", "Baruch", "Baruch", "2nd or 1st century BC", "Hebrew and Greek",
     "A book attributed to Baruch, Jeremiah's scribe, with a confession of sin, a poem on wisdom and words of comfort for Jerusalem; chapter 6 is the Epistle of Jeremy, a warning against idols. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("S3Y", "song-of-the-three-children", "The Song of the Three Holy Children", "Song of the Three Children", "Song of the Three Children", "2nd or 1st century BC", "Hebrew or Aramaic (the KJV follows the Greek)",
     "The prayer of Azarias and the hymn of the three young men in the furnace, which the Greek text of Daniel places after Daniel 3:23. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("SUS", "susanna", "The History of Susanna", "Susanna", "Susanna", "2nd or 1st century BC", "Hebrew or Greek",
     "The story of Susanna, falsely accused by two elders and saved by the young Daniel, which the Greek text adds to Daniel. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("BEL", "bel-and-the-dragon", "The History of the Destruction of Bel and the Dragon", "Bel and the Dragon", "Bel and the Dragon", "2nd or 1st century BC", "Hebrew or Greek",
     "Two stories, added to Daniel in the Greek text, in which Daniel exposes the priests of the idol Bel and slays the dragon worshipped in Babylon. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("MAN", "prayer-of-manasses", "The Prayer of Manasses", "Prayer of Manasses", "Prayer of Manasses", "2nd or 1st century BC", "Greek",
     "A prayer of repentance in the name of King Manasseh of Judah, written to fit 2 Chronicles 33:12 and 13. It is canonical in the Eastern Orthodox churches but not in the Catholic canon (it stands in an appendix to the Vulgate), and it is outside the Protestant canon."),
    ("1MA", "1-maccabees", "The First Book of the Maccabees", "1 Maccabees", "1 Maccabees", "about 100 BC", "Hebrew (the KJV follows the Greek)",
     "A history of the Jewish revolt against the Seleucid kings under Mattathias and his sons Judas, Jonathan and Simon, from 175 to 134 BC. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
    ("2MA", "2-maccabees", "The Second Book of the Maccabees", "2 Maccabees", "2 Maccabees", "late 2nd century BC", "Greek",
     "An abridgment of Jason of Cyrene's history of the Maccabean revolt up to Judas' victory over Nicanor, including the martyrdom of Eleazar and of the seven brothers and their mother. It is received as deuterocanonical by the Catholic and Orthodox churches and is outside the Protestant canon."),
]

NOTE_RX = re.compile(r"\\f \+ (.*?)\\f\*")


def clean_inline(s: str, notes: list[str]) -> str:
    """USFM inline markup to library markup; footnotes become [^n] markers collected in notes."""
    def note(m):
        body = re.sub(r"\\fr [^\\]*", "", m.group(1))
        body = re.sub(r"\\f[a-z]+\*?\s?", "", body).strip()
        notes.append(body)
        return f"[^{len(notes)}]"
    s = NOTE_RX.sub(note, s)
    s = re.sub(r"\\\+?w ([^|\\]*)(\|[^\\]*)?\\\+?w\*", r"\1", s)
    s = re.sub(r"\\nd (.*?)\\nd\*", lambda m: m.group(1).upper(), s)
    s = re.sub(r"\\add (.*?)\\add\*", r"*\1*", s)
    if "\\" in s:
        raise SystemExit(f"unhandled USFM marker in: {s[:120]}")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\*\s+\*", " ", s)
    return s.replace(" [^", "[^")


def parse(path: Path, label: str):
    text = path.read_text(encoding="utf-8")
    sections: list[dict] = []
    cur = None
    pending: list[dict] = []
    para_next = False
    verses = 0
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"\\(\w+)\s?(.*)$", line)
        if not m:
            raise SystemExit(f"{path.name}: stray line {line[:60]}")
        tag, rest = m.group(1), m.group(2).strip()
        if tag in ("id", "ide", "h", "toc1", "toc2", "toc3", "mt1"):
            continue
        if tag == "c":
            n = int(rest)
            cur = {"id": str(n), "title": f"{label} {n}", "level": 1, "blocks": pending, "notes": []}
            pending = []
            sections.append(cur)
            continue
        if cur is None and tag in ("s1", "is1", "ms1"):
            pending.append({"t": "h", "level": 2 if tag == "ms1" else 3, "text": clean_inline(rest, [])})
            continue
        if cur is None:
            raise SystemExit(f"{path.name}: text before first chapter: {line[:60]}")
        if tag in ("s1", "is1", "ms1"):
            cur["blocks"].append({"t": "h", "level": 2 if tag == "ms1" else 3,
                                  "text": clean_inline(rest, cur["notes"])})
            continue
        if tag == "p":
            if rest:
                cur["blocks"].append({"t": "p", "text": clean_inline(rest, cur["notes"])})
            else:
                para_next = True
            continue
        if tag == "v":
            vm = re.match(r"(\d+)\s+(.*)$", rest)
            b = {"t": "v", "n": int(vm.group(1)), "text": clean_inline(vm.group(2), cur["notes"])}
            if para_next:
                b["p"] = True
                para_next = False
            cur["blocks"].append(b)
            verses += 1
            continue
        raise SystemExit(f"{path.name}: unhandled marker \\{tag}")
    for s in sections:
        notes = s.pop("notes")
        s["blocks"] += [{"t": "note", "id": str(i + 1), "text": t} for i, t in enumerate(notes)]
    return sections, verses


def main() -> int:
    m = meta("kjv/eng-kjv_usfm.zip")
    zsha = sha256_file(CACHE / "kjv" / "eng-kjv_usfm.zip")
    for order, (code, slug, title, short, label, date, lang, summary) in enumerate(BOOKS, 1):
        path = next(USFM.glob(f"*-{code}eng-kjv.usfm"))
        sections, verses = parse(path, label)
        work = {
            "id": f"kjv-{slug}",
            "title": title,
            "short_title": short,
            "author": "apocrypha-anonymous",
            "collection": "apocrypha",
            "order": order,
            "date": date,
            "language": lang,
            "translator": "The King James translators (1611), standard text of 1769",
            "edition": "The Holy Bible, King James Version, with the Apocrypha: the Oxford standard text of 1769 (Benjamin Blayney), from the eBible.org USFM edition (eng-kjv, source dated 15 November 2026)",
            "source_url": "https://ebible.org/Scriptures/eng-kjv_usfm.zip",
            "source_sha256": zsha,
            "retrieved": m["retrieved"],
            "license": "Public domain",
            "license_basis": "The King James Version was published in London by Robert Barker in 1611 and the standard text by the Oxford University Press in 1769; it is in the public domain in the United States because it was published before 1931. (The Crown's letters patent restrict printing only inside the United Kingdom.)",
            "chapters": len(sections),
            "verses": verses,
            "summary": summary + " It is kept here for reading and study, not presented as Scripture.",
        }
        out = write_work(OUT / f"{slug}.toml", work, sections)
        print(f"{order:2d} {slug}: {len(sections)} chapters, {verses} verses -> {out.relative_to(LIBRARY.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
