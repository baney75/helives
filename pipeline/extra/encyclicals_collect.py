"""Stage 1 of the encyclicals catalog: list every encyclical vatican.va publishes, per pope.

Usage: python3 -I pipeline/extra/encyclicals_collect.py
Reads the cached index pages in pipeline/cache/extra/vat/ (fetched from
https://www.vatican.va/content/<pope>/en/encyclicals.index.html, or for popes before Leo XIII, whose
documents have no encyclicals index, the pope's home page https://www.vatican.va/content/<pope>/<lang>.html)
and writes pipeline/cache/extra/vat/entries.json.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch import CACHE  # noqa: E402

VAT = CACHE / "vat"
BASE = "https://www.vatican.va"

# (vatican slug, display name, our pope slug, has an encyclicals index)
POPES = [
    ("benedictus-xiv", "Benedict XIV", "benedict-xiv", False),
    ("clemens-xiii", "Clement XIII", "clement-xiii", False),
    ("clemens-xiv", "Clement XIV", "clement-xiv", False),
    ("pius-vi", "Pius VI", "pius-vi", False),
    ("pius-vii", "Pius VII", "pius-vii", False),
    ("leo-xii", "Leo XII", "leo-xii", False),
    ("pius-viii", "Pius VIII", "pius-viii", False),
    ("gregorius-xvi", "Gregory XVI", "gregory-xvi", False),
    ("pius-ix", "Pius IX", "pius-ix", False),
    ("leo-xiii", "Leo XIII", "leo-xiii", True),
    ("pius-x", "Pius X", "pius-x", True),
    ("benedict-xv", "Benedict XV", "benedict-xv", True),
    ("pius-xi", "Pius XI", "pius-xi", True),
    ("pius-xii", "Pius XII", "pius-xii", True),
    ("john-xxiii", "John XXIII", "john-xxiii", True),
    ("paul-vi", "Paul VI", "paul-vi", True),
    ("john-paul-ii", "John Paul II", "john-paul-ii", True),
    ("benedict-xvi", "Benedict XVI", "benedict-xvi", True),
    ("francesco", "Francis", "francis", True),
    ("leo-xiv", "Leo XIV", "leo-xiv", True),
]

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6, "luglio": 7,
    "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
    "ianuarii": 1, "februarii": 2, "martii": 3, "aprilis": 4, "maii": 5, "iunii": 6, "iulii": 7,
    "augusti": 8, "septembris": 9, "octobris": 10, "novembris": 11, "decembris": 12,
}


def iso(day: str, month: str, year: str) -> str:
    return f"{int(year):04d}-{MONTHS[month.lower()]:02d}-{int(day):02d}"


def printed_iso(when: str) -> str:
    w = re.sub(r"[,.]", " ", when)
    w = re.sub(r"\s+", " ", w).strip()
    m1 = re.fullmatch(r"(\d{1,2}) ([A-Za-z]+) (\d{4})", w)
    m2 = re.fullmatch(r"([A-Za-z]+) (\d{1,2}) (\d{4})", w)
    if m1 and m1.group(2).lower() in MONTHS:
        return iso(*m1.groups())
    if m2 and m2.group(1).lower() in MONTHS:
        return iso(m2.group(2), m2.group(1), m2.group(3))
    return ""


def text(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def modern(vslug: str) -> list[dict]:
    s = (VAT / f"{vslug}-en.htm").read_text(encoding="utf-8")
    out = []
    for href, label in re.findall(r'<div class="item">\s*<h2><a href="([^"]+)">(.*?)</a></h2>', s, flags=re.S):
        label = text(label)
        label = re.sub(r"^Encyclical Letter of His Holiness \w+ \w+\s*", "", label)
        m = re.match(r"(.+?)\s*\((.+?)\)\s*$", label)
        title, when = (m.group(1), m.group(2)) if m else (label, "")
        date = printed_iso(when)
        d = re.search(r"_enc_(\d{2})(\d{2})(\d{4})_", href)
        url_date = f"{d.group(3)}-{d.group(2)}-{d.group(1)}" if d else ""
        if not date:
            date = url_date
        elif url_date and url_date != date:
            print(f"date mismatch {title}: printed {date} url {url_date}", file=sys.stderr)
        if href.endswith("_nos-es-muy-conocida.html"):
            continue  # the same letter as Firmissimam constantiam (same date); this URL serves that page
        out.append({"title": title.strip(), "date": date, "printed_date": when, "url": BASE + href})
    # The Latin and Italian indexes list letters that have no English page. Add those, keyed by file name;
    # the URL is the Latin page when one exists, else the Italian.
    have = {e["url"].rsplit("/", 1)[-1] for e in out}
    extra: dict[str, dict] = {}
    for lang in ("la", "it"):
        f = VAT / f"{vslug}-{lang}.htm"
        if not f.exists():
            continue
        s = f.read_text(encoding="utf-8")
        for href, label in re.findall(r'<div class="item">\s*<h2><a href="([^"]+)">(.*?)</a></h2>', s, flags=re.S):
            name = href.rsplit("/", 1)[-1]
            if name in have:
                continue
            d = re.search(r"_enc_(\d{8})_", href)
            if not d:
                continue
            code = d.group(1)
            # the URL date code is YYYYMMDD or DDMMYYYY
            if code[:2] in ("17", "18", "19", "20") and 1 <= int(code[4:6]) <= 12:
                date = f"{code[:4]}-{code[4:6]}-{code[6:]}"
            else:
                date = f"{code[4:]}-{code[2:4]}-{code[:2]}"
            title = re.sub(r"\s*\(.*?\)\s*$", "", text(label).split(",")[0]).strip()
            url = BASE + href
            for lg in ("la", "it"):
                alt = re.search(rf'href="(/content/{vslug}/{lg}/[^"]*/{re.escape(name)})"', s)
                if alt:
                    url = BASE + alt.group(1)
                    break
            key5 = re.sub(r"[^a-z]", "", title.lower())[:5]
            if any(e["date"] == date or (e["date"][:4] == date[:4]
                                        and re.sub(r"[^a-z]", "", e["title"].lower())[:5] == key5) for e in out):
                continue
            if name not in extra:
                extra[name] = {"title": title, "date": date, "printed_date": "", "url": url}
    for name, e in extra.items():
        print(f"  {vslug}: no English page, added {e['date']} {e['title']} {e['url']}", file=sys.stderr)
        out.append(e)
    return out


def old(vslug: str) -> list[dict]:
    seen: dict[str, dict] = {}
    for lang in ("it", "en", "la"):
        f = VAT / f"home-{vslug}-{lang}.htm"
        if not f.exists():
            continue
        s = f.read_text(encoding="utf-8")
        for href in re.findall(rf'href="(/content/{vslug}/[^"]+)"', s):
            name = href.rsplit("/", 1)[-1]
            if not re.match(r"(breve-)?(epistola-)?encic|(epistola-)?encycl", name, re.I):
                continue
            # one record per document; prefer an /it/ page (Italian or Latin text) over /pt/ etc.
            key = name
            lang_of = href.split("/")[3]
            if key in seen and seen[key]["lang"] == "it":
                continue
            # title and date from the URL slug
            core = re.sub(r"\.html$", "", name)
            core = core.replace("--i-", "-").replace("-i--", "-")
            m = re.search(r"(\d{1,2})-([a-z]+)-(\d{4})", core)
            if not m:
                print("no date in", name, file=sys.stderr)
                continue
            head = core[: m.start()].strip("-")
            head = re.sub(r"^(breve-enciclica|epistola-encyclica|enciclica|encyclica)-+", "", head)
            title = " ".join(w for w in head.split("-") if w and w != "i").capitalize()
            seen[key] = {"title": title, "date": iso(*m.groups()), "printed_date": "",
                         "url": BASE + href, "lang": lang_of}
    return sorted(seen.values(), key=lambda e: e["date"])


def main() -> int:
    entries = []
    for vslug, name, slug, has_index in POPES:
        es = modern(vslug) if has_index else old(vslug)
        for e in es:
            e.update(pope=name, pope_slug=slug, vatican_slug=vslug)
        es.sort(key=lambda e: e["date"])
        print(f"{name}: {len(es)}")
        entries += es
    (VAT / "entries.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print("total", len(entries))
    return 0


if __name__ == "__main__":
    sys.exit(main())
