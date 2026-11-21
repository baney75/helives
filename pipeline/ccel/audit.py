"""Coverage audit for the CCEL ingest.

For each source volume: words of extracted body text (all non-note blocks of the works built from it)
versus words in the ThML <body> minus footnotes and index matter. Lists every top-level div that
was not ingested, with its size and the reason recorded in volumes.py (or "UNPLANNED").

Usage: python3 -I pipeline/ccel/audit.py [volume ...]
"""
from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from libtoml import LIBRARY, words_in  # noqa: E402
from thml import CACHE, is_div, load  # noqa: E402

INDEX_RX = re.compile(r"^(?:(?:general|subject|scripture|textual)\s+)?index(es)?\b|:\s*index of\b", re.I)


def raw_words(el, skip_ids: set) -> int:
    """Words in el's text, excluding notes and excluded divs."""
    n = 0

    def walk(e):
        nonlocal n
        if e.tag == "note" or e.tag in ("index", "insertIndex", "pb"):
            if e.tail:
                n += words_in(e.tail)
            return
        if is_div(e) and e.get("id") in skip_ids:
            if e.tail:
                n += words_in(e.tail)
            return
        if e.text:
            n += words_in(e.text)
        for c in e:
            walk(c)
        if e.tail and e is not el:
            n += words_in(e.tail)

    walk(el)
    return n


def index_divs(v) -> set:
    out = set()
    for d in v.body.iter():
        if is_div(d) and INDEX_RX.search(d.get("title") or ""):
            out.add(d.get("id"))
    return out


def audit(name: str) -> dict:
    v = load(name)
    used_file = CACHE / f"used-{name}.json"
    rep = json.loads(used_file.read_text()) if used_file.exists() else {"used": [], "works": [], "skips": []}
    # an "Index" div that a planned work includes is text (e.g. the ancient Festal Index in npnf204), not apparatus
    idx = index_divs(v) - set(rep["used"])
    denom = raw_words(v.body, idx)
    got = 0
    for w in rep["works"]:
        with open(LIBRARY / w["path"], "rb") as f:
            doc = tomllib.load(f)
        # the Summa's notes are inline "[*...]" text in the source (no <note> elements), so they count there
        got += sum(words_in(b["text"]) for s in doc["section"] for b in s["blocks"] if b["t"] != "note" or name == "summa")
    used = set(rep["used"])
    reasons = {s["div"]: s["reason"] for s in rep["skips"]}
    dropped = []

    def walk(el):
        for c in el:
            if not is_div(c):
                continue
            cid = c.get("id")
            if cid in idx:
                continue
            if cid in used:
                continue
            # partly used container: descend
            if any(d.get("id") in used for d in c.iter() if is_div(d)):
                own = raw_words_own(c)
                if own > 0:
                    dropped.append((cid, c.get("title"), own, "container text outside planned works"))
                walk(c)
                continue
            w = raw_words(c, idx)
            reason = reasons.get(cid, "UNPLANNED")
            if reason == "UNPLANNED" and re.match(r"^\s*title page", c.get("title") or "", re.I) and w < 80:
                reason = "short title page inside a work or group (skipped by the builder, under 80 words)"
            dropped.append((cid, c.get("title"), w, reason))

    def raw_words_own(c):
        n = 0
        for x in c:
            if not is_div(x) and x.tag != "note":
                n += raw_words(x, idx) + (words_in(x.tail) if x.tail else 0)
        return n

    walk(v.body)
    return {"volume": name, "source_words": denom, "extracted_words": got,
            "coverage": got / denom if denom else 0, "dropped": dropped, "works": len(rep["works"])}


def main(argv):
    names = argv or sorted(p.stem for p in CACHE.glob("*.xml"))
    rows = []
    for n in names:
        r = audit(n)
        rows.append(r)
        print(f"{n:8} works={r['works']:4} source={r['source_words']:9,} extracted={r['extracted_words']:9,} coverage={r['coverage']*100:6.2f}%", flush=True)
        for cid, title, w, reason in r["dropped"]:
            print(f"    dropped {cid} [{w} words] {title!r}: {reason}")
    ts = sum(r["source_words"] for r in rows)
    te = sum(r["extracted_words"] for r in rows)
    print(f"TOTAL source={ts:,} extracted={te:,} coverage={te / ts * 100 if ts else 0:.2f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
