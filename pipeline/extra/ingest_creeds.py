"""Ingest the five ecumenical creeds from Philip Schaff, The Creeds of Christendom.

Usage: python3 -I pipeline/extra/ingest_creeds.py
Reads pipeline/cache/extra/creeds1.xml and creeds2.xml (CCEL ThML; fetch with fetch.py) and writes
library/creeds/<slug>.toml. English first, then the Latin or Greek original Schaff prints beside it.

Edition: the creed pages are unchanged from the first edition (Harper & Brothers, New York, 1877);
checked against the 1877/1878 printing on archive.org (creedsofchristen01scha, creedsofchristen02scha).
CCEL's file is the sixth edition (copyright 1877, 1905, 1919); its later appendices are not used.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import thml  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

OUT = LIBRARY / "creeds"
V1_URL = "https://www.ccel.org/ccel/schaff/creeds1.xml"
V2_URL = "https://www.ccel.org/ccel/schaff/creeds2.xml"
EDITION_V2 = (
    "Philip Schaff, The Creeds of Christendom, Vol. II: The Greek and Latin Creeds, with Translations "
    "(New York: Harper & Brothers, 1877); text as reprinted in the sixth edition (1919), CCEL digitization"
)
EDITION_V1V2 = (
    "Philip Schaff, The Creeds of Christendom, Vol. I, § 8 (English, pp. 28-29) and Vol. II (Greek) "
    "(New York: Harper & Brothers, 1877); text as reprinted in the sixth edition (1919), CCEL digitization"
)
BASIS = (
    "Published 1877 in the United States (Harper & Brothers); the creed translations are unchanged "
    "from that edition"
)


# Transcription errors in the CCEL file, each checked against the printed page image
# (https://www.ccel.org/ccel/schaff/creeds2/png-hires/<page>.png). Readings the page itself prints,
# such as "καραδέδωκε" and "inseperabiliter", are kept.
FIXES = [(unicodedata.normalize("NFC", o), unicodedata.normalize("NFC", n), w) for o, n, w in [
    ("ἕν ΘΕΟΝ", "ἕνα ΘΕΟΝ", "Vol. II p. 57"),
    ("ἀληθενοῦ", "ἀληθινοῦ", "Vol. II p. 57"),
    ("βάρτισμα", "βάπτισμα", "Vol. II p. 58"),
    ("ὑπὸστασιν", "ὑπόστασιν", "Vol. II p. 62"),
    ("non in duos personas", "non in duas personas", "Vol. II p. 63"),
    ("Hæc est fides catholicæ:", "Hæc est fides catholica:", "Vol. II p. 70"),
]]


def apply_fixes(secs: list[dict], used: set[str]) -> None:
    for s in secs:
        for b in s["blocks"]:
            b["text"] = unicodedata.normalize("NFC", b["text"])
            for old, new, _ in FIXES:
                if old in b["text"]:
                    b["text"] = b["text"].replace(old, new)
                    used.add(old)


def plain(t: str) -> str:
    """Original-language text: Schaff sets Latin in italics and names in small caps; drop the italics."""
    return re.sub(r"\s{2,}", " ", t.replace("*", "")).strip()


def cell(c: str) -> tuple[list[str], list[tuple[str, str]]]:
    return thml.read(c)


def blocks_from(paras: list[str], notes: list[tuple[str, str]], t: str = "p") -> list[dict]:
    out = [{"t": t, "text": p} for p in paras if p]
    used = set(re.findall(r"\[\^([A-Za-z0-9_.-]+)\]", " ".join(paras)))
    out += [{"t": "note", "id": n, "text": x} for n, x in notes if n in used]
    return out


def strip_notes(t: str) -> str:
    return re.sub(r"\[\^[^\]]+\]", "", t)


def base(slug: str, title: str, date: str, language: str, edition: str, src: str, summary: str) -> dict:
    vol = "creeds1.xml" if src == V1_URL else "creeds2.xml"
    m = meta(vol)
    return {
        "id": slug, "title": title, "author": "church", "collection": "creeds", "date": date,
        "language": language, "translator": "Philip Schaff", "edition": edition,
        "source_url": src, "source_sha256": m["sha256"], "retrieved": m["retrieved"],
        "license": "Public domain", "license_basis": BASIS, "summary": summary,
    }


def main() -> int:
    v1 = (CACHE / "creeds1.xml").read_text(encoding="utf-8")
    v2 = (CACHE / "creeds2.xml").read_text(encoding="utf-8")
    written = []
    used: set[str] = set()

    # Apostles' Creed: Vol. II, Symbolum Apostolicum, Forma Recepta.
    d = thml.div(v2, "Forma Recepta (Received Form).")
    tbl_end = d.index("</table>") + len("</table>")
    rows = thml.table_cells(d[:tbl_end])
    latin = [plain(strip_notes(" ".join(cell(r[0])[0]))) for r in rows]
    greek = [plain(strip_notes(" ".join(cell(r[1])[0]))) for r in rows]
    paras, notes = thml.read(d[tbl_end:])
    assert paras[0].startswith("I. THE APOSTLES' CREED"), paras[0]
    eng = paras[1:]
    work = base("apostles-creed", "The Apostles' Creed", "Received form by the 8th century; Old Roman form 2nd to 4th century",
                "Latin", EDITION_V2, V2_URL,
                "The baptismal creed of the Western church in its received form, in Schaff's English "
                "translation with his notes, followed by the Latin and Greek texts he prints.")
    work["order"] = 1
    secs = [
        {"id": "text", "title": "The Apostles' Creed", "level": 1, "blocks": blocks_from(eng, notes)},
        {"id": "latin-greek", "title": "Latin and Greek Text", "level": 1,
         "blocks": [{"t": "h", "text": "Latin"}] + [{"t": "p", "text": x} for x in latin]
         + [{"t": "h", "text": "Greek"}] + [{"t": "p", "text": x} for x in greek]},
    ]
    apply_fixes(secs, used)
    written.append(write_work(OUT / "apostles-creed.toml", work, secs))

    # Nicene Creed (325) and Niceno-Constantinopolitan Creed (381): English from Vol. I, § 8.
    i = re.search(r"original\s+and\s+the\s+enlarged", v1).start()
    j = v1.find("<p class", v1.find("</table>", v1.find("Page_29", i)))
    rows = thml.table_cells(v1[i:j])[1:]  # skip the header row
    e325 = [cell(r[0])[0] for r in rows]
    e381 = [cell(r[1])[0] for r in rows]
    # In the 325 column Schaff brackets the words the 381 text later dropped; in the 381 column he
    # italicizes the additions. Standing alone, each is plain text.
    e325 = [strip_notes(" ".join(p)) for p in e325 if p]
    e325[1] = e325[1].replace("[the only-begotten;", "[^b][the only-begotten;", 1)
    assert "[^b]" in e325[1]
    e381 = [plain(strip_notes(" ".join(p))) for p in e381 if p]
    # Greek originals from Vol. II.
    d = thml.div(v2, "Symbolum Nicænum. A.D. 325.")
    g325 = [plain(strip_notes(" ".join(cell(r[0])[0]))) for r in thml.table_cells(d[: d.index("</table>")])[1:]]
    d = thml.div(v2, "Forma Recepta Ecclesiæ Orientalis. A.D. 381.")
    g381_rows = thml.table_cells(d)[1:]
    g381 = [plain(strip_notes(" ".join(cell(r[0])[0]))) for r in g381_rows]
    # The Holy Spirit article spans a page break across two rows; join into one paragraph.
    g381 = [g381[0], g381[1], g381[2] + " " + g381[3]] if len(g381) == 4 else g381

    work = base("nicene-creed-325", "The Nicene Creed (325)", "325", "Greek", EDITION_V1V2, V1_URL,
                "The creed adopted by the Council of Nicaea in 325, with its closing anathema against "
                "the Arian teaching, in Schaff's English translation and the Greek text.")
    work["order"] = 2
    secs = [
        {"id": "text", "title": "The Nicene Creed of 325", "level": 1, "blocks": [{"t": "p", "text": x} for x in e325] + [
            {"t": "note", "id": "b", "text": "Brackets as printed by Schaff, who encloses in brackets "
             "the words of the Creed of 325 that the received text of 381 omits (Vol. I, p. 28)."}]},
        {"id": "greek", "title": "Greek Text", "level": 1, "blocks": [{"t": "p", "text": x} for x in g325]},
    ]
    apply_fixes(secs, used)
    written.append(write_work(OUT / "nicene-creed-325.toml", work, secs))

    work = base("niceno-constantinopolitan-creed", "The Niceno-Constantinopolitan Creed (381)", "381", "Greek",
                EDITION_V1V2, V1_URL,
                "The enlarged Nicene Creed received at the Council of Constantinople in 381, the form "
                "confessed in the churches today, in Schaff's English translation and the Greek text. "
                "The Western churches later added \"and the Son\" (Filioque) after \"proceedeth from the Father\".")
    work["short_title"] = "Nicene Creed (381)"
    work["order"] = 3
    secs = [
        {"id": "text", "title": "The Constantinopolitan Creed of 381", "level": 1, "blocks": [{"t": "p", "text": x} for x in e381]},
        {"id": "greek", "title": "Greek Text", "level": 1, "blocks": [{"t": "p", "text": x} for x in g381]},
    ]
    apply_fixes(secs, used)
    written.append(write_work(OUT / "niceno-constantinopolitan-creed.toml", work, secs))

    # Chalcedonian Definition: Vol. II, Symbolum Chalcedonense (Greek | English rows), then Latin.
    d = thml.div(v2, "Symbolum Chalcedonense.")
    t_end = d.rindex("</table>") + len("</table>")
    rows = thml.table_cells(d[:t_end])
    eng_parts, eng_notes, grk_parts = [], [], []
    for r in rows:
        p, n = cell(r[1])
        eng_parts.append(" ".join(p))
        eng_notes += n
        grk_parts.append(" ".join(cell(r[0])[0]))
    eng = re.sub(r"\s{2,}", " ", " ".join(eng_parts)).strip()
    grk = plain(strip_notes(" ".join(grk_parts)))
    after, _ = thml.read(d[t_end:])
    k = next(n for n, x in enumerate(after) if x.startswith("SYMBOLUM CHALCEDONENSE"))
    latin = plain(after[k + 1])
    assert latin.startswith("Sequentes igitur"), latin[:40]
    work = base("chalcedonian-definition", "The Chalcedonian Definition (451)", "22 October 451", "Greek",
                EDITION_V2, V2_URL,
                "The definition of the faith concerning the two natures of Christ in one Person, adopted "
                "by the Council of Chalcedon in 451, in Schaff's English translation with his notes, "
                "followed by the Greek text and the Latin version.")
    work["short_title"] = "Chalcedonian Definition"
    work["order"] = 4
    secs = [
        {"id": "text", "title": "The Symbol of Chalcedon", "level": 1, "blocks": blocks_from([eng], eng_notes)},
        {"id": "greek-latin", "title": "Greek Text and Latin Version", "level": 1,
         "blocks": [{"t": "h", "text": "Greek"}, {"t": "p", "text": grk},
                    {"t": "h", "text": "Latin Version"}, {"t": "p", "text": latin}]},
    ]
    apply_fixes(secs, used)
    written.append(write_work(OUT / "chalcedonian-definition.toml", work, secs))

    # Athanasian Creed (Quicunque vult): Vol. II, Latin | English rows, numbered 1-44.
    d = thml.div(v2, "Symbolum Quicunque: The Athanasian Creed.")
    rows = thml.table_cells(d)[1:]
    eng, lat, eng_notes = [], [], []
    for r in rows:
        lp = " ".join(cell(r[0])[0])
        ep, en = cell(r[1])
        ep = " ".join(ep)
        if set(lp) <= set("— "):
            continue
        lat.append(plain(lp))
        eng.append(ep)
        eng_notes += en
    assert len(eng) == 44 and eng[-1].startswith("44."), (len(eng), eng[-1][:20])
    work = base("athanasian-creed", "The Athanasian Creed (Quicunque Vult)", "Late 5th to 6th century, Southern Gaul",
                "Latin", EDITION_V2, V2_URL,
                "The Western confession of the Trinity and the Incarnation named for its first words, "
                "Quicunque vult, in the old English translation as revised by Schaff, followed by the Latin.")
    work["short_title"] = "Athanasian Creed"
    work["order"] = 5
    secs = [
        {"id": "text", "title": "The Athanasian Creed", "level": 1, "blocks": blocks_from(eng, eng_notes)},
        {"id": "latin", "title": "Latin Text", "level": 1, "blocks": [{"t": "p", "text": x} for x in lat]},
    ]
    apply_fixes(secs, used)
    written.append(write_work(OUT / "athanasian-creed.toml", work, secs))

    missing = [o for o, _, _ in FIXES if o not in used]
    assert not missing, f"fixes not applied: {missing}"
    for p in written:
        print("wrote", p.relative_to(LIBRARY.parent))
    return 0


if __name__ == "__main__":
    sys.exit(main())
