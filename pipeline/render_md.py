"""Render each work TOML to a Markdown file beside it.

Usage: python3 pipeline/render_md.py [paths...]   (default: all of library/)
The Markdown is generated; never edit it by hand. Front matter is YAML so GitHub shows it as a table.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from libtoml import LIBRARY, load_work  # noqa: E402

NOTE_REF = re.compile(r"\[\^([A-Za-z0-9_.-]+)\]")
FRONT = ["title", "author", "date", "language", "translator", "edition", "source_url", "license", "license_basis", "words"]


def yaml_scalar(v) -> str:
    if isinstance(v, int):
        return str(v)
    s = str(v).replace('"', '\\"')
    return f'"{s}"'


def title_echo(s: dict) -> int:
    """Index of a heading block that only repeats its section's title, or -1.

    A section with no text of its own (a Book or Part) carries its title as its only block so the data
    stays valid; the title is already printed, so that block is skipped.
    """
    for i, b in enumerate(s.get("blocks", [])):
        if b["t"] == "note":
            continue
        return i if b["t"] == "h" and b["text"].strip() == str(s.get("title", "")).strip() else -1
    return -1


def render(doc: dict) -> str:
    w = doc["work"]
    out = ["---"]
    for k in FRONT:
        if w.get(k) not in (None, ""):
            out.append(f"{k}: {yaml_scalar(w[k])}")
    out += ["---", "", f"# {w['title']}", ""]
    if w.get("summary"):
        out += [f"> {w['summary']}", ""]
    for s in doc.get("section", []):
        depth = min(1 + int(s.get("level", 1)), 6)
        out += [f"{'#' * depth} {s['title']}", ""]
        para: list[str] = []
        notes: list[str] = []

        def flush(gap=True):
            if gap and out and out[-1].endswith("  "):
                out.append("")
            if para:
                out.append(" ".join(para))
                out.append("")
                para.clear()

        sid = s["id"]
        echo = title_echo(s)
        for bi, b in enumerate(s["blocks"]):
            if bi == echo:
                continue
            t = b["t"]
            b = dict(b, text=NOTE_REF.sub(lambda m: f"[^{sid}-{m.group(1)}]", b["text"]))
            if t == "v":
                if b.get("p") or b.get("indent"):
                    flush(gap=not b.get("indent"))
                prefix = " " * int(b.get("indent", 0))
                piece = f"{prefix}{b['text']}" if b.get("cont") else f"{prefix}<sup>{b['n']}</sup> {b['text']}"
                if b.get("indent"):
                    flush(gap=False)
                    out.append(piece + "  ")
                else:
                    flush(gap=True) if out and out[-1].endswith("  ") and not para else None
                    para.append(piece)
            elif t == "h":
                flush()
                hd = min(depth + max(1, int(b.get("level", 2)) - 1), 6)
                out += [f"{'#' * hd} {b['text']}", ""]
            elif t == "p":
                flush()
                out += [b["text"], ""]
            elif t == "q":
                flush(gap=False)
                out.append(" " * int(b.get("indent", 0)) + b["text"] + "  ")
            elif t == "bq":
                flush()
                out += [f"> {b['text']}", ""]
            elif t == "ref":
                flush()
                out += [f"*{b['text']}*", ""]
            elif t == "note":
                notes.append(f"[^{sid}-{b['id']}]: {b['text']}")
        flush()
        if out and out[-1].endswith("  "):
            out.append("")
        if notes:
            out += notes + [""]
    md = "\n".join(out)
    return md.rstrip() + "\n"


def main(argv: list[str]) -> int:
    paths = []
    for a in argv or [str(LIBRARY)]:
        pa = Path(a)
        paths += sorted(pa.rglob("*.toml")) if pa.is_dir() else [pa]
    n = 0
    for p in paths:
        if p.parent.name in ("catalog", "media"):
            continue
        doc = load_work(p)
        p.with_suffix(".md").write_text(render(doc), encoding="utf-8")
        n += 1
    print(f"render_md: wrote {n} files", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
