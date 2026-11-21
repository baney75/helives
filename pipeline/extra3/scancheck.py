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


def ocr_words(text: str, caps: list | None = None, raw: list | None = None, seps: list | None = None) -> list[str]:
    """Words of an OCR text. When caps is a list, it receives, per word, whether the scan prints it
    in capitals (running heads are set in capitals); raw receives each word as printed; seps receives
    the text between the previous word and this one (so a mid-line hyphen can be told from a space)."""
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    out = []
    last = 0
    for m in WORD.finditer(text):
        out.append(norm(m.group()))
        if caps is not None:
            caps.append(len(m.group()) > 1 and m.group().isupper())
        if raw is not None:
            raw.append(m.group())
        if seps is not None:
            seps.append(text[last:m.start()])
        last = m.end()
    return out


class Scan:
    """One OCR stream with a unique-6-gram index."""

    def __init__(self, paths: list[Path], n: int = 6):
        self.n = n
        self.words: list[str] = []
        self.caps: list[bool] = []
        self.raw: list[str] = []
        self.seps: list[str] = []
        self.start = 0  # where the segment of the last align() begins
        for p in paths:
            self.words += ocr_words(p.read_text(errors="replace"), self.caps, self.raw, self.seps)
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
        # Align from the anchor's implied start. If the scan has a word more or less before the anchor,
        # that start is off by one, so also try a window opening 4 words early and keep it only when it
        # matches strictly more words (a tie keeps the plain window, where difflib cannot pair a word of
        # the sentence with a lookalike in the extra context). Trailing and leading inserts are dropped.
        best = None
        for start in (max(0, pos), max(0, pos - 4)):
            seg = self.words[start:pos + len(w) + 40]  # slack for a footnote or running head inside
            ops = difflib.SequenceMatcher(None, w, seg, autojunk=False).get_opcodes()
            if ops and ops[-1][0] == "insert" and ops[-1][2] == len(w):
                ops = ops[:-1]
            if ops and ops[0][0] == "insert" and ops[0][1] == 0:
                ops = ops[1:]
            eq = sum(i2 - i1 for t, i1, i2, j1, j2 in ops if t == "equal")
            if best is None or eq > best[0]:
                best = (eq, ops, seg, start)
        _, ops, seg, self.start = best
        return ops, seg


def sentences(text: str, min_words: int = 8) -> list[tuple[int, int]]:
    """Spans of sentences (at least min_words words) in a block of text."""
    out, start = [], 0
    for m in re.finditer(r"(?<=[.;?!:])[\"'’”)\]]*\s+", text + " "):
        out.append((start, m.start()))
        start = m.end()
    if start < len(text):
        out.append((start, len(text)))
    return [(a, b) for a, b in out if len(WORD.findall(text[a:b])) >= min_words]


def load_words(path: Path) -> set[str]:
    return {norm(w) for w in path.read_text(errors="replace").split()}


def match_rate(text_words: list[str], ops) -> tuple[int, int]:
    eq = sum(b - a for t, a, b, c, e in ops if t == "equal")
    return eq, len(text_words)
