"""Read the main text of 2 Baruch (APOT vol. 2, pages 481 to 526) from the hOCR word boxes of a scan.

Each page's lines are sorted by kind: the running head, the large chapter numbers and the small verse
numbers in the left margin, the source notes in the right margin, the section headings, the text, and
the footnotes below it. Only the text and the section headings are kept, as a list of tokens with
their page and box, so that two scans can be compared word by word and each disagreement looked up
on the page image. Standard library only.
"""
from __future__ import annotations

import html
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch import CACHE  # noqa: E402
from hocr import _pages  # noqa: E402

# Pages 487 to 490 set chapters 12 to 14 in three columns: the Syriac version (kept), an English
# rendering of the Oxyrhynchus Greek fragment, and the Greek. Inside each zone (a list of top and bottom y),
# words right of the split x are dropped; a full-width section heading inside a zone is kept whole.
COLUMNS = {("unse", 487): (860, [(900, 9999)]), ("unse", 488): (1080, [(0, 840)]),
           ("unse", 489): (850, [(840, 1700), (2040, 9999)]), ("unse", 490): (1000, [(0, 1220)]),
           ("rhch", 487): (800, [(870, 9999)]), ("rhch", 488): (1050, [(0, 830)]),
           ("rhch", 489): (790, [(810, 1620), (1935, 9999)]), ("rhch", 490): (985, [(0, 1150)])}
FIRST_PAGE = 478  # the hOCR slices start at printed page 478
SCANS = {
    "unse": CACHE / "hocr" / "apocryphapseudep0002unse_p479-527.hocr.html",
    "rhch": CACHE / "hocr" / "apocryphapseudep0002rhch_w1w3_p479-527.hocr.html",
}
LINE = re.compile(r"<span class=['\"]ocr_(?:line|caption|textfloat|header)['\"][^>]*title=['\"]bbox (\d+) (\d+) (\d+) (\d+)")
WORD = re.compile(r"<span class=['\"]ocrx_word['\"][^>]*title=['\"]bbox (\d+) (\d+) (\d+) (\d+)[^'\"]*?x_fsize (\d+)['\"][^>]*>(.*?)</span>", re.S)
HEAD = re.compile(r"^[IVXLC]+[\s.,:;]*(?:[-—–][IVXLC]+[.,]*\s*)?[\d\s.,\-—–a-z]*[.,]?\s+(?=[A-Z‘'])")


def page_lines(path: Path):
    text = path.read_text(encoding="utf-8")
    for pi, pg in enumerate(_pages(text)):
        out = []
        pos = [(m.start(), tuple(map(int, m.groups()))) for m in LINE.finditer(pg)] + [(len(pg), None)]
        for (a, box), (b, _) in zip(pos, pos[1:]):
            ws = [(tuple(map(int, m.groups()[:4])), int(m.group(5)), html.unescape(re.sub("<[^>]+>", "", m.group(6))))
                  for m in WORD.finditer(pg, a, b)]
            ws = [w for w in ws if w[2].strip()]
            if ws:
                out.append({"box": box, "fs": statistics.median(w[1] for w in ws), "words": ws})
        out.sort(key=lambda l: l["box"][1])
        yield FIRST_PAGE + pi, out


def classify(lines):
    """Return [(kind, line)] for one page; kind is text, head or dropped."""
    long_ = [l for l in lines if len(l["words"]) >= 6]
    if not long_:
        return None
    fss = sorted(l["fs"] for l in long_ if l["fs"] < 60)
    fs = fss[(len(fss) * 9) // 10]  # the text size: the largest common size below the titles
    # the right edge of the text: where most justified lines end (source notes stand beyond it)
    ends = [l["words"][-1][0][2] for l in long_]
    right = max(ends, key=lambda x: (sum(1 for e in ends if abs(e - x) <= 15), -x))
    if sum(1 for e in ends if abs(e - right) <= 15) < 8:
        right = None  # too few justified lines: the caller uses the usual measure of the column
    # the edge of the text column: where continuation lines begin
    starts = sorted(l["box"][0] for l in long_ if l["fs"] > 0.9 * fs)
    edge = starts[len(starts) // 2] if starts else 0

    def is_text(l):
        return len(l["words"]) >= 3 and 0.9 * fs <= l["fs"] <= 1.12 * fs

    # the notes begin after a gap, where the lines from there down are smaller than the text
    notes_at = None
    for i in range(1, len(lines)):
        if lines[i]["box"][1] - lines[i - 1]["box"][3] < 15:
            continue
        above = [l for l in lines[:i] if is_text(l)]
        below = [l["fs"] for l in lines[i:] if len(l["words"]) >= 3]
        first = [l["fs"] for l in lines[i:] if len(l["words"]) >= 3][:2]
        small = sum(1 for f in below if f < 0.9 * fs)
        if len(above) >= 2 and below and small >= 0.8 * len(below) and max(first) < 0.9 * fs:
            notes_at = i
            break
    out = []
    for i, l in enumerate(lines):
        x0, y0, x1, y1 = l["box"]
        t = " ".join(w[2] for w in l["words"])
        if notes_at is not None and i >= notes_at:
            kind = "note"
        elif y0 < 300 and ("BARUCH" in t or (i <= 1 and l["fs"] > 1.3 * fs)):
            kind = "runhead"
        elif re.fullmatch(r"\d{3}", t.strip()):
            kind = "folio"
        elif (x1 < edge - 5 or l["fs"] > 1.2 * fs) and len(l["words"]) <= 3:
            kind = "margin"
        elif l["fs"] < 0.7 * fs and len(l["words"]) < 4:
            kind = "margin"
        elif right is not None and x0 > right - 80:
            kind = "rnote"
        elif HEAD.match(t) and x0 > edge + 150:
            kind = "head"
        elif out and out[-1][0] == "head" and x0 > edge + 300 and x1 < (right or 9999) - 300 and y0 - out[-1][1]["box"][3] < 30:
            kind = "head"
        else:
            kind = "text"
        out.append((kind, l))
    return out, edge, right


GLUED: list = []
MARKS: dict[str, list] = {}  # margin numbers met while reading: (page, box, text)


def local_edge(out, y, edge):
    """The x where prose continuation lines begin near height y (pages are often a little skewed)."""
    pts = []
    for kind, l in out:
        if kind != "text" or len(l["words"]) < 4:
            continue
        w0 = l["words"][0][2]
        if re.fullmatch(r"[A-Za-z][a-z]{2,}[,.;:]?", w0) and abs(l["box"][1] - y) < 600:
            pts.append(l["box"][0])
    if len(pts) < 3:
        return edge
    lo = sorted(pts)[len(pts) // 4]
    near = sorted(x for x in pts if x <= lo + 25)
    return near[len(near) // 2]


def stream(scan: str):
    """The tokens from the first words of chapter 1 to the last words of chapter 87."""
    toks = tokens(scan)
    words = [t[0] for t in toks]
    a = next(i for i in range(len(words)) if words[i:i + 4] == ["And", "it", "came", "to"] and toks[i][1] == 481)
    b = next(i for i in range(len(words)) if words[i:i + 3] == ["neck", "of", "the"] and toks[i][1] == 526)
    c = next(i for i in range(b, len(words)) if words[i:i + 2] == ["sent", "it."])
    return toks[a:c + 2]


def tokens(scan: str):
    """Tokens of the text and headings: (word, page, box, kind, last in line)."""
    toks = []
    pages = [(page, lines, classify(lines)) for page, lines in page_lines(SCANS[scan])]
    widths = sorted(r[2] - r[1] for _, _, r in pages if r and r[2])
    width = widths[len(widths) // 2]
    for page, lines, res in pages:
        if not res:
            continue
        out, edge, right = res
        if right is None:
            right = edge + width
        for kind, l in out:
            if kind == "margin":
                MARKS.setdefault(scan, []).extend((page, w[0], w[2]) for w in l["words"])
            if kind not in ("text", "head"):
                continue
            ws = list(l["words"])
            ws = [w for w in ws if w[0][0] < right + 15]  # source notes in the right margin
            if not ws:
                continue
            col = COLUMNS.get((scan, page))
            if col and l["box"][0] > col[0]:
                continue  # a centered title over the columns
            if col and any(y0 <= l["box"][1] < y1 for y0, y1 in col[1]) and not re.match(r"^X[IVXL]*[.\-]", ws[0][2]):
                ws = [w for w in ws if w[0][2] < col[0]]
                if not ws:
                    continue
            # margin verse and chapter numbers glued to the front of a line
            e = local_edge(out, l["box"][1], edge)
            while len(ws) > 1 and ws[0][0][2] < e - 4 and len(ws[0][2]) <= 5:
                MARKS.setdefault(scan, []).append((page, ws[0][0], ws[0][2]))
                ws.pop(0)
            if ws and ws[0][0][0] < e - 12 and kind == "text":
                (bx0, by0, bx1, by1), f, w = ws[0]
                m = re.match(r"^\d[\dIlOSgq]*[,.:]?\s*", w)
                if m and m.end() < len(w):
                    GLUED.append((scan, page, w, w[m.end():]))
                    ws[0] = ((bx0, by0, bx1, by1), f, w[m.end():])
            for n, (box, f, w) in enumerate(ws):
                toks.append((w, page, box, kind, n == len(ws) - 1))
    return toks


if __name__ == "__main__" and False:
    scan = sys.argv[1]
    last = None
    for w, page, box, kind in tokens(scan):
        if (page, kind) != last:
            print(f"\n[{page} {kind}]", end=" ")
            last = (page, kind)
        print(w, end=" ")
    print()


# APOT sets LORD in small capitals; the OCR reads it as Lorp, Lorb, LorD, Lorn and the like.
SMALL_CAPS_LORD = re.compile(r"(?<![A-Za-z])Lor(?:[A-Z][A-Za-z]*|[pbn][A-Za-z]*)(?![a-z])")
OPEN = "\u2018\u201c(["
CLOSE_PUNCT = re.compile(r"^[,.;:?!\u2019\u201d)\]]+$")


def words(scan: str, joined: set[str] | None = None):
    """The stream as words: (text, page, box). Punctuation the OCR set apart is joined to its word,
    and a word broken at a line end is joined again; the hyphen stays when the hyphenated form is
    printed whole somewhere in the text (`joined` holds those forms, from both scans)."""
    out = []
    pending_open = ""
    hyph = None
    for w, page, box, kind, eol in stream(scan):
        if hyph is not None:
            hw, hpage, hbox = hyph
            hyph = None
            stem = hw[:-1]
            form = re.sub(r"[^a-z-]", "", (stem + "-" + w).lower())
            keep = joined is not None and form in joined
            w = stem + ("-" if keep else "") + w
            page, box = hpage, hbox
        elif CLOSE_PUNCT.match(w) and out:
            t, p, b = out[-1]
            out[-1] = (t + w, p, b)
            continue
        w = SMALL_CAPS_LORD.sub("LORD", w)
        if all(c in OPEN for c in w):
            pending_open += w
            continue
        w = pending_open + w
        pending_open = ""
        if eol and re.search(r"[A-Za-z]-$", w) and not w.endswith("--"):
            hyph = (w, page, box)
            continue
        out.append((w, page, box))
    return out


def hyphenated_forms() -> set[str]:
    """Hyphenated words printed whole inside a line, in either scan, lowercase, letters and hyphens."""
    forms = set()
    for scan in SCANS:
        for w, page, box, kind, eol in stream(scan):
            if not eol and re.fullmatch(r"[\u2018\u201c(\[]*[A-Za-z]+(?:-[A-Za-z]+)+[,.;:?!\u2019\u201d)\]]*", w):
                forms.add(re.sub(r"[^a-z-]", "", w.lower()))
    return forms
