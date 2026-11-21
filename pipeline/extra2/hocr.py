"""Read archive.org hOCR (word boxes) into plain text lines with margin numbers put back.

Some scans' plain OCR text lifts the margin verse numbers out into a separate block, losing the line
they belong to. hocr_lines(path) returns the page text as lines, in OCR reading order, with a margin
number that sits level with a text line moved to the start of that line ("5 earth; their faces ...").
Standard library only.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

PAGE = re.compile(r"<div class=['\"]ocr_page['\"][^>]*title=['\"]([^'\"]*)['\"]")
LINE = re.compile(r"<span class=['\"]ocr_(?:line|caption|textfloat|header)['\"][^>]*title=['\"]bbox (\d+) (\d+) (\d+) (\d+)")
WORDRE = re.compile(r"<span class=['\"]ocrx_word['\"][^>]*title=['\"]bbox (\d+) (\d+) (\d+) (\d+)[^>]*>(.*?)</span>", re.S)
NUM = re.compile(r"^[\dlIiroOzZgqsSbBt]{1,2}[.,]?$")


def _pages(text: str):
    starts = [m.start() for m in PAGE.finditer(text)] + [len(text)]
    for a, b in zip(starts, starts[1:]):
        yield text[a:b]


def _lines(page: str):
    out = []
    pos = [(m.start(), tuple(int(x) for x in m.groups())) for m in LINE.finditer(page)] + [(len(page), None)]
    for (a, box), (b, _) in zip(pos, pos[1:]):
        words = [(tuple(int(x) for x in m.groups()[:4]), html.unescape(re.sub(r"<[^>]+>", "", m.group(5))))
                 for m in WORDRE.finditer(page, a, b)]
        if words:
            out.append({"box": box, "words": words})
    return out


def hocr_lines(path: Path, digitish=None) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    result = []
    for page in _pages(text):
        lines = _lines(page)
        body = [l for l in lines if len(l["words"]) >= 3]
        if not body:
            result.extend(" ".join(w for _, w in l["words"]) for l in lines)
            continue
        lefts = sorted(l["box"][0] for l in body)
        left = lefts[len(lefts) // 10]
        margin, keep = [], []
        for l in lines:
            ws = l["words"]
            if len(ws) <= 2 and all(NUM.match(w) for _, w in ws) and l["box"][2] < left + 5:
                margin.extend(ws)  # a lifted margin-number block: one or more numbers
            else:
                keep.append(l)
        attach = {}
        for (x0, y0, x1, y1), w in margin:
            yc = (y0 + y1) / 2
            best = None
            for i, l in enumerate(keep):
                lx0, ly0, lx1, ly1 = l["box"]
                if ly0 - 4 <= yc <= ly1 + 4 and lx0 > x1 - 3 and lx0 < left + 400:
                    d = abs((ly0 + ly1) / 2 - yc)
                    if best is None or d < best[0]:
                        best = (d, i)
            if best:
                attach.setdefault(best[1], []).append(w)
        for i, l in enumerate(keep):
            words = [w for _, w in l["words"]]
            if i in attach:
                words = attach[i] + words
            result.append(" ".join(words))
    return result


def marked_lines(path: Path) -> list[tuple[str | None, str]]:
    """Page text as (margin mark or None, line text). A mark is any short token printed in the left
    margin level with a text line, read or not (APOT prints some verse numbers turned sideways, which
    the OCR cannot read, but their place on the page is still known)."""
    text = path.read_text(encoding="utf-8", errors="replace")
    result: list[tuple[str | None, str]] = []
    for page in _pages(text):
        lines = _lines(page)
        body = [l for l in lines if len(l["words"]) >= 4]
        if not body:
            result.extend((None, " ".join(w for _, w in l["words"])) for l in lines)
            continue
        lefts = sorted(l["box"][0] for l in body)
        left = lefts[len(lefts) // 10]
        margin, keep = [], []
        for l in lines:
            ws = l["words"]
            if l["box"][2] < left - 2 and len(ws) <= 3 and all(len(w) <= 3 for _, w in ws):
                margin.append(l)
                continue
            # a mark glued to the front of a text line: a short first word well left of the column edge
            (x0, y0, x1, y1), w0 = ws[0]
            if len(ws) > 1 and len(w0) <= 3 and x1 < left - 2 and ws[1][0][0] >= left - 8:
                margin.append({"box": (x0, y0, x1, y1), "words": [ws[0]]})
                l = {"box": (ws[1][0][0],) + l["box"][1:], "words": ws[1:]}
            keep.append(l)
        attach: dict[int, list[str]] = {}
        for m in margin:
            mx0, my0, mx1, my1 = m["box"]
            yc = (my0 + my1) / 2
            best = None
            for i, l in enumerate(keep):
                lx0, ly0, lx1, ly1 = l["box"]
                if ly0 - 6 <= yc <= ly1 + 6 and left - 8 <= lx0 <= left + 80:
                    d = abs((ly0 + ly1) / 2 - yc)
                    if best is None or d < best[0]:
                        best = (d, i)
            if best:
                attach.setdefault(best[1], []).extend(w for _, w in m["words"])
        for i, l in enumerate(keep):
            mark = " ".join(attach[i]) if i in attach else None
            result.append((mark, " ".join(w for _, w in l["words"])))
    return result
