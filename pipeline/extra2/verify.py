"""Check a work's text against the OCR of a page scan of the printed edition.

Usage: python3 -I pipeline/extra2/verify.py <work.toml> <archive.org identifier> [max_run] [--from TEXT] [--to TEXT]
Prints the share of the work's words found in order in the scan's OCR, then every short differing run
(up to max_run words, default 3) with context, so that each one can be judged on the page image.
Only verse and paragraph blocks are compared. --from and --to cut the OCR to the work's pages (first
occurrence of each, searched in order), which keeps the alignment fast in a large volume.
"""
from __future__ import annotations

import difflib
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from align import ocr_tokens, words_with_pos  # noqa: E402
from ia import ocr  # noqa: E402


def work_words(path: Path, kinds=("v", "p")) -> list[str]:
    doc = tomllib.load(open(path, "rb"))
    text = "\n".join(b["text"] for s in doc["section"] for b in s["blocks"] if b["t"] in kinds)
    return [w for w, _ in words_with_pos(text)]


def compare(ours: list[str], raw: str, max_run: int = 3, ctx: int = 4):
    theirs = [n for n, _ in ocr_tokens(raw)]
    sm = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
    matched = sum(b.size for b in sm.get_matching_blocks())
    diffs = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal" or max(i2 - i1, j2 - j1) > max_run:
            continue
        diffs.append((i1, " ".join(ours[max(0, i1 - ctx):i1]), " ".join(ours[i1:i2]), " ".join(theirs[j1:j2]),
                      " ".join(ours[i2:i2 + ctx])))
    return matched, len(ours), diffs


def region(raw: str, start: str | None, end: str | None) -> str:
    i = raw.find(start) if start else 0
    if i < 0:
        raise SystemExit(f"--from text not found: {start!r}")
    j = raw.find(end, i) if end else len(raw)
    if j < 0:
        raise SystemExit(f"--to text not found: {end!r}")
    return raw[i:j + len(end or "")]


def main(argv: list[str]) -> int:
    opts = {}
    rest = []
    k = 0
    while k < len(argv):
        if argv[k] in ("--from", "--to"):
            opts[argv[k]] = argv[k + 1]
            k += 2
        else:
            rest.append(argv[k])
            k += 1
    path, ident = Path(rest[0]), rest[1]
    max_run = int(rest[2]) if len(rest) > 2 else 3
    ours = work_words(path)
    raw = region(ocr(ident), opts.get("--from"), opts.get("--to"))
    matched, n, diffs = compare(ours, raw, max_run)
    print(f"{path.stem}: work words {n}, matched in order {matched} ({matched / n:.2%}) against {ident}")
    for i, before, a, b, after in diffs:
        print(f"@{i} {before} [{a} | {b}] {after}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
