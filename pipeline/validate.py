"""Validate every work TOML in library/ against library/SCHEMA.md.

Usage: python3 pipeline/validate.py [paths...]   (default: all of library/)
Exit code 1 on any error. Prints one line per problem.
"""
from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from libtoml import LIBRARY, count_words  # noqa: E402

COLLECTIONS = {"bible", "creeds", "apostolic", "ante-nicene", "nicene", "aquinas", "gnostic", "encyclicals"}
REQUIRED = ["id", "title", "author", "collection", "order", "edition", "source_url", "retrieved", "license", "license_basis", "words"]
BLOCK_TYPES = {"h", "p", "q", "v", "bq", "note", "ref"}
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SECTION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
NOTE_REF = re.compile(r"\[\^([A-Za-z0-9_.-]+)\]")
ARTIFACTS = [
    (re.compile(r"[<>]"), "angle bracket (leftover markup)"),
    (re.compile(r"&[a-z]+;|&#\d+;"), "HTML entity"),
    (re.compile(r"[{}\\]"), "brace or backslash"),
    (re.compile(r"\[Pg\.?\s*\d+|\{pg|\bp\.\s*\d+\]"), "page marker"),
    (re.compile(r"�"), "replacement character"),
    (re.compile(r"\s{3,}"), "run of whitespace"),
]


def check_file(path: Path, ids: dict[str, Path]) -> list[str]:
    errs: list[str] = []
    rel = path.relative_to(LIBRARY.parent) if path.is_relative_to(LIBRARY.parent) else path
    try:
        with open(path, "rb") as f:
            doc = tomllib.load(f)
    except Exception as e:  # noqa: BLE001
        return [f"{rel}: TOML parse error: {e}"]
    w = doc.get("work")
    if not isinstance(w, dict):
        return [f"{rel}: missing [work]"]
    for k in REQUIRED:
        if k not in w or w[k] in ("", None):
            errs.append(f"{rel}: work.{k} missing")
    if w.get("license") != "Public domain":
        errs.append(f"{rel}: license must be 'Public domain', got {w.get('license')!r}")
    if w.get("collection") not in COLLECTIONS:
        errs.append(f"{rel}: unknown collection {w.get('collection')!r}")
    wid = w.get("id", "")
    if not SLUG.match(str(wid)):
        errs.append(f"{rel}: work.id {wid!r} is not a slug")
    if wid in ids:
        errs.append(f"{rel}: duplicate work.id {wid!r} (also {ids[wid]})")
    ids[wid] = rel
    sections = doc.get("section", [])
    if not sections:
        errs.append(f"{rel}: no sections")
    seen: set[str] = set()
    prev_level = 0
    for i, s in enumerate(sections):
        sid = s.get("id", "")
        where = f"{rel} section {sid or i}"
        if not SECTION_ID.match(str(sid)):
            errs.append(f"{where}: bad id")
        if sid in seen:
            errs.append(f"{where}: duplicate id")
        seen.add(sid)
        lvl = s.get("level", 0)
        if lvl not in (1, 2, 3, 4):
            errs.append(f"{where}: level {lvl} out of range")
        elif lvl > prev_level + 1:
            errs.append(f"{where}: level jumps from {prev_level} to {lvl}")
        prev_level = lvl if lvl in (1, 2, 3, 4) else prev_level
        if not s.get("title"):
            errs.append(f"{where}: empty title")
        blocks = s.get("blocks", [])
        if not blocks:
            errs.append(f"{where}: no blocks")
        notes = {b.get("id") for b in blocks if b.get("t") == "note"}
        refs: set[str] = set()
        for b in blocks:
            t = b.get("t")
            if t not in BLOCK_TYPES:
                errs.append(f"{where}: unknown block type {t!r}")
                continue
            text = b.get("text", "")
            if not isinstance(text, str) or not text.strip():
                errs.append(f"{where}: empty {t} block")
                continue
            if text != text.strip():
                errs.append(f"{where}: untrimmed {t} text: {text[:50]!r}")
            for rx, label in ARTIFACTS:
                if rx.search(text):
                    errs.append(f"{where}: {label} in {t}: {text[:80]!r}")
                    break
            if t == "v" and not isinstance(b.get("n"), int):
                errs.append(f"{where}: verse without integer n")
            if t != "note":
                refs.update(NOTE_REF.findall(text))
        for r in sorted(refs - notes):
            errs.append(f"{where}: footnote [^{r}] has no note")
        for n in sorted(x for x in notes - refs if x):
            errs.append(f"{where}: note {n} never referenced")
    if sections and w.get("words") != count_words(sections):
        errs.append(f"{rel}: words {w.get('words')} != recount {count_words(sections)}")
    return errs


def main(argv: list[str]) -> int:
    paths = [Path(a) for a in argv] or sorted(LIBRARY.rglob("*.toml"))
    paths = [p for p in paths if p.parent.name not in ("catalog", "media")]
    ids: dict[str, Path] = {}
    errs: list[str] = []
    for p in paths:
        errs.extend(check_file(p.resolve(), ids))
    for e in errs:
        print(e)
    print(f"validate: {len(paths)} files, {len(errs)} problems", file=sys.stderr)
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
