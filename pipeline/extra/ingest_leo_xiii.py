"""Ingest Leo XIII's encyclicals from The Great Encyclical Letters of Pope Leo XIII (New York: Benziger Brothers, 1903).

Usage: python3 -I pipeline/extra/ingest_leo_xiii.py
Text: the Wikisource transcription of the 1903 book (rendered pages cached in pipeline/cache/extra/gel/ by
the parse API), whose pages are proofread against the scan. A letter is ingested only when it is an
encyclical in data/encyclicals.toml's source list (pipeline/cache/extra/vat/entries.json, matched by date)
and every transcluded page is marked proofread (quality 3) or validated (quality 4). Letters with any
unproofread page (quality 1) are skipped and listed, because their text is raw OCR.
Each hosted letter is then compared word by word with the archive.org OCR of the same printing
(greatencyclicall00cathuoft, cached as gel1903.txt) by compare_ocr.py.
Writes library/encyclicals/leo-xiii/<slug>.toml and pipeline/extra/encyclicals_hosted.toml (url -> work id).
"""
from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from fetch import CACHE  # noqa: E402
from libtoml import LIBRARY, sha256_file, write_work  # noqa: E402
from encyclicals_collect import MONTHS  # noqa: E402

GEL = CACHE / "gel"
HOSTED = HERE / "encyclicals_hosted.toml"
EDITION = ("The Great Encyclical Letters of Pope Leo XIII, translations from approved sources, with preface by "
           "John J. Wynne, S.J. (New York: Benziger Brothers, 1903)")
BASIS = ("Published 1903 in the United States (copyright 1903 by Benziger Brothers); published before 1931, "
         "so in the public domain in the United States")
WS = "https://en.wikisource.org/wiki/The_Great_Encyclical_Letters_of_Pope_Leo_XIII/"

IT, BD = "\x02", "\x03"


class Body(HTMLParser):
    """Paragraphs and footnotes from a rendered Wikisource page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth_out = 0       # >0 inside prp-pages-output
        self.div_depth = 0
        self.skip = 0            # inside style, pagenum, sup.reference, mw-cite-backlink
        self.skip_tags: list[str] = []
        self.paras: list[tuple[str, str]] = []  # (kind, text): kind "p" or "c" (centered)
        self.buf: list[str] = []
        self.center = 0
        self.notes: dict[str, str] = {}
        self.note_id = ""
        self.in_refs = False
        self.ref_target = ""
        self.stack: list[tuple[str, bool]] = []

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        cls = a.get("class", "")
        skip_this = False
        if tag == "style":
            skip_this = True
        elif tag == "span" and ("pagenum" in cls or "mw-cite-backlink" in cls or "ws-noexport" in cls):
            skip_this = True
        elif tag == "sup" and "reference" in cls:
            skip_this = True
            self.ref_target = ""
        elif tag == "div" and "ws-noexport" in cls:
            skip_this = True
        if tag == "a" and self.skip and a.get("href", "").startswith("#cite_note-"):
            self.ref_target = a["href"][len("#cite_note-"):]
        if tag == "ol" and "references" in cls:
            self.in_refs = True
        if tag == "li" and self.in_refs:
            self.note_id = a.get("id", "")[len("cite_note-"):]
            self.buf = []
        if tag in ("div", "span", "sup", "style", "p", "i", "b", "em", "strong", "li", "ol", "a", "small", "big"):
            self.stack.append((tag, skip_this))
            if skip_this:
                self.skip += 1
        if self.skip:
            return
        if tag == "div" and "wst-center" in cls:
            self.center += 1
        if tag == "p":
            self.flush()
        if tag in ("i", "em"):
            self.buf.append(IT)
        if tag in ("b", "strong"):
            self.buf.append(BD)
        if tag == "br":
            self.buf.append(" ")

    def handle_endtag(self, tag):
        # pop to the matching tag
        if tag in ("div", "span", "sup", "style", "p", "i", "b", "em", "strong", "li", "ol", "a", "small", "big"):
            while self.stack:
                t, sk = self.stack.pop()
                if sk:
                    self.skip -= 1
                    if t == "sup" and self.ref_target and not self.skip:
                        self.buf.append(f"[^{self.ref_target}]")
                        self.ref_target = ""
                if t == tag:
                    break
        if self.skip:
            return
        if tag in ("i", "em"):
            self.buf.append(IT)
        if tag in ("b", "strong"):
            self.buf.append(BD)
        if tag == "p":
            self.flush()
        if tag == "li" and self.in_refs:
            self.notes[self.note_id] = tidy("".join(self.buf))
            self.buf = []
        if tag == "ol" and self.in_refs:
            self.in_refs = False
        if tag == "div" and self.center:
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)

    def flush(self):
        if self.in_refs:
            return
        t = tidy("".join(self.buf))
        self.buf = []
        if t:
            self.paras.append(("c" if self.center else "p", t))

    def close(self):
        super().close()
        self.flush()


def pair(t: str, mark: str, md: str) -> str:
    t = re.sub(f"{mark}(\\s*){mark}", r"\1", t)
    parts = t.split(mark)
    if len(parts) % 2 == 0:  # unbalanced: drop the markers
        return t.replace(mark, "")
    out = [parts[0]]
    for k in range(1, len(parts), 2):
        inner = parts[k]
        lead = inner[: len(inner) - len(inner.lstrip())]
        trail = inner[len(inner.rstrip()):]
        core = inner.strip()
        out.append(f"{lead}{md}{core}{md}{trail}" if core else inner)
        out.append(parts[k + 1])
    return "".join(out)


def tidy(t: str) -> str:
    t = t.replace("​", "").replace("\xa0", " ").replace("­", "")
    t = unicodedata.normalize("NFC", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = pair(t, BD, "**")
    t = pair(t, IT, "*")
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    t = re.sub(r"\s+(\[\^)", r"\1", t)
    # a word broken by a hyphen at a printed page turn: "there- fore" -> "therefore"; "to- day" keeps
    # the period's hyphen ("to-day")
    t = re.sub(r"\b(to)- (day|morrow|night)\b", r"\1-\2", t)
    t = re.sub(r"\b([a-z]+)- ([a-z]+)\b", r"\1\2", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def heading_date(text: str) -> str:
    text = text.replace("*", "")
    m = re.search(r"([A-Z][a-z]+)\.? (\d{1,2}),? (\d{4})", text)
    if m and m.group(1).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
    return ""


def slug(title: str) -> str:
    s = unicodedata.normalize("NFKD", title.replace("æ", "ae").replace("Æ", "Ae").replace("œ", "oe"))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main() -> int:
    entries = [e for e in json.loads((CACHE / "vat" / "entries.json").read_text()) if e["pope"] == "Leo XIII"]
    by_date: dict[str, list[dict]] = {}
    for e in entries:
        by_date.setdefault(e["date"], []).append(e)
    hosted: dict[str, str] = {}
    skipped: list[str] = []
    order = 0
    for f in sorted(GEL.glob("*.json")):
        doc = json.loads(f.read_text())["parse"]
        page_title = doc.get("title", f.stem)
        h = doc["text"]
        q = re.findall(r'data-page-quality="(\d)"', h)
        start = h.find('<div class="prp-pages-output"')
        body = Body()
        body.feed(h[start:])
        body.close()
        paras = body.paras
        head = " ".join(t for k, t in paras[:4] if k == "c")
        date = heading_date(head)
        cands = by_date.get(date, [])
        if not cands:
            skipped.append(f"{page_title}: not an encyclical in the vatican.va list ({head[:90]})")
            continue
        if any(x not in ("3", "4") for x in q):
            skipped.append(f"{page_title}: {q.count('1')} of {len(q)} pages not proofread on Wikisource ({cands[0]['title']})")
            continue
        e = cands[0]
        # drop the centered heading lines (the book's running title for the letter); keep the dated line
        blocks: list[dict] = []
        used_notes: list[str] = []
        for kind, t in paras:
            if kind == "c" and t.rstrip(".").isupper():
                continue  # the book's capitalized letter title, already the work title
            for n in re.findall(r"\[\^([^\]]+)\]", t):
                if n not in used_notes:
                    used_notes.append(n)
            blocks.append({"t": "p", "text": t})
        # renumber notes 1..n in order of first reference
        ren = {old: str(i + 1) for i, old in enumerate(used_notes)}
        for b in blocks:
            b["text"] = re.sub(r"\[\^([^\]]+)\]", lambda m: f"[^{ren[m.group(1)]}]", b["text"])
        for old in used_notes:
            blocks.append({"t": "note", "id": ren[old], "text": body.notes.get(old, "")})
        missing = [old for old in used_notes if not body.notes.get(old)]
        if missing:
            raise SystemExit(f"{page_title}: footnote text missing for {missing}")
        latin = re.search(r"(?:Encyclical|Apostolic(?:al)?) Letter,?\s+\*?([^,*]+?)\*?\s*,", head)
        incipit = e["title"]
        sl = slug(incipit)
        wid = f"leo-xiii-{sl}"
        english = page_title.split("/", 1)[1] if "/" in page_title else page_title
        order += 1
        src = f
        work = {
            "id": wid,
            "title": f"{incipit}: {english}",
            "short_title": incipit,
            "author": "leo-xiii",
            "collection": "encyclicals",
            "order": 9,
            "date": e["date"],
            "language": "Latin",
            "translator": "Unnamed (translations from approved sources)",
            "edition": EDITION,
            "source_url": WS + english.replace(" ", "_"),
            "source_sha256": sha256_file(src),
            "retrieved": (src.with_name(src.name + ".meta").read_text().split("retrieved=")[1].split()[0]
                          if src.with_name(src.name + ".meta").exists() else ""),
            "license": "Public domain",
            "license_basis": BASIS,
            "summary": f"Pope Leo XIII's encyclical {incipit}, printed in English by Benziger Brothers in 1903 "
                       f"under the title {english}.",
        }
        if not work["retrieved"]:
            raise SystemExit(f"no retrieval record for {src}")
        sections = [{"id": "the-letter", "title": english, "level": 1, "blocks": blocks}]
        path = write_work(LIBRARY / "encyclicals" / "leo-xiii" / f"{sl}.toml", work, sections)
        hosted[e["url"]] = wid
        print("wrote", path.relative_to(LIBRARY.parent), len(blocks), "blocks", "latin in heading:",
              latin.group(1) if latin else "?")
    HOSTED.write_text("# vatican.va url -> hosted work id; written by ingest_leo_xiii.py\n[hosted]\n" +
                      "".join(f"{json.dumps(u)} = {json.dumps(w)}\n" for u, w in sorted(hosted.items())),
                      encoding="utf-8")
    print("skipped:")
    print("\n".join("  " + s for s in skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
