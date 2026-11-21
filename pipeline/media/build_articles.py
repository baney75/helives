"""Verify curated articles and write media/articles.toml.

Each URL must return HTTP 200 on its own host and its <title> must contain
the expected text. Title and author are read from the page.
Run: python3 pipeline/media/build_articles.py
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CACHE, MEDIA, fetch, write_toml  # noqa: E402
from articles_data import ARTICLES  # noqa: E402

# CMS placeholders that are not real bylines; the publisher stands in for them.
BAD_AUTHORS = {"CMS Admin", "Blago Archives", "Editors", "Various"}

PUBLISHERS = {
    "www.newadvent.org": "New Advent (Catholic Encyclopedia, 1907 to 1912)",
    "plato.stanford.edu": "Stanford Encyclopedia of Philosophy",
    "ccel.org": "Christian Classics Ethereal Library",
    "www.ccel.org": "Christian Classics Ethereal Library",
    "learn.ligonier.org": "Ligonier Ministries",
    "www.thegospelcoalition.org": "The Gospel Coalition",
    "www.desiringgod.org": "Desiring God",
    "www.christianitytoday.com": "Christianity Today",
}


def page_title(body: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(m.group(1))).strip() if m else ""


def ccel_section(body: str) -> tuple[str, str]:
    """Section name and number from a CCEL Schaff page (the <title> holds only the volume)."""
    m = re.search(r'<p class="head"[^>]*>(.*?)</p>', body, re.S)
    head = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip() if m else ""
    n = re.match(r"\u00a7\s*(\d+)\.?\s*(.*)", head)
    if n:
        return n.group(2).rstrip(". "), n.group(1)
    m = re.search(r'class="book_navbar_title">(.*?)</td>', body, re.S)
    return (html.unescape(m.group(1)).strip() if m else head), ""


def match_text(url: str, body: str) -> str:
    """The text the expected title is checked against: <title>, plus the CCEL section name."""
    t = page_title(body)
    if urlparse(url).netloc.endswith("ccel.org"):
        t += " | " + ccel_section(body)[0]
    return t


def clean_title(host: str, raw: str, body: str) -> str:
    t = raw
    if host == "www.newadvent.org":
        t = re.sub(r"^CATHOLIC ENCYCLOPEDIA:\s*", "", t, flags=re.I)
    elif host == "plato.stanford.edu":
        t = re.sub(r"\s*\(Stanford Encyclopedia of Philosophy\)\s*$", "", t)
    elif host.endswith("ccel.org"):
        name, num = ccel_section(body)
        vol = re.search(r"Volume ([IVX]+)", raw)
        t = f"{name} (History of the Christian Church, vol. {vol.group(1) if vol else '?'}" + (f", \u00a7 {num})" if num else ")")
    elif host == "learn.ligonier.org":
        t = re.sub(r"\s+by\s+[^|]+$", "", t)
    t = re.sub(r"\s*[|–—-]\s*(The Gospel Coalition|Desiring God|Christianity Today|Ligonier Ministries)\s*$", "", t)
    return t.strip()


def author_of(host: str, raw: str, body: str, url: str = "") -> str:
    if host == "www.newadvent.org":
        m = re.search(r'<span id="apaauthor">(.*?)</span>', body, re.S)
        if m and m.group(1).strip():
            raw_names = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
            names = [n.strip() for n in re.split(r"\s*(?:&|, and | and )\s*", raw_names) if n.strip()]
            out = []
            for n in names:
                parts = [p.strip() for p in n.split(",", 1)]
                out.append(f"{parts[1]} {parts[0]}" if len(parts) == 2 and parts[1] else parts[0])
            return ", ".join(out)
    if host.endswith("ccel.org") and "/ccel/schaff/hcc" in url:
        return "Philip Schaff"
    if host == "www.thegospelcoalition.org":
        m = re.search(r"class='fn'>([^<]+)<", body)
        if m:
            return html.unescape(m.group(1)).strip()
        flat = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "|", body))
        m = re.search(r"\|\s*By ([A-Z][^|]{2,60}?)\s*\|", flat)
        if m:
            return html.unescape(m.group(1)).strip()
    if host == "learn.ligonier.org":
        m = re.search(r"\s+by\s+([^|]+)$", raw)
        if m:
            return m.group(1).strip()
    metas = re.findall(r'<meta[^>]+name="(?:citation_author|DC\.creator|author)"[^>]+content="([^"]+)"', body, re.I)
    metas += re.findall(r'<meta[^>]+content="([^"]+)"[^>]+name="(?:citation_author|DC\.creator|author)"', body, re.I)
    if metas:
        seen = []
        for a in metas:
            a = html.unescape(a).strip()
            if "," in a and host == "plato.stanford.edu":
                last, first = [x.strip() for x in a.split(",", 1)]
                a = f"{first} {last}"
            if a and a not in seen:
                seen.append(a)
        return ", ".join(seen)
    m = re.search(r'"author"\s*:\s*(?:\[\s*)?\{[^}]*?"name"\s*:\s*"([^"]+)"', body)
    if m:
        return m.group(1)
    return ""


def main() -> int:
    rows, rejected, seen = [], [], set()
    for url, expect, tags, desc in ARTICLES:
        if url in seen:
            rejected.append({"url": url, "why": "duplicate"})
            continue
        seen.add(url)
        host = urlparse(url).netloc
        status, body, final = fetch(url, cache=True, gap=1.0)
        text = body.decode("utf-8", "replace") if status == 200 else ""
        if "newadvent" in host and "�" in text:
            text = body.decode("latin-1")
        raw = page_title(text)
        check = match_text(url, text)
        if status != 200:
            rejected.append({"url": url, "why": f"HTTP {status}"})
            continue
        if urlparse(final).netloc not in (host, ""):
            rejected.append({"url": url, "why": f"redirected off host to {final}"})
            continue
        if expect.lower() not in check.lower():
            rejected.append({"url": url, "why": f"title mismatch: {check!r} lacks {expect!r}"})
            continue
        title = clean_title(host, raw, text)
        author = re.sub(r"\s+", " ", author_of(host, raw, text, url)).strip()
        if not author or author in BAD_AUTHORS:
            author = PUBLISHERS.get(host, host)
        rows.append({"title": title, "publisher": PUBLISHERS.get(host, host), "author": author,
                     "url": url, "expect": expect, "tags": tags, "description": desc})
    header = ("# Curated articles for the He Lives library.\n"
              "# Generated by pipeline/media/build_articles.py. Each URL returned HTTP 200 with the\n"
              "# `expect` text in its page title when this file was written; verify.py re-checks both.")
    write_toml(MEDIA / "articles.toml", header, "article", rows,
               ["title", "publisher", "author", "url", "expect", "tags", "description"])
    (CACHE / "rejected_articles.json").write_text(json.dumps(rejected, indent=1))
    print(f"articles written: {len(rows)}  rejected: {len(rejected)}")
    for r in rejected:
        print("  rejected", r["url"], r["why"])
    by = {}
    for r in rows:
        by[r["publisher"]] = by.get(r["publisher"], 0) + 1
    for k, v in sorted(by.items(), key=lambda x: -x[1]):
        print(f"  {v:4} {k}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
