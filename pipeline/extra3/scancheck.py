"""Word-level comparison of an electronic text with the OCR of printed scans (stdlib only).

A sentence of the electronic text is located in an OCR stream by its first 6-word run that occurs
exactly once there, then aligned word by word with difflib. Words are compared lowercased, with
apostrophes and punctuation dropped; OCR line-end hyphens are joined first.

Used by ingest_philo.py (full correction against two Bohn scans), the Anselm check and the
Westminster Larger Catechism proofread. Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import collections
import difflib
import re
from pathlib import Path

WORD = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")


def norm(w: str) -> str:
    return w.lower().replace("'", "").replace("’", "")


def tokens(text: str) -> list[tuple[str, int, int]]:
    """(normalized word, start, end) for each word of an electronic text."""
    return [(norm(m.group()), m.start(), m.end()) for m in WORD.finditer(text)]


def ocr_words(text: str) -> list[str]:
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    return [norm(m.group()) for m in WORD.finditer(text)]


class Scan:
    """One OCR stream with a unique-6-gram index."""

    def __init__(self, paths: list[Path], n: int = 6):
        self.n = n
        self.words: list[str] = []
        for p in paths:
            self.words += ocr_words(p.read_text(errors="replace"))
        cnt = collections.Counter(tuple(self.words[k:k + n]) for k in range(len(self.words) - n))
        self.idx = {tuple(self.words[k:k + n]): k for k in range(len(self.words) - n)
                    if cnt[tuple(self.words[k:k + n])] == 1}

    def locate(self, w: list[str]) -> int | None:
        for k in range(len(w) - self.n + 1):
            hit = self.idx.get(tuple(w[k:k + self.n]))
            if hit is not None:
                return hit - k
        return None

    def align(self, w: list[str]):
        """Opcodes aligning words w with the scan, or None when no anchor is found.
        Returns (ops, seg): ops are difflib opcodes over (w, seg)."""
        pos = self.locate(w)
        if pos is None:
            return None
        seg = self.words[max(0, pos):pos + len(w) + 12]
        sm = difflib.SequenceMatcher(None, w, seg, autojunk=False)
        ops = sm.get_opcodes()
        # the window runs past the sentence: drop a trailing insert
        if ops and ops[-1][0] == "insert" and ops[-1][2] == len(w):
            ops = ops[:-1]
        return ops, seg


def sentences(text: str) -> list[tuple[int, int]]:
    """Spans of sentences (at least 8 words) in a block of text."""
    out, start = [], 0
    for m in re.finditer(r"(?<=[.;?!:])[\"'’”)\]]*\s+", text + " "):
        out.append((start, m.start()))
        start = m.end()
    if start < len(text):
        out.append((start, len(text)))
    return [(a, b) for a, b in out if len(WORD.findall(text[a:b])) >= 8]


def load_words(path: Path) -> set[str]:
    return {norm(w) for w in path.read_text(errors="replace").split()}


def match_rate(text_words: list[str], ops) -> tuple[int, int]:
    eq = sum(b - a for t, a, b, c, e in ops if t == "equal")
    return eq, len(text_words)
