"""Hear-correctly check: normalize reference and transcript, align them, compute WER.

Standard library only. The alignment allows a zero-cost merge of two words into one
("seed bearing" / "seedbearing", "for ever" / "forever", "A D" / "AD") so spacing
differences are not counted as errors. The alignment also maps reference words to
transcript words, which gives each verse its start time from Whisper word timestamps.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from prep import Lexicon, cardinal, ordinal, year_words


def _fold(word: str) -> str:
    w = unicodedata.normalize("NFKD", word)
    w = "".join(c for c in w if not unicodedata.combining(c))
    w = w.replace("æ", "ae").replace("Æ", "Ae").replace("œ", "oe")
    return w.lower()


def _digits_to_words(tok: str, ref_joined: str) -> str:
    m = re.fullmatch(r"(\d+)(st|nd|rd|th)", tok)
    if m:
        return ordinal(int(m.group(1)))
    if re.fullmatch(r"\d{1,3}(,\d{3})+", tok):
        return cardinal(int(tok.replace(",", "")))
    if re.fullmatch(r"\d+", tok):
        n = int(tok)
        if 100 <= n <= 2099:
            y = year_words(n).replace("-", " ")
            if f" {y} " in ref_joined:
                return y
        return cardinal(n)
    return tok


def norm_words(words: list[str], lexicon: Lexicon | None = None,
               ref_joined: str = "") -> tuple[list[str], list[int]]:
    """Original words -> (normalized tokens, index of the source word for each token)."""
    variants = lexicon.variants if lexicon else {}
    toks, src = [], []
    for i, raw in enumerate(words):
        w = _fold(raw)
        w = re.sub(r"(\d+):(\d+)", r"\1 \2", w)
        w = re.sub(r"(?<=\d)-(?=\d)", " to ", w)
        out = []
        for part in w.replace("-", " ").replace("—", " ").replace("–", " ").split():
            part = re.sub(r"^[^\w]+|[^\w]+$", "", part)
            if re.fullmatch(r"\d[\d,]*(st|nd|rd|th)?", part):
                out.extend(_digits_to_words(part, ref_joined).replace("-", " ").split())
                continue
            part = re.sub(r"[’'`]", "", part)
            part = re.sub(r"[^\w]", " ", part)
            out.extend(part.split())
        for t in out:
            # A variant Whisper split at a hyphen arrives as two words: "hand", "-breaths".
            if toks and toks[-1] + t in variants:
                toks[-1] = variants[toks[-1] + t]
                continue
            t = variants.get(t, t)
            toks.extend(t.split())
            src.extend([i] * len(t.split()))
    return toks, src


@dataclass
class Alignment:
    errors: int
    n_ref: int
    subs: int
    dels: int
    ins: int
    ref_to_hyp: list[int | None]       # per reference token: aligned hypothesis token or None
    repeats: list[str] = None          # inserted words that repeat a neighbor (stutter, doubled word)

    @property
    def wer(self) -> float:
        return self.errors / max(1, self.n_ref)


def align(ref: list[str], hyp: list[str]) -> Alignment:
    n, m = len(ref), len(hyp)
    INF = 10**9
    D = [[INF] * (m + 1) for _ in range(n + 1)]
    B: list[list[tuple | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    D[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            d = D[i][j]
            if d == INF:
                continue
            steps = []
            if i < n and j < m:
                steps.append((i + 1, j + 1, 0 if ref[i] == hyp[j] else 1, "M" if ref[i] == hyp[j] else "S"))
            if i < n:
                steps.append((i + 1, j, 1, "D"))
            if j < m:
                steps.append((i, j + 1, 1, "I"))
            if i + 1 < n and j < m and ref[i] + ref[i + 1] == hyp[j]:
                steps.append((i + 2, j + 1, 0, "R2"))
            if i < n and j + 1 < m and ref[i] == hyp[j] + hyp[j + 1]:
                steps.append((i + 1, j + 2, 0, "H2"))
            for ni, nj, c, op in steps:
                if d + c < D[ni][nj]:
                    D[ni][nj] = d + c
                    B[ni][nj] = (i, j, op)
    ref_to_hyp: list[int | None] = [None] * n
    subs = dels = ins = 0
    repeats: list[str] = []
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, op = B[i][j]
        if op in ("M", "S"):
            ref_to_hyp[pi] = pj
            subs += op == "S"
        elif op == "R2":
            ref_to_hyp[pi] = ref_to_hyp[pi + 1] = pj
        elif op == "H2":
            ref_to_hyp[pi] = pj
        elif op == "D":
            dels += 1
        else:
            ins += 1
            extra = hyp[pj]
            near = [ref[k] for k in (pi - 1, pi) if 0 <= k < n]
            if any(extra == r or (len(extra) >= 2 and r.startswith(extra)) for r in near):
                repeats.append(extra)
        i, j = pi, pj
    return Alignment(D[n][m], n, subs, dels, ins, ref_to_hyp, repeats[::-1])


def score(ref_text: str, hyp_words: list[str], lexicon: Lexicon | None = None) -> dict:
    """WER of a transcript (list of words as Whisper returned them) against the reference text."""
    ref_tokens, ref_src = norm_words(ref_text.split(), lexicon)
    joined = " " + " ".join(ref_tokens) + " "
    hyp_tokens, hyp_src = norm_words(hyp_words, lexicon, joined)
    a = align(ref_tokens, hyp_tokens)
    return {"wer": round(a.wer, 4), "errors": a.errors, "ref_tokens": len(ref_tokens),
            "subs": a.subs, "dels": a.dels, "ins": a.ins, "repeats": a.repeats,
            "_alignment": a, "_ref_src": ref_src, "_hyp_src": hyp_src}


def anchor_times(ref_text: str, anchors: list[list], hyp_words: list[dict],
                 duration: float, lexicon: Lexicon | None = None) -> dict[str, float]:
    """Start time (seconds, inside the chunk) of each anchor word index.

    hyp_words: [{"word": str, "start": float, "end": float}, ...] from Whisper.
    Falls back to the next aligned word, then to a proportional estimate by word position."""
    words = ref_text.split()
    s = score(ref_text, [w["word"] for w in hyp_words], lexicon)
    a: Alignment = s["_alignment"]
    ref_src, hyp_src = s["_ref_src"], s["_hyp_src"]
    out = {}
    for anchor_id, widx in anchors:
        t = None
        for k, src in enumerate(ref_src):
            if src < widx:
                continue
            h = a.ref_to_hyp[k]
            if h is not None:
                t = float(hyp_words[hyp_src[h]]["start"])
                break
        if t is None:
            t = duration * (widx / max(1, len(words)))
        out[anchor_id] = round(max(0.0, t), 3)
    return out
