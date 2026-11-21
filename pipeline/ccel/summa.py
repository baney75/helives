"""Ingest the CCEL Summa Theologica (Fathers of the English Dominican Province) into library/aquinas/.

One work per part: summa-prima-pars (FP), summa-prima-secundae (FS), summa-secunda-secundae (SS),
summa-tertia-pars (TP), summa-supplementum (XP plus the two appendices on Purgatory).
Sections: Treatise = level 1, Question = level 2, Article = level 3.
The translators' bracketed notes "[*...]" become note blocks; "---" (the transcription's dash) becomes an em dash.

Usage: python3 -I pipeline/ccel/summa.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from libtoml import LIBRARY, slugify, words_in, write_work  # noqa: E402
from thml import CACHE, blocks_of, is_div, load  # noqa: E402

NAME = "summa"
EDITION = "Summa Theologica, Benziger Bros. edition (1947), translated by Fathers of the English Dominican Province"
TRANSLATOR = "Fathers of the English Dominican Province"
BASIS = ("English Dominican translation, first published 1911 to 1925; CCEL text from the Benziger Bros. "
         "1947 edition, marked Public Domain in its ThML header; ThML edition from the Christian Classics Ethereal Library")

PARTS = [
    ("FP", "summa-prima-pars", "Summa Theologica: First Part (Prima Pars)", "Summa: Prima Pars", []),
    ("FS", "summa-prima-secundae", "Summa Theologica: First Part of the Second Part (Prima Secundae)", "Summa: Prima Secundae", []),
    ("SS", "summa-secunda-secundae", "Summa Theologica: Second Part of the Second Part (Secunda Secundae)", "Summa: Secunda Secundae", []),
    ("TP", "summa-tertia-pars", "Summa Theologica: Third Part (Tertia Pars)", "Summa: Tertia Pars", []),
    ("XP", "summa-supplementum", "Summa Theologica: Supplement to the Third Part (Supplementum)", "Summa: Supplementum", ["vii.i", "vii.ii"]),
]
# XP.ii has no heading of its own in the source: it carries on the Third Part's treatise on the sacraments
TREATISE_TITLE = {"XP.ii": "Treatise on the Sacraments, Continued",
                  # source: "TREATISE ON HABITS IN PARTICULAR (QQ[55]-89) GOOD HABITS, i.e. VIRTUES (QQ[55]-70)"
                  "FS.v": "Treatise on Habits in Particular: Good Habits, i.e. Virtues"}

SMALL = {"a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with", "its", "his", "her", "their", "i.e."}
Q_RX = re.compile(r"^\s*Question\.?\s*(\d+)\s*-\s*(.*)$", re.I)
A_RX = re.compile(r"^\s*Article\.?\s*(\d+)\s*-\s*(.*)$", re.I)


def title_case(s: str, force: bool = False) -> str:
    s = " ".join(s.split())
    if not force and sum(c.isupper() for c in s) < sum(c.islower() for c in s):
        return s  # already mixed case: keep the source's casing
    out = []
    for i, w in enumerate(s.lower().split()):
        if i and w in SMALL:
            out.append(w)
        else:
            out.append(re.sub(r"^([^a-z]*)([a-z])", lambda m: m.group(1) + m.group(2).upper(), w))
    return " ".join(out)


def treatise_name(el) -> str:
    if el.get("id") in TREATISE_TITLE:
        return TREATISE_TITLE[el.get("id")]
    t = el.get("title") or ""
    t = re.sub(r"\(?\s*QQ?\s*\[?[\d\s\-\]\[]+\)?", " ", t)  # drop the source's question ranges; recomputed below
    t = re.sub(r"\s+", " ", t).strip(" :-")
    return title_case(t, force=True)


def q_numbers(el) -> list[int]:
    out = []
    for d in el.iter():
        if is_div(d):
            m = re.match(r"^[A-Z0-9]+_Q(\d+)$", d.get("id") or "")
            if m:
                out.append(int(m.group(1)))
    return out


def dashes(s: str) -> str:
    return s.replace("---", "—").replace(" -- ", " — ")


def lift_notes(blocks: list) -> list:
    """Turn inline "[*...]" translator notes into [^n] markers followed by note blocks."""
    out = []
    n = 0
    for b in blocks:
        if b["t"] == "note" or "[*" not in b["text"]:
            out.append(b)
            continue
        text = b["text"]
        res, notes, i = [], [], 0
        while i < len(text):
            j = text.find("[*", i)
            if j < 0:
                res.append(text[i:])
                break
            res.append(text[i:j])
            depth, k = 0, j
            while k < len(text):
                if text[k] == "[":
                    depth += 1
                elif text[k] == "]":
                    depth -= 1
                    if depth == 0:
                        break
                k += 1
            body = text[j + 2:k].strip()
            if body:
                n += 1
                nid = f"n{n}"
                res.append(f"[^{nid}]")
                notes.append({"t": "note", "id": nid, "text": body})
            i = k + 1
        new = re.sub(r"\s+(\[\^n\d+\])", r"\1", "".join(res)).strip()
        out.append(dict(b, text=new or "-"))
        out.extend(notes)
    return out


def clean_blocks(blocks: list, *titles: str) -> list:
    keys = {re.sub(r"[^a-z0-9]", "", t.lower()) for t in titles if t}
    out = []
    for b in blocks:
        b = dict(b, text=dashes(b["text"]).strip())
        if not b["text"]:
            continue
        if b["t"] == "h" and not out:
            k = re.sub(r"[^a-z0-9]", "", b["text"].lower())
            k2 = re.sub(r"\(.*?\)|qq?\d.*$", "", b["text"].lower())
            k2 = re.sub(r"[^a-z0-9]", "", k2)
            if any(k and (k in t or t in k) for t in keys) or any(k2 and (k2 in t or t in k2) for t in keys):
                continue
        out.append(b)
    return lift_notes(out)


def own_blocks(v, el) -> list:
    b: list = []
    blocks_of(v, el, b)
    return b


class Part:
    def __init__(self, v):
        self.v = v
        self.sections: list = []
        self.ids: set = set()

    def add(self, sid: str, title: str, level: int, blocks: list):
        base, k = sid, 1
        while sid in self.ids:
            k += 1
            sid = f"{base}-{k}"
        self.ids.add(sid)
        self.sections.append({"id": sid, "title": title, "level": level, "blocks": blocks})

    def article(self, el, qn: int, prefix: str):
        m = A_RX.match(el.get("title") or "")
        an = int(m.group(1)) if m else len(self.sections)
        t = f"Article {an}. {' '.join(m.group(2).split())}" if m else " ".join((el.get("title") or "").split())
        blocks = clean_blocks(own_blocks(self.v, el), t, m.group(2) if m else "")
        self.add(f"{prefix}q{qn}-a{an}", t, 3, blocks or [{"t": "h", "text": t}])

    def question(self, el, prefix: str):
        m = Q_RX.match(el.get("title") or "")
        qid = re.match(r"^[A-Z0-9]+_Q(\d+)$", el.get("id") or "")
        qn = int(qid.group(1)) if qid else 0
        if m and not m.group(2).upper().startswith("SUPPLEMENT"):
            name = title_case(m.group(2))
        else:
            # the source's heading inside the div names the question when the title attribute does not
            hb = [b for b in own_blocks(self.v, el) if b["t"] == "h"]
            name = title_case(hb[0]["text"]) if hb else title_case(el.get("title") or "")
        t = f"Question {qn}. {name}" if qn else name
        blocks = clean_blocks(own_blocks(self.v, el), t, name, m.group(2) if m else "")
        self.add(f"{prefix}q{qn}", t, 2, blocks or [{"t": "h", "text": t}])
        for a in el:
            if is_div(a):
                self.article(a, qn, prefix)

    def treatise(self, el, prefix: str = ""):
        qs = q_numbers(el)
        name = treatise_name(el)
        if qs:
            rng = f"Q. {qs[0]}" if len(set(qs)) == 1 else f"QQ. {min(qs)}-{max(qs)}"
            title = f"{name} ({rng})"
        else:
            title = name
        lead = clean_blocks(own_blocks(self.v, el), title, name, el.get("title") or "")
        kids = [k for k in el if is_div(k)]
        if not lead:
            # a treatise in the source is only a heading over its questions: keep that heading as the section text
            lead = [{"t": "h", "text": title}]
        self.add(prefix + slugify(name)[:60].strip("-"), title, 1, lead)
        for k in kids:
            if re.match(r"^[A-Z0-9]+_Q\d+$", k.get("id") or ""):
                self.question(k, prefix)
            else:
                # a prologue inside a treatise (FS.i.i)
                t = title_case(" ".join((k.get("title") or "").split()))
                self.add(slugify(t), t, 2, clean_blocks(own_blocks(self.v, k), t) or [{"t": "h", "text": t}])

    def lead_div(self, el):
        """A part-level div that is not a treatise (Third Part prologue, Supplement editor's note)."""
        t = title_case(" ".join((el.get("title") or "").split()).rstrip(":"))
        self.add(slugify(t), t, 1, clean_blocks(own_blocks(self.v, el), t))


def build_part(v, pid: str, extra: list) -> list:
    p = Part(v)
    for el in v.by_id[pid]:
        if not is_div(el):
            continue
        if q_numbers(el):
            p.treatise(el)
        else:
            p.lead_div(el)
    for eid in extra:
        el = v.by_id[eid]
        t = " ".join((el.get("title") or "").split())
        prefix = slugify(t) + "-"
        lead = clean_blocks(own_blocks(v, el), t)
        p.add(slugify(t), t, 1, lead or [{"t": "h", "text": t}])
        for q in el:
            if is_div(q):
                p.question(q, prefix)
    return p.sections


def fix_note_ids(sections: list):
    for s in sections:
        # lift_notes numbers notes n1, n2, ... per section; renumber them 1, 2, ... in marker order
        count = 0
        mapping = []
        new = []
        for b in s["blocks"]:
            if b["t"] != "note":
                refs = re.findall(r"\[\^([^\]]+)\]", b["text"])
                ren = {}
                for r in refs:
                    count += 1
                    ren[r] = str(count)
                b = dict(b, text=re.sub(r"\[\^([^\]]+)\]", lambda m: f"[^{ren[m.group(1)]}]", b["text"]))
                mapping = ren
                new.append(b)
            else:
                new.append(dict(b, id=mapping.get(b["id"], b["id"])))
        s["blocks"] = new


def main() -> int:
    v = load(NAME)
    src = CACHE / f"{NAME}.xml"
    sha = hashlib.sha256(src.read_bytes()).hexdigest()
    meta = dict(line.split("=", 1) for line in (CACHE / f"{NAME}.meta").read_text().split("\n") if "=" in line)
    used = []
    for order, (pid, slug, title, short, extra) in enumerate(PARTS, 1):
        secs = build_part(v, pid, extra)
        fix_note_ids(secs)
        work = {
            "id": f"thomas-aquinas-{slug}",
            "title": title,
            "short_title": short,
            "author": "thomas-aquinas",
            "collection": "aquinas",
            "order": order * 10,
            "language": "Latin",
            "translator": TRANSLATOR,
            "edition": EDITION,
            "source_url": meta.get("url", "https://www.ccel.org/ccel/aquinas/summa.xml"),
            "source_sha256": sha,
            "retrieved": meta.get("retrieved", ""),
            "license": "Public domain",
            "license_basis": BASIS,
        }
        path = LIBRARY / "aquinas" / f"{slug}.toml"
        write_work(path, work, secs)
        words = sum(words_in(b["text"]) for s in secs for b in s["blocks"] if b["t"] != "note")
        print(f"{path.relative_to(LIBRARY)}: {len(secs)} sections, {words:,} words")
        used.append({"path": str(path.relative_to(LIBRARY)), "divs": [pid] + extra})
    rep = {"volume": NAME, "works": used, "skips": [{"div": "i", "reason": "title page"}],
           "used": sorted({d.get("id") for pid, *_r, extra in PARTS for root in [pid] + extra
                           for d in v.by_id[root].iter() if is_div(d) and d.get("id")}),
           "unsplit": []}
    (CACHE / f"used-{NAME}.json").write_text(json.dumps(rep, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
