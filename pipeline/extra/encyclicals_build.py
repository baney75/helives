"""Stage 3 of the encyclicals catalog: write data/encyclicals.toml.

Usage: python3 -I pipeline/extra/encyclicals_build.py
Inputs (all cached): pipeline/cache/extra/vat/entries.json (stage 1, the vatican.va lists),
pipeline/cache/extra/vat/status.json (stage 2, HTTP status of every URL), the Wikipedia
"List of encyclicals of Pope X" wikitext in pipeline/cache/extra/wp/, and pipeline/extra/encyclicals_manual.toml
for the few popes whose Wikipedia page has no table. Prints a cross-check report: vatican.va entries with no
Wikipedia row, and Wikipedia rows with no vatican.va entry.
"""
from __future__ import annotations

import html
import json
import re
import sys
import tomllib
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch import CACHE  # noqa: E402
from encyclicals_collect import MONTHS  # noqa: E402

ROOT = HERE.parent.parent
VAT = CACHE / "vat"
WP = CACHE / "wp"
OUT = ROOT / "data" / "encyclicals.toml"
MANUAL = HERE / "encyclicals_manual.toml"
HOSTED = HERE / "encyclicals_hosted.toml"  # url -> work id, written by ingest_leo_xiii.py

WP_FILE = {
    "Benedict XIV": "Benedict_XIV", "Clement XIII": "Clement_XIII", "Clement XIV": "Clement_XIV",
    "Pius VI": "Pius_VI", "Pius VII": "Pius_VII", "Leo XII": "Leo_XII", "Pius VIII": "Pius_VIII",
    "Gregory XVI": "Gregory_XVI", "Pius IX": "Pius_IX", "Leo XIII": "Leo_XIII", "Pius X": "Pius_X",
    "Benedict XV": "Benedict_XV", "Pius XI": "Pius_XI", "Pius XII": "Pius_XII", "John XXIII": "John_XXIII",
    "Paul VI": "Paul_VI", "John Paul II": "John_Paul_II", "Benedict XVI": "Benedict_XVI", "Francis": "Francis",
    "Leo XIV": "Leo_XIV",
}


def strip_templates(s: str) -> str:
    # innermost first, repeatedly
    for _ in range(6):
        s2 = re.sub(r"\{\{\s*dts\s*\|(?:[^{}|]*=[^{}|]*\|)*([^{}]*)\}\}", r"\1", s, flags=re.I)
        s2 = re.sub(r"\{\{\s*(?:lang|lang-la|nowrap)\s*\|(?:[^{}|]*\|)?([^{}|]*)\}\}", r"\1", s2, flags=re.I)
        s2 = re.sub(r"\{\{[^{}]*\}\}", "", s2)
        if s2 == s:
            break
        s = s2
    return s


def clean(s: str) -> str:
    s = re.sub(r"<ref[^>/]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = strip_templates(s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s*([^\]]*)\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip('"“” ').strip()


def date_iso(s: str) -> str:
    s = clean(s)
    m = re.search(r"(\d{1,2}) ([A-Za-z]+),? (\d{4})", s)
    if m and m.group(2).lower() in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"([A-Za-z]+) (\d{1,2}),? (\d{4})", s)
    if m and m.group(1).lower() in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
    return ""


def split_cells(line: str) -> list[str]:
    body = line[1:]
    parts = re.split(r"\|\||!!", body)
    out = []
    for p in parts:
        # drop a leading attribute block: 'scope="row" style=".." | content'
        m = re.match(r"\s*(?:[a-z-]+\s*=\s*\"[^\"]*\"\s*|[a-z]+=\d+\s*)+\|(?!\|)(.*)$", p, flags=re.S)
        out.append(m.group(1) if m else p)
    return out


def wp_rows(pope: str) -> list[dict]:
    f = WP / f"{WP_FILE[pope]}.json"
    if not f.exists():
        return []
    w = json.loads(f.read_text())["parse"]["wikitext"]
    w = w if isinstance(w, str) else w["*"]
    w = re.sub(r"</?(?:includeonly|onlyinclude|noinclude)>", "", w)
    w = re.sub(r"<includeonly>.*?</includeonly>", "", w, flags=re.S)
    w = w.replace("\n|}\n|-", "\n|-")  # a table closed inside includeonly and continued after it
    rows: list[dict] = []
    for table in re.findall(r"\{\|.*?\n\|\}", w, flags=re.S):
        header: list[str] = []
        for chunk in re.split(r"\n\|-[^\n]*", table):
            cells: list[str] = []
            is_head = False
            for line in chunk.split("\n"):
                if line.startswith("{|") or not line or line[0] not in "|!":
                    if cells and line and line[0] not in "|!{":
                        cells[-1] += " " + line  # continuation of a multi-line cell
                    continue
                if line.startswith("!") and ("!!" in line or not cells) and not re.match(r"!\s*scope=\"row\"", line):
                    is_head = True
                cells += split_cells(line)
            if not cells:
                continue
            texts = [clean(c) for c in cells]
            if is_head:
                header += [t.lower() for t in texts]
                continue
            d = ""
            for t in texts:
                d = date_iso(t)
                if d:
                    break
            if not d:
                continue
            row = {"date": d, "cells": texts}
            # latin title: first cell with italic markup or a wikilink after the number cell
            for raw, t in zip(cells, texts):
                if re.fullmatch(r"\d+\.?", t) or not t:
                    continue
                row["latin"] = t
                break
            hl = " ".join(header)
            # english translation and subject by header position when the header is simple
            simple = [h for h in header if h not in ("latin", "english translation")]
            if "english translation" in header and "title" in simple:
                # two-row header (Pius XII, John Paul II): No. | Latin | English | Subject | Date
                names = ["no.", "latin", "english", "subject", "date"]
            else:
                names = []
                for h in header:
                    if h.startswith("no"):
                        names.append("no.")
                    elif "latin" in h or h == "title":
                        names.append("latin")
                    elif "english" in h:
                        names.append("english")
                    elif "subject" in h or "theme" in h:
                        names.append("subject")
                    elif "date" in h:
                        names.append("date")
                    else:
                        names.append(h)
            if not names or "no." not in names:
                pass
            cmap = dict(zip(names, texts)) if len(texts) >= len(names) - 1 else {}
            if names and names[0] == "no." and texts and not re.fullmatch(r"\d+\.?", texts[0]):
                cmap = dict(zip(names[1:], texts))
            row["english"] = cmap.get("english", "")
            row["subject"] = cmap.get("subject", "")
            if cmap.get("latin"):
                row["latin"] = cmap["latin"]
            del hl
            rows.append(row)
    return rows


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("æ", "ae").replace("œ", "oe").replace("j", "i").replace("v", "u")
    return re.sub(r"[^a-z]", "", s)


def sentence(s: str) -> str:
    s = s.strip().rstrip(".")
    if not s:
        return ""
    s = s[0].upper() + s[1:]
    return s + "."


def short_subject(row: dict) -> str:
    """english_title is a short English subject: Wikipedia's Subject column when short, else its
    English rendering of the incipit."""
    subj = row.get("subject", "").strip().rstrip(".")
    if subj and len(subj.split()) <= 10:
        return subj
    return row.get("english", "") or " ".join(subj.split()[:10])


def subject_sentence(pope: str, subj: str) -> str:
    """A plain description: Wikipedia's Subject column, sentence case, ending in a period."""
    subj = subj.strip().rstrip(".")
    if not subj:
        return ""
    return subj[0].upper() + subj[1:] + "."


def main() -> int:
    entries = json.loads((VAT / "entries.json").read_text())
    status = json.loads((VAT / "status.json").read_text()) if (VAT / "status.json").exists() else {}
    manual = tomllib.loads(MANUAL.read_text()) if MANUAL.exists() else {}
    man = {m["url"]: m for m in manual.get("encyclical", [])}
    hosted = tomllib.loads(HOSTED.read_text()).get("hosted", {}) if HOSTED.exists() else {}
    out_rows = []
    report: list[str] = []
    counts: dict[str, int] = {}
    for pope in WP_FILE:
        es = [e for e in entries if e["pope"] == pope]
        rows = wp_rows(pope)
        used: set[int] = set()
        for e in es:
            match = None
            cands = [i for i, r in enumerate(rows) if r["date"] == e["date"] and i not in used]
            if len(cands) > 1:
                cands = [i for i in cands if norm(rows[i].get("latin", ""))[:6] == norm(e["title"])[:6]] or cands[:1]
            if not cands:
                cands = [i for i, r in enumerate(rows) if i not in used and norm(r.get("latin", ""))
                         and norm(r.get("latin", "")) == norm(e["title"])]
            if cands:
                match = rows[cands[0]]
                used.add(cands[0])
            m = man.get(e["url"], {})
            title = e["title"]
            if match and match.get("latin") and (pope in ("Benedict XIV", "Clement XIII", "Clement XIV", "Pius VI",
                                                          "Pius VII", "Leo XII", "Pius VIII", "Gregory XVI", "Pius IX")
                                                  or norm(match["latin"]) == norm(title)):
                title = match["latin"]
            title = m.get("title", title)
            english = m.get("english_title") or short_subject(match or {})
            subject = m.get("subject") or subject_sentence(pope, (match or {}).get("subject", ""))
            if not match:
                report.append(f"  no Wikipedia row: {pope} {e['date']} {title}")
            out_rows.append({
                "title": title, "english_title": english, "pope": pope, "date": e["date"],
                "subject": subject, "url": e["url"], "full_text": hosted.get(e["url"], ""),
                "_status": status.get(e["url"], "unchecked"),
            })
        for i, r in enumerate(rows):
            if i not in used:
                report.append(f"  Wikipedia only: {pope} {r['date']} {r.get('latin', '?')}")
        counts[pope] = len(es)
    lines = ["# Papal encyclicals from Benedict XIV (1740) to the present pope, as listed on vatican.va.",
             "# Generated by pipeline/extra/encyclicals_build.py; do not edit by hand.",
             "# url: the vatican.va English page when one exists, else the Latin or Italian page.",
             "# full_text: the library work id when a public domain English translation is hosted, else empty.",
             ""]

    def q(s: str) -> str:
        return json.dumps(s, ensure_ascii=False)

    missing = []
    for r in out_rows:
        for k in ("english_title", "subject"):
            if not r[k]:
                missing.append(f"{r['pope']} {r['date']} {r['title']}: no {k}")
        lines.append("[[encyclical]]")
        for k in ("title", "english_title", "pope", "date", "subject", "url", "full_text"):
            lines.append(f"{k} = {q(r[k])}")
        lines.append("")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("counts per pope:")
    for p, n in counts.items():
        print(f"  {p}: {n}")
    print("total", len(out_rows))
    bad = [r for r in out_rows if r["_status"] != 200]
    print("URL status not 200:", len(bad))
    for r in bad:
        print("  ", r["_status"], r["url"])
    print("hosted full text:", sum(1 for r in out_rows if r["full_text"]))
    print("cross-check against Wikipedia:")
    print("\n".join(report) or "  none")
    print("missing fields:", len(missing))
    print("\n".join("  " + m for m in missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
