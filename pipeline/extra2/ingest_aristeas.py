"""Ingest the Letter of Aristeas in H. T. Andrews' translation, from Charles' Apocrypha and
Pseudepigrapha of the Old Testament, vol. 2 (Oxford: Clarendon Press, 1913).

Usage: python3 -I pipeline/extra2/ingest_aristeas.py [--report]
Text: the electronic text scanned and edited by Joshua Williams (Northwest Nazarene College, 1995),
from pseudepigrapha.com (cached in pipeline/cache/extra2/pseud/aristeas.htm). It carries the 322 section
numbers that APOT prints in the margin, at the line where APOT prints them, so a section can begin
mid-sentence. Scanning artifacts are normalized: a spaced hyphen becomes the em dash APOT prints, and
spaces inside quotation marks are closed up. The words are checked against two archive.org scans of
APOT vol. 2 with pipeline/extra2/verify.py.
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from common import apply_corrections, files_sha256, gaps, guard, ocr_spelling, repair  # noqa: E402
from ia import ocr  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

SRC = CACHE / "pseud" / "aristeas.htm"
OUT = LIBRARY / "pseudepigrapha" / "letter-of-aristeas.toml"
EM = "\u2014"
SCANS = ("apocryphapseudep0002unse", "apocryphapseudep0002rhch_w1w3")

# Margin numbers both OCRs missed, read on the page images (pages 96, 99 and 109): the section starts
# at the printed line that carries the number. (number, first words of that line)
SPLITS = [(19, "replied, 'A little more than"), (44, "I will consent to everything"), (119, "ravines, and the rugged")]
# Checked against the scans; (section, e-text, printed text).
CORRECTIONS: list[tuple[str, str, str]] = [
    ("text", "thank offering", "thankoffering"),                       # pp. 96 and 99
    ("text", "a regard for my zeal", "a reward for my zeal"),          # p. 99
    ("text", "ready to assume their duties", "ready to resume their duties"),  # p. 104
    ("text", "thoughts ill his sleep", "thoughts in his sleep"),
    ("text", "so too you ill imitation", "so too you in imitation"),
    ("text", "for he w as a man", "for he was a man"),
    ("text", "brim. ln the middle", "brim. In the middle"),
    ("text", "form of ropes marvelously", "form of ropes marvellously"),
    ("text", "carry out everything in 1844", "carry out everything in"),  # margin number 184 typed 1844
    ("text", "to those who will 291", "to those who will"),               # margin number 297 typed 291
]


def quotes(s: str) -> str:
    """Close up spaces inside quotation marks. A mark spaced on both sides opens or closes by state."""
    for q in ("'", '"'):
        parts = re.split(rf"(\s*{q}\s*)", s)
        out, is_open = [], False
        for k, part in enumerate(parts):
            if k % 2 == 0:
                out.append(part)
                continue
            prev = parts[k - 1][-1:] if parts[k - 1] else " "
            nxt = parts[k + 1][:1] if k + 1 < len(parts) and parts[k + 1] else " "
            ls, rs = part[:1].isspace() or prev == " ", part[-1:].isspace()
            if q == "'" and not ls and not rs and prev.isalnum() and nxt.isalnum():
                out.append(q)  # apostrophe
                continue
            if ls and not rs:
                closing = False
            elif rs and not ls:
                closing = True
            elif not ls and not rs:
                closing = not nxt.isalnum()
            else:
                closing = is_open
            is_open = not closing
            out.append(q + " " if closing else " " + q)
        s = re.sub(r"\s+", " ", "".join(out))
    return s


def clean(s: str) -> str:
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+-\s*(?=[A-Za-z])", EM, s)
    s = re.sub(r"(?<=[A-Za-z,;])\s*-\s+", EM, s)
    s = quotes(s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    s = re.sub(r"\s+\)", ")", s)
    s = re.sub(r"\(\s+", "(", s)
    return s.strip()


def build():
    raw = SRC.read_text(encoding="latin-1")
    start = raw.find("SINCE I have collected")
    end = raw.find("<hr>", start)
    body = raw[start:end]
    guard(body, SRC.name)
    body = html.unescape(re.sub(r"<[^>]+>", " ", body))
    blocks, last, pos = [], 1, 0
    pieces = []
    for m in re.finditer(r"(?<=\s)(\d{1,3})(?=\s)", body):
        n = int(m.group(1))
        if not last < n <= last + 3:
            continue
        pieces.append((last, body[pos:m.start()]))
        last, pos = n, m.end()
    pieces.append((last, body[pos:]))
    for n, text in pieces:
        blocks.append({"t": "v", "n": n, "text": clean(text)})
    if last != 322:
        raise SystemExit(f"last section {last}, expected 322")
    return [{"id": "text", "title": "The Letter of Aristeas", "level": 1, "blocks": blocks}]


def scan_region(ident: str) -> str:
    """The Letter of Aristeas pages of an APOT vol. 2 OCR."""
    raw = ocr(ident)
    i = raw.find("SINCE I have collected")
    j = raw.find("reward for your zeal", i)
    if i < 0 or j < 0:
        raise SystemExit(f"{ident}: Aristeas not found in OCR")
    return raw[i - 20:j + 40]


def main(argv):
    sections = build()
    log: list[str] = []
    for ident in SCANS:  # the second scan fills numbers the first OCR misread
        repair(sections, scan_region(ident), log)
    blocks = sections[0]["blocks"]
    for k, words in SPLITS:
        hit = [i for i, b in enumerate(blocks) if words in b["text"]]
        if len(hit) != 1 or blocks[hit[0]]["n"] != k - 1:
            raise SystemExit(f"split {k} not found once in section {k - 1}")
        b = blocks[hit[0]]
        head, tail = b["text"].split(words, 1)
        b["text"] = head.rstrip()
        blocks.insert(hit[0] + 1, {"t": "v", "n": k, "text": (words + tail).strip()})
        log.append(f"split {k} at {words!r}")
    ocr_spelling(sections, scan_region(SCANS[0]), log)
    left = list(gaps(sections))
    apply_corrections(sections, CORRECTIONS, log)
    m = meta("pseud/aristeas.htm")
    work = {
        "id": "letter-of-aristeas",
        "title": "The Letter of Aristeas",
        "short_title": "Aristeas",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 7,
        "date": "2nd century BC (Andrews dates it about 130 to 70 BC)",
        "language": "Greek",
        "translator": "H. T. Andrews",
        "edition": "The Letter of Aristeas, translated by H. T. Andrews, in The Apocrypha and Pseudepigrapha of the Old Testament in English, edited by R. H. Charles, vol. 2 (Oxford: Clarendon Press, 1913), pages 94 to 122",
        "source_url": "http://www.pseudepigrapha.com/pseudepigrapha/aristeas.htm",
        "source_sha256": files_sha256([SRC]),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": f"Published in Oxford by the Clarendon Press in 1913; in the public domain in the United States because it was published before 1931. Text checked against two archive.org scans of the 1913 printing ({SCANS[0]}, {SCANS[1]}).",
        "summary": "A letter in the name of Aristeas, a courtier of Ptolemy II of Egypt, telling how seventy-two Jewish elders came from Jerusalem to Alexandria and translated the Law into Greek, the origin story of the Septuagint. It is outside every canon of Scripture and is kept here for history and study. It is not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    print(f"spellings restored {sum(1 for x in log if x.startswith('spelling'))}; sections {len(sections)}, numbered blocks {len(sections[0]['blocks'])}, restored {sum(1 for x in log if x.startswith('restored'))}, gaps left {left}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
