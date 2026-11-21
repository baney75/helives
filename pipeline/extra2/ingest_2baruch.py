"""Ingest 2 Baruch (the Syriac Apocalypse of Baruch) in R. H. Charles' translation, from The Apocrypha
and Pseudepigrapha of the Old Testament in English, vol. 2 (Oxford: Clarendon Press, 1913), pages 481
to 526.

Usage: python3 -I pipeline/extra2/ingest_2baruch.py [--report]
Text: read from the page images of two independent archive.org scans of the 1913 printing
(apocryphapseudep0002unse and apocryphapseudep0002rhch_w1w3), through their hOCR word boxes
(bar_scan.py keeps the text and the section headings and drops the running heads, the margin numbers,
the source notes in the right margin, the footnotes, and on pages 487 to 490 the two columns with the
Oxyrhynchus Greek fragment). The two readings are aligned word by word; every place where they
disagree, and every agreed reading that is not an English word, was settled on the page image and is
listed in 2baruch_readings.tsv. A disagreement without a settled reading stops the build.

Verse numbers: chapters 1 to 85:2 follow the verse divisions of the Wesley Center transcription of this
same edition (pseud/2Baruch.html, used only for where verses begin, never for words, since it
modernizes the English); the verses it lacks (12:5, chapters 32 and 33, and 85:3 to 87:1) were read
from the margin numbers on the page images. Each verse start
is checked against the margin numbers the scans print.

Kept: every chapter and verse, Charles' section headings with their chapter ranges, his brackets,
parentheses and daggers. Dropped: the introduction, the footnotes, the source notes and the
book title with its line "[Translated from the Greek into Syriac.]". Poetry lines are run together.
"""
from __future__ import annotations

import difflib
import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from align import as_number  # noqa: E402
from bar_scan import MARKS, SCANS, hyphenated_forms, words  # noqa: E402
from common import files_sha256, gaps, guard  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

READINGS = HERE / "2baruch_readings.tsv"
ETEXT = CACHE / "pseud" / "2Baruch.html"
OUT = LIBRARY / "pseudepigrapha" / "2-baruch.toml"
IDENTS = ("apocryphapseudep0002unse", "apocryphapseudep0002rhch_w1w3")

# Verse starts the transcription lacks (12:5, chapters 32 and 33, and everything after 85:2), read
# from the margin numbers on the page images. Where the margin number stands beside a line with no
# sentence break, the verse is taken to begin at the clause that opens the line's sense (33:2).
HAND_STARTS = [
    (12, 5, "And when I had said these things"),
    (32, 1, "‘But as for you, if ye prepare"),
    (32, 2, "[Because after a little time"),
    (32, 3, "But that building will not remain"),
    (32, 4, "And afterwards it must be renewed"),
    (32, 5, "Therefore we should not be distressed"),
    (32, 6, "For there will be a greater trial"),
    (32, 7, "And now do not draw near to me"),
    (32, 8, "And it came to pass when I had spoken"),
    (32, 9, "and when the people saw me"),
    (33, 1, "‘Are these the commands"),
    (33, 2, "and said unto thee"),
    (33, 3, "And now if thou also forsakest us"),
    (85, 3, "But now the righteous have been gathered"),
    (85, 4, "If therefore we direct"),
    (85, 5, "For what we have lost"),
    (85, 6, "[Moreover, also, I have written"),
    (85, 7, "And let all those things aforesaid"),
    (85, 8, "Again, moreover, the Most High"),
    (85, 9, "Before therefore judgement"),
    (85, 10, "For the youth of the world"),
    (85, 11, "And again prepare your souls"),
    (85, 12, "For lo! when the Most High"),
    (85, 13, "There there is the sentence"),
    (85, 14, "On this account there is"),
    (85, 15, "Then He will preserve"),
    (86, 1, "When therefore ye receive"),
    (86, 2, "And meditate thereon"),
    (86, 3, "And bear me in mind"),
    (87, 1, "And it came to pass when I had ended"),
]
# A heading begins with Charles' chapter range in capital Roman numerals.
HEAD_START = re.compile(r"^[IVXLC]+(?:[-][IVXLC]+)?\.$")
# Titles that stand under a heading as a line of their own.
SUBTITLES = ("The Prayer of Baruch the Son of Neriah.", "THE EPISTLE OF BARUCH")
CLOSE = re.compile(r"^[,.;:?!’”)\]]+$")


def load_readings():
    table = {}
    for line in READINGS.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        page, ctx, u, r, printed = line.split("\t")
        table[(int(page), ctx, u, r)] = printed
    return table


def settled_text(log):
    """The unse reading with every disagreement and every flagged agreed word put right."""
    joined = hyphenated_forms()
    U, R = words("unse", joined), words("rhch", joined)
    a, b = [t[0] for t in U], [t[0] for t in R]
    table = load_readings()
    used = set()
    out = []  # (word, page, box of the unse word nearest)

    def look(i1, u, r):
        key = (U[min(i1, len(U) - 1)][1], " ".join(a[max(0, i1 - 4):i1]), u, r)
        return key, table.get(key)

    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    missing = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for i in range(i1, i2):
                key, printed = look(i, a[i], a[i])
                if printed is not None:
                    used.add(key)
                    out.extend((w, U[i][1], U[i][2]) for w in printed.split())
                    log.append(f"agreed p{U[i][1]}: {a[i]!r} -> {printed!r}")
                else:
                    out.append(U[i])
            continue
        u, r = " ".join(a[i1:i2]), " ".join(b[j1:j2])
        key, printed = look(i1, u, r)
        if printed is None:
            missing.append(key)
            continue
        used.add(key)
        where = U[min(i1, len(U) - 1)]
        out.extend((w, where[1], where[2]) for w in printed.split())
        log.append(f"settled p{where[1]}: unse {u!r} / rhch {r!r} -> {printed!r}")
    if missing:
        raise SystemExit("disagreements not settled on the page image:\n" + "\n".join(map(repr, missing[:20])))
    stale = set(table) - used
    if stale:
        raise SystemExit(f"{len(stale)} readings in {READINGS.name} no longer match: {sorted(stale)[:5]}")
    # standalone closing marks belong to the word before; so does the word after a dash
    merged = []
    for w, p, bx in out:
        w = re.sub(r"(?<=[A-Za-z])'(?=[a-z])", "\u2019", w)  # the OCR reads a few italic apostrophes as straight
        if merged and (CLOSE.match(w) or merged[-1][0].endswith("\u2014")):  # a dash closes up at a line end
            merged[-1] = (merged[-1][0] + w, merged[-1][1], merged[-1][2])
        else:
            merged.append((w, p, bx))
    agree = sum(k.size for k in sm.get_matching_blocks())
    return merged, (len(a), len(b), agree, len(table))


def etext_starts():
    """(chapter, verse, first words) from the transcription's verse anchors, 1:1 to 85:2."""
    raw = ETEXT.read_text(encoding="utf-8", errors="replace")
    parts = re.split(r'<A ID="C(\d+)\.(\d+)">', raw)
    out = []
    for k in range(1, len(parts) - 2, 3):
        ch, v, body = int(parts[k]), int(parts[k + 1]), parts[k + 2]
        body = re.sub(r"<CENTER>.*?</CENTER>", " ", body, flags=re.S | re.I)
        body = html.unescape(re.sub(r"<[^>]+>", " ", body))
        body = re.sub(r"^\s*\d+\s+", "", body)
        body = body.split("Chapter ")[0].split("OXYRHYNCHUS")[0]
        if re.match(r"\s*\d+a\b", body) or any((c, n) == (ch, v) for c, n, _ in out):
            continue  # the transcription's rendering of the Greek fragment (11a, 12a)
        out.append((ch, v, " ".join(body.split())))
    return out


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def verse_starts(text, log):
    """Token index of every verse start."""
    ours = [norm(w) for w, _, _ in text]
    starts = {}
    et = etext_starts()
    theirs, first = [], []
    for ch, v, body in et:
        first.append(len(theirs))
        theirs.extend(norm(w) for w in body.split())
    sm = difflib.SequenceMatcher(None, theirs, ours, autojunk=False)
    blocks = sm.get_matching_blocks()
    for (ch, v, body), j in zip(et, first):
        # the first word of the verse that our text shares, taken back to the verse start
        hit = None
        for blk in blocks:
            if blk.a <= j < blk.a + blk.size:
                hit = blk.b + (j - blk.a)
                break
            if blk.a > j:
                # words before the first shared word: count them back on our side
                hit = blk.b - (blk.a - j)
                break
        if hit is None:
            raise SystemExit(f"{ch}:{v}: verse start not found")
        starts[(ch, v)] = hit
    for ch, v, words_ in HAND_STARTS:
        want = [norm(w) for w in words_.split()]
        before = [i for (c, n), i in starts.items() if (c, n) < (ch, v)]
        after = max(before) if before else 0
        i = next((i for i in range(after + 1, len(ours)) if ours[i:i + len(want)] == want), None)
        if i is None:
            raise SystemExit(f"{ch}:{v}: {words_!r} not found")
        starts[(ch, v)] = i
    order = sorted(starts.items(), key=lambda kv: kv[0])
    for (k1, i1), (k2, i2) in zip(order, order[1:]):
        if i2 <= i1:
            raise SystemExit(f"verse starts out of order: {k1} at {i1}, {k2} at {i2}")
    return starts


def check_marks(text, starts):
    """Share of verse starts with a matching margin number level with their line in either scan."""
    marks = {}
    for scan in SCANS:
        for page, box, t in MARKS.get(scan, []):
            marks.setdefault((scan, page), []).append((box, t))
    hits = 0
    for (ch, v), i in starts.items():
        w, page, box = text[i]
        yc = (box[1] + box[3]) / 2
        found = False
        for (scan, p), ms in marks.items():
            if scan != "unse" or p != page:
                continue
            for mb, t in ms:
                if abs((mb[1] + mb[3]) / 2 - yc) < 40:
                    nums = [as_number(x + ".") for x in re.split(r"[,\s]+", t) if x]
                    if v in nums or ch in nums:
                        found = True
        hits += found
    return hits, len(starts)


def build(text, starts, log):
    heads = {}  # token index of a heading start -> heading end
    i = 0
    while i < len(text):
        if HEAD_START.match(text[i][0]) and (i == 0 or re.search(r"[.?!’”\]]$", text[i - 1][0])):
            j = next(k for k in sorted(starts.values()) if k > i)
            heads[i] = j
            i = j
        else:
            i += 1
    by_start = {i: k for k, i in starts.items()}
    sections, blocks, cur = [], None, []
    pending_heads = []

    def flush_verse():
        if cur and blocks is not None:
            words_ = [w for w, _, _ in cur[1]]
            blocks.append({"t": "v", "n": cur[0][1], "text": " ".join(words_)})

    i = 0
    cur = None
    while i < len(text):
        if i in heads:
            if cur:
                blocks.append({"t": "v", "n": cur[0][1], "text": " ".join(w for w, _, _ in cur[1])})
                cur = None
            span = " ".join(w for w, _, _ in text[i:heads[i]])
            pieces = re.split(r"\s(?=(?:[IVXLC]+(?:-[IVXLC]+)?\.\s)|The Prayer of Baruch|THE EPISTLE)", span)
            heads_here = []
            for p in (p.strip() for p in pieces if p.strip()):
                if heads_here and (heads_here[-1].endswith(",") or re.fullmatch(r"[IVXLC-]+\.", heads_here[-1])):
                    heads_here[-1] += " " + p  # "XLIV. 1-8, XLV-XLVI. ..." and a bare range over a title
                else:
                    heads_here.append(p)
            # an opening bracket or quote set at the end of the span belongs to the verse
            lead = re.search(r"(\s[\[\u2018\u201c(]+)$", heads_here[-1])
            if lead:
                heads_here[-1] = heads_here[-1][:lead.start()]
                text[heads[i]] = (lead.group(1).strip() + text[heads[i]][0],) + tuple(text[heads[i]][1:])
            pending_heads.extend(heads_here)
            i = heads[i]
            continue
        if i in by_start:
            ch, v = by_start[i]
            if cur:
                blocks.append({"t": "v", "n": cur[0][1], "text": " ".join(w for w, _, _ in cur[1])})
            if v == 1:
                blocks = []
                sections.append({"id": str(ch), "title": f"Chapter {ch}", "level": 1, "blocks": blocks})
            for h in pending_heads:
                blocks.append({"t": "h", "level": 3, "text": h})
                log.append(f"heading before {ch}:{v}: {h}")
            pending_heads = []
            cur = ((ch, v), [])
        if cur is None:
            raise SystemExit(f"text before the first verse: {text[i][0]!r}")
        cur[1].append(text[i])
        i += 1
    if cur:
        blocks.append({"t": "v", "n": cur[0][1], "text": " ".join(w for w, _, _ in cur[1])})
    return sections


def main(argv):
    log: list[str] = []
    text, (nu, nr, agree, nread) = settled_text(log)
    starts = verse_starts(text, log)
    hits, total = check_marks(text, starts)
    sections = build(text, starts, log)
    m = meta("pseud/2Baruch.html")
    hocr = [p for p in SCANS.values()]
    work = {
        "id": "2-baruch",
        "title": "2 Baruch, or the Syriac Apocalypse of Baruch",
        "short_title": "2 Baruch",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 6,
        "date": "Late 1st century AD (Charles dates its parts between AD 50 and 90)",
        "language": "Syriac, from a Greek translation of a lost Hebrew original",
        "translator": "R. H. Charles",
        "edition": "The Apocalypse of Baruch, translated by R. H. Charles, in The Apocrypha and Pseudepigrapha of the Old Testament in English, edited by R. H. Charles, vol. 2 (Oxford: Clarendon Press, 1913), pages 481 to 526",
        "source_url": "https://archive.org/details/apocryphapseudep0002unse",
        "source_sha256": files_sha256(hocr),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": f"The Apocrypha and Pseudepigrapha of the Old Testament in English, vol. 2, published in Oxford by the Clarendon Press in 1913; in the public domain in the United States because it was published before 1931. The words are read from two archive.org scans of the 1913 printing ({IDENTS[0]}, {IDENTS[1]}), with every disagreement between them settled on the page image.",
        "summary": "A Jewish apocalypse written after the fall of Jerusalem in AD 70 and set at the first fall in 587 BC, preserved whole only in Syriac. Baruch, the scribe of Jeremiah, mourns the city, receives visions of the coming judgement, the Messiah and the resurrection, and ends with a letter to the exiled tribes. It is outside every Jewish and Christian canon and is kept here for history and study. It is not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    nv = sum(1 for s in sections for b in s["blocks"] if b["t"] == "v")
    nh = sum(1 for s in sections for b in s["blocks"] if b["t"] == "h")
    print(f"scan words unse {nu}, rhch {nr}, agreeing in order {agree} ({agree / nu:.2%}); readings settled {nread}")
    print(f"chapters {len(sections)}, verses {nv}, headings {nh}, verse starts with a margin number in unse {hits}/{total}")
    for si, a, k in gaps(sections):
        print("gap", sections[si]["id"], a, k)
    longest = sorted(((len(b["text"].split()), s["id"], b["n"]) for s in sections for b in s["blocks"] if b["t"] == "v"), reverse=True)[:6]
    print("longest verses (words, chapter, verse):", longest)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
