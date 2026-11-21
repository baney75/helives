"""Turn a CCEL ThML book into library sections, one per div, using pipeline/ccel/thml.py.

Each div becomes a section (level = nesting depth below the chosen root, capped at 4) holding the
blocks that sit directly in it; child divs follow as their own sections. A leading heading that only
repeats the section title is dropped. A div with no text of its own keeps its title as an h block.
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.append(str(HERE.parent / "ccel"))
import thml  # noqa: E402  (pipeline/ccel/thml.py)
from schaff import load  # noqa: E402,F401  (generic ThML loader for files in cache/extra3)

sys.path.insert(0, str(HERE.parent))
from libtoml import slugify  # noqa: E402


def norm(s: str) -> str:
    s = re.sub(r"\[\^[^\]]+\]", "", s).replace("*", "")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def div_blocks(v, el) -> list:
    blocks: list = []
    thml.blocks_of(v, el, blocks)
    return blocks


def walk(v, el, depth: int, out: list, skip=lambda el: False, title_of=None, max_level: int = 4):
    for c in el:
        if not thml.is_div(c) or skip(c):
            continue
        title = (title_of or thml.div_title)(c)
        blocks = div_blocks(v, c)
        # drop leading headings that repeat the title
        while blocks and blocks[0]["t"] == "h" and "[^" not in blocks[0]["text"] and (
                norm(blocks[0]["text"]) in norm(title) or norm(title) in norm(blocks[0]["text"])):
            blocks.pop(0)
        out.append({"title": title, "level": min(depth, max_level), "blocks": blocks, "_id": c.get("id")})
        walk(v, c, depth + 1, out, skip, title_of, max_level)
    return out


def finalize(secs: list, prefix_parent: bool = True) -> list:
    """Assign unique slug ids; fill empty sections with their title; keep note ids unique per section."""
    seen: set[str] = set()
    for s in secs:
        s.pop("_id", None)
        base = slugify(re.sub(r"['’]", "", s["title"]))[:60].strip("-") or "section"
        sid, k = base, 2
        while sid in seen:
            sid, k = f"{base}-{k}", k + 1
        seen.add(sid)
        s["id"] = sid
        if not any(b["t"] != "note" for b in s["blocks"]):
            s["blocks"] = [{"t": "h", "text": s["title"]}] + s["blocks"]
        dedupe_notes(s)
    return secs


def dedupe_notes(s: dict):
    ids: dict[str, int] = {}
    out = []
    pending: dict[str, list] = {}
    for b in s["blocks"]:
        if b["t"] == "note":
            n = ids.get(b["id"], 0)
            ids[b["id"]] = n + 1
            if n:
                new = f"{b['id']}-{n + 1}"
                pending.setdefault(b["id"], []).append(new)
                b = dict(b, id=new)
        out.append(b)
    if pending:
        # duplicate ids: renumber references in order of appearance
        counts: dict[str, int] = {}
        for b in out:
            if b["t"] == "note":
                continue

            def rep(m):
                i = m.group(1)
                c = counts.get(i, 0)
                counts[i] = c + 1
                return f"[^{i}]" if c == 0 else f"[^{i}-{c + 1}]"

            b["text"] = re.sub(r"\[\^([^\]]+)\]", rep, b["text"])
    s["blocks"] = out
