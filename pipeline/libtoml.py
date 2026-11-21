"""Shared helpers for the library pipeline: TOML writing, word counts, slugs.

Standard library only (Python 3.11+ for tomllib). Every ingest script writes work files with
`write_work`, so the output format stays identical across collections.
"""
from __future__ import annotations

import hashlib
import re
import tomllib
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY = ROOT / "library"

WORK_FIELD_ORDER = [
    "id", "title", "short_title", "author", "collection", "order", "date", "language",
    "translator", "edition", "source_url", "source_sha256", "retrieved", "license",
    "license_basis", "testament", "book_number", "chapters", "verses", "words", "summary",
]
BLOCK_FIELD_ORDER = ["t", "n", "id", "level", "indent", "p", "text"]


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def toml_str(s: str) -> str:
    out = ['"']
    for ch in s:
        o = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ch == "\n":
            out.append("\\n")
        elif ch == "\t":
            out.append("\\t")
        elif o < 0x20 or o == 0x7F:
            out.append(f"\\u{o:04X}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def toml_value(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str):
        return toml_str(v)
    if isinstance(v, list):
        return "[" + ", ".join(toml_value(x) for x in v) + "]"
    if isinstance(v, dict):
        return inline_table(v)
    raise TypeError(f"unsupported TOML value {type(v)}")


def _ordered(d: dict, order: list[str]):
    keys = [k for k in order if k in d] + sorted(k for k in d if k not in order)
    return [(k, d[k]) for k in keys if d[k] is not None and d[k] != ""]


def inline_table(d: dict) -> str:
    return "{ " + ", ".join(f"{k} = {toml_value(v)}" for k, v in _ordered(d, BLOCK_FIELD_ORDER)) + " }"


INLINE_OK = re.compile(r"\*\*[^*]+\*\*|\*[^*]+\*|\[\^[A-Za-z0-9_.-]+\]")


def words_in(text: str) -> int:
    text = re.sub(r"\[\^[^\]]+\]", " ", text).replace("*", "")
    return len(re.findall(r"[\wͰ-Ͽ֐-׿'’-]+", text))


def count_words(sections: list[dict]) -> int:
    return sum(
        words_in(b["text"]) for s in sections for b in s["blocks"] if b["t"] in ("p", "q", "v", "bq", "h")
    )


def dump_work(work: dict, sections: list[dict]) -> str:
    work = dict(work)
    work["words"] = count_words(sections)
    lines = ["[work]"]
    for k, v in _ordered(work, WORK_FIELD_ORDER):
        lines.append(f"{k} = {toml_value(v)}")
    for s in sections:
        lines.append("")
        lines.append("[[section]]")
        lines.append(f"id = {toml_str(s['id'])}")
        lines.append(f"title = {toml_str(s['title'])}")
        lines.append(f"level = {int(s.get('level', 1))}")
        lines.append("blocks = [")
        for b in s["blocks"]:
            lines.append("  " + inline_table(b) + ",")
        lines.append("]")
    return "\n".join(lines) + "\n"


def write_work(path: Path, work: dict, sections: list[dict]) -> Path:
    """Write a work TOML and confirm it round-trips through tomllib."""
    text = dump_work(work, sections)
    back = tomllib.loads(text)
    assert back["work"]["id"] == work["id"], "round-trip mismatch"
    assert len(back.get("section", [])) == len(sections), "section count mismatch"
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".toml.tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)
    return path


def load_work(path: Path) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)
