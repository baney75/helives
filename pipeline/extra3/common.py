"""Shared helpers for extra3 ingests (jewish, reformation collections)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from libtoml import LIBRARY, words_in  # noqa: E402

FORBID = {"<": "‹", ">": "›", "{": "(", "}": ")", "\\": "/", "�": ""}


def fix_chars(s: str) -> str:
    for a, b in FORBID.items():
        s = s.replace(a, b)
    s = s.replace("­", "")
    # a citation such as "p. 666]" trips the validator's page-marker lint; the CCEL ingest
    # (pipeline/ccel/thml.py fix_page_marker) uses the same spacing fix
    s = re.sub(r"(\bp\.\s*\d+)\]", r"\1 ]", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def resolve_notes(text: str, notes: dict, used: list, nid_of) -> str:
    """Replace \x00target\x00 markers with [^id]; append note blocks to `used` once each."""
    def rep(m):
        tgt = m.group(1)
        if tgt not in notes:
            raise KeyError(f"note target {tgt} has no footnote text")
        nid = nid_of(tgt)
        if nid not in [u["id"] for u in used]:
            used.append({"t": "note", "id": nid, "text": notes[tgt]})
        return f"[^{nid}]"

    text = re.sub(r"\s*\x00([^\x00]+)\x00", rep, text)
    return text


def section_words(blocks: list) -> int:
    return sum(words_in(b["text"]) for b in blocks if b["t"] != "note")


def chunk_numbered(blocks: list, target: int = 3500) -> list[list]:
    """Split a list of p/note blocks into chunks of about `target` words, breaking only before a
    paragraph that starts with a section number ("12. ..."). Notes stay with their paragraph."""
    chunks: list[list] = [[]]
    count = 0
    for b in blocks:
        if b["t"] == "p" and re.match(r"^\d+\. ", b["text"]) and count >= target:
            chunks.append([])
            count = 0
        chunks[-1].append(b)
        if b["t"] != "note":
            count += words_in(b["text"])
    if len(chunks) > 1 and section_words(chunks[-1]) < target / 3:
        tail = chunks.pop()
        chunks[-1].extend(tail)
    return chunks


def order_notes(blocks: list) -> list:
    """Place each note block right after the first block that references it (render order)."""
    notes = {b["id"]: b for b in blocks if b["t"] == "note"}
    out, placed = [], set()
    for b in blocks:
        if b["t"] == "note":
            continue
        out.append(b)
        for nid in re.findall(r"\[\^([A-Za-z0-9_.-]+)\]", b["text"]):
            if nid in notes and nid not in placed:
                out.append(notes[nid])
                placed.add(nid)
    return out


def section_range(blocks: list) -> tuple[str, str]:
    nums = [re.match(r"^(\d+)\. ", b["text"]).group(1) for b in blocks
            if b["t"] == "p" and re.match(r"^\d+\. ", b["text"])]
    return (nums[0], nums[-1]) if nums else ("", "")
