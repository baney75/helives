"""Ingest Reformation confessions and catechisms from Schaff, The Creeds of Christendom, Vol. III.

Usage: python3 -I pipeline/extra3/ingest_reformation.py [slug ...]
Reads pipeline/cache/extra3/creeds3.xml (CCEL ThML; fetch with fetch.py) and writes
library/reformation/<slug>.toml with the English text only. Schaff's own bracketed editorial
introductions are left out; his notes on the English text are kept.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import schaff  # noqa: E402
from common import order_notes, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from libtoml import LIBRARY, slugify, words_in, write_work  # noqa: E402

OUT = LIBRARY / "reformation"
SRC = "creeds3.xml"
EDITION = ("Philip Schaff, The Creeds of Christendom, with a History and Critical Notes, Vol. III: The "
           "Evangelical Protestant Creeds (New York: Harper & Brothers, 1877); text as reprinted in the "
           "sixth edition (1919), CCEL digitization")
BASIS = ("Published 1877 in the United States (Harper & Brothers); the CCEL file reproduces the sixth "
         "edition of 1919, also published in the United States before 1931")
SMALL = {"a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to",
         "unto", "with", "his", "her", "their", "our", "its", "upon"}


def plain(t: str) -> str:
    t = re.sub(r"\[\^[^\]]+\]", "", t).replace("*", "")
    return " ".join(t.split()).strip()


def titlecase(t: str) -> str:
    letters = [c for c in t if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.9:
        return t
    words = t.lower().split(" ")
    out = []
    for i, w in enumerate(words):
        if i and w in SMALL:
            out.append(w)
        elif re.fullmatch(r"[ivxlc]+\.?", w) and w.rstrip(".") not in ("i",) or w.rstrip(".") in ("ii", "iii", "iv", "vi"):
            out.append(w.upper())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def roman(t: str) -> str:
    m = re.search(r"\b([IVXLC]+|\d+)\b", plain(t))
    return m.group(1) if m else ""


def stream(div: str, pick=None, start: str | None = None, stop: str | None = None,
           editorial: tuple = ()) -> list:
    """English blocks of a document. `editorial` lists opening words of Schaff's own bracketed
    introductions inside the range, which are left out."""
    v = schaff.load(SRC)
    blocks = schaff.english(v, div, pick)
    if start:
        k = next(i for i, b in enumerate(blocks) if b["t"] != "note" and re.search(start, plain(b["text"])))
        blocks = blocks[k:]
    if stop:
        k = next(i for i, b in enumerate(blocks) if b["t"] != "note" and re.search(stop, plain(b["text"])))
        blocks = blocks[:k]
    out, dropped = [], []
    for b in blocks:
        t = b["text"]
        if b["t"] == "p" and any(plain(t).startswith(e) for e in editorial):
            dropped.append(t)
            continue
        out.append(b)
    for t in dropped:
        print(f"   dropped editorial: {t[:90]}")
    # notes whose reference went with a dropped block
    refs = set(re.findall(r"\[\^([^\]]+)\]", " ".join(b["text"] for b in out if b["t"] != "note")))
    return [b for b in out if b["t"] != "note" or b["id"] in refs]


def fold_labels(blocks: list, rx: str) -> list:
    """Turn centered labels such as "Question 1." and "Answer." into bold lead-ins of the next paragraph."""
    out, pending = [], None
    for b in blocks:
        if b["t"] == "h" and re.fullmatch(rx, plain(b["text"])):
            pending = b["text"].replace("**", "").replace("*", "")
            continue
        if pending and b["t"] == "p":
            lab = re.sub(r"(\[\^[^\]]+\])", "", pending).strip()
            marks = "".join(re.findall(r"\[\^[^\]]+\]", pending))
            b = dict(b, text=f"**{lab}**{marks} {b['text']}")
            pending = None
        out.append(b)
    assert pending is None
    return out


def sectionize(blocks: list, rules: list, merge_subtitles: bool = True, front: str = "") -> list:
    """rules: list of (regex, level). A heading matching a rule opens a section titled by it; headings
    right after it (before any paragraph) that match no rule join the title."""
    secs: list = []
    cur = None
    fresh = False
    for b in blocks:
        if b["t"] == "h":
            pt = plain(b["text"])
            rule = next((lvl for rx, lvl in rules if re.search(rx, pt)), None)
            if rule is not None:
                cur = {"title": titlecase(pt.rstrip(".,")), "level": rule, "blocks": [], "_h": [b], "raw": pt}
                secs.append(cur)
                fresh = True
                continue
            if cur is not None and fresh and merge_subtitles:
                cur["title"] = cur["title"] + ". " + titlecase(pt.rstrip(".,"))
                cur["raw"] = cur["raw"] + " " + pt
                cur["_h"].append(b)
                continue
        if cur is None:
            if not front:
                raise ValueError(f"text before first section: {b['text'][:80]}")
            cur = {"title": front, "level": 1, "blocks": [], "_h": [], "raw": ""}
            secs.append(cur)
        if b["t"] != "note":
            fresh = False
        cur["blocks"].append(b)
    for s in secs:
        hs = s.pop("_h")
        s.setdefault("raw", "")
        if any("[^" in h["text"] for h in hs):
            s["blocks"] = [{"t": "h", "text": " ".join(h["text"] for h in hs)}] + s["blocks"]
    return secs


def pack(secs: list, level: int, target: int, noun: str) -> list:
    """Merge runs of consecutive sections at `level` into groups of about `target` words. Each merged
    unit keeps its title as an h block; the group is titled "<noun> <first>-<last>"."""
    out, run = [], []

    def flush():
        if not run:
            return
        groups, g, n = [], [], 0
        for s in run:
            w = section_words(s["blocks"])
            if g and n + w > target:
                groups.append(g)
                g, n = [], 0
            g.append(s)
            n += w
        if g:
            groups.append(g)
        for g in groups:
            a, b = roman(g[0]["title"]), roman(g[-1]["title"])
            title = f"{noun} {a}-{b}" if a != b else g[0]["title"]
            blocks = []
            for s in g:
                if len(g) > 1:
                    blocks.append({"t": "h", "text": s["title"]})
                blocks.extend(x for x in s["blocks"] if not (len(g) > 1 and x["t"] == "h" and plain(x["text"]) == s["title"]))
            out.append({"title": title, "level": level, "blocks": blocks})
        run.clear()

    for s in secs:
        if s["level"] == level and roman(s["title"]):
            run.append(s)
        else:
            flush()
            out.append(s)
    flush()
    return out


def merge_front(secs: list, limit: int = 60) -> list:
    """Fold a short title-page section (a heading or two) into the start of the next section."""
    if len(secs) > 1 and section_words(secs[0]["blocks"]) < limit:
        front = secs.pop(0)
        raw = front.get("raw") or ""
        head = [{"t": "h", "text": raw}] if raw else []
        if front["blocks"] and front["blocks"][0]["t"] == "h":
            head = []
        secs[0]["blocks"] = head + front["blocks"] + secs[0]["blocks"]
        secs[0]["level"] = 1
    return secs


def split_questions(sec: dict, target: int) -> list:
    """Split a catechism section into question ranges of about `target` words; text after the last
    question that opens with a heading becomes its own section."""
    qrx = re.compile(r"^\**(?:Question|Ques)\.?\**\s*(\d+)\.")
    groups, cur, n = [], [], 0
    tail = []
    seen_q = False
    for b in sec["blocks"]:
        m = qrx.match(b["text"]) if b["t"] == "p" else None
        if tail or (seen_q and b["t"] == "h"):
            tail.append(b)
            continue
        if m:
            seen_q = True
            if cur and n >= target:
                groups.append(cur)
                cur, n = [], 0
        cur.append(b)
        if b["t"] != "note":
            n += words_in(b["text"])
    if cur:
        groups.append(cur)
    out = []
    for g in groups:
        qs = [qrx.match(b["text"]).group(1) for b in g if b["t"] == "p" and qrx.match(b["text"])]
        out.append({"title": f"Questions {qs[0]}-{qs[-1]}", "level": 1, "blocks": g})
    if tail:
        out.append({"title": plain(tail[0]["text"]).rstrip("."), "level": 1, "blocks": tail[1:]})
    return out


def finalize(secs: list) -> list:
    seen: set[str] = set()
    for s in secs:
        s.pop("raw", None)
        s["title"] = re.sub(r"^Part\. ", "Part ", s["title"])  # "Part. IV." in the source
        base = slugify(s["title"])[:60].strip("-") or "section"
        sid, k = base, 2
        while sid in seen:
            sid, k = f"{base}-{k}", k + 1
        seen.add(sid)
        s["id"] = sid
        s["blocks"] = order_notes(s["blocks"])
        if not s["blocks"]:
            s["blocks"] = [{"t": "h", "text": s["title"]}]
    return secs


# ---------------------------------------------------------------- the documents

def augsburg():
    b = stream("iii.ii", start=r"^Confession of Faith$")
    b = [x for x in b if not (x["t"] == "h" and plain(x["text"]) == "Confession of Faith")]
    secs = sectionize(b, [(r"^Preface to the Emperor", 1),
                          (r"^Part (First|Second)\.$", 1), (r"^Art\. [IVX]+\.", 2), (r"^Conclusion\.$", 1)],
                      front="Title")
    secs = merge_front(secs)
    k = next(i for i, x in enumerate(secs) if x["title"].startswith("Part Second"))
    return pack(secs[:k], 2, 2500, "Articles") + secs[k:]


def small_catechism():
    b = stream("iii.iii", start=r"^Dr\. Martin Luther's$")
    return merge_front(sectionize(b, [(r"^Dr\. Martin Luther's$", 1), (r"^Part\.? [IVX]+\.?$", 1),
                          (r"^HOW THE UNLEARNED", 1)]))


def heidelberg():
    b = stream("iv.vi")
    b = fold_labels(b, r"(Question \d+|Answer)\.")
    return sectionize(b, [(r"^THE (FIRST|SECOND|THIRD) PART\.$", 1)], front="Questions 1 and 2")


def belgic():
    b = stream("iv.viii", start=r"^The Confession of Faith$")
    secs = sectionize(b, [(r"^The Confession of Faith$", 1), (r"^Art\. [IVXL]+\.?$", 1)])
    return merge_front(pack(secs, 1, 2500, "Articles"))


def dort():
    b = stream("iv.xvi", start=r"^The Canons of the Synod of Dort,?$", editorial=("[We append the English text",))
    return merge_front(sectionize(b, [(r"^The Canons of the Synod of Dort", 1), (r"HEADS? OF DOCTRINE\.$", 1),
                                      (r"^Conclusion\.$", 1)]))


def westminster_confession():
    def pick(cells):
        return cells[: len(cells) // 2]
    b = stream("iv.xvii.ii", pick=pick, start=r"^Chapter I\.$")
    return sectionize(b, [(r"^Chapter [IVXL]+\.?$", 1)])


def westminster_shorter():
    b = stream("iv.xviii", pick=lambda c: [c[0]], start=r"^The Shorter Catechism\.$")
    secs = sectionize(b, [(r"^The Shorter Catechism", 1)])
    assert len(secs) == 1
    out = split_questions(secs[0], 1300)
    assert out[-1]["title"] == "The Ten Commandments", out[-1]["title"]
    out[-1]["title"] = "The Ten Commandments, the Lord's Prayer and the Creed"
    return out


def thirty_nine():
    # Schaff's three columns: Latin 1562, English 1571, American revision 1801. The English of 1571 is
    # used; the edition's closing table of articles and imprint are left out.
    b = stream("iv.xi", pick=lambda c: [c[1]] if len(c) == 3 else [c[0]], start=r"^I\.$",
               stop=r"^\[A Table of the Articles")
    secs = sectionize(b, [(r"^[IVXL]+\.$", 1), (r"^The Ratification\.?$", 1)])
    return pack(secs, 1, 1500, "Articles")


WORKS = {
    "augsburg-confession": dict(
        fn=augsburg, title="The Augsburg Confession", short="Augsburg Confession", author="lutheran-church",
        order=1, date="1530", language="Latin and German", translator="Charles P. Krauth (1868, revised 1874)",
        summary="The confession of faith presented by the Lutheran princes and cities to Emperor Charles V at "
                "the Diet of Augsburg in 1530, written chiefly by Philip Melanchthon, in Krauth's English "
                "translation with Schaff's notes."),
    "luther-small-catechism": dict(
        fn=small_catechism, title="Luther's Small Catechism", short="Small Catechism", author="luther",
        order=2, date="1529", language="German", translator="",
        summary="Martin Luther's brief catechism for households on the Ten Commandments, the Creed, the "
                "Lord's Prayer, Baptism, Confession and the Lord's Supper, in the English Schaff prints."),
    "heidelberg-catechism": dict(
        fn=heidelberg, title="The Heidelberg Catechism", short="Heidelberg Catechism", author="reformed-churches",
        order=4, date="1563", language="German", translator="",
        summary="The catechism of the Reformed church of the Palatinate, prepared at Heidelberg in 1563, in 129 "
                "questions and answers on misery, redemption and thankfulness, in the English Schaff prints."),
    "belgic-confession": dict(
        fn=belgic, title="The Belgic Confession", short="Belgic Confession", author="reformed-churches",
        order=5, date="1561, revised 1619", language="French", translator="",
        summary="The confession of the Reformed churches of the Netherlands, first written by Guido de Brès in "
                "1561 and revised at the Synod of Dort in 1619, in thirty-seven articles."),
    "canons-of-dort": dict(
        fn=dort, title="The Canons of the Synod of Dort", short="Canons of Dort", author="reformed-churches",
        order=6, date="1618-1619", language="Latin", translator="",
        summary="The Synod of Dort's judgment on the five points raised by the Remonstrants, on predestination, "
                "the death of Christ, conversion and perseverance. This English text, from the Reformed Church "
                "in America as printed by Schaff, gives the positive articles only, without the rejection of "
                "errors."),
    "westminster-confession": dict(
        fn=westminster_confession, title="The Westminster Confession of Faith", short="Westminster Confession",
        author="westminster-assembly", order=7, date="1646-1647", language="English", translator="",
        summary="The confession of faith drawn up by the Westminster Assembly of Divines and presented to "
                "Parliament in 1646 and 1647, in thirty-three chapters, with Schaff's notes on the American "
                "alterations."),
    "westminster-shorter-catechism": dict(
        fn=westminster_shorter, title="The Westminster Shorter Catechism", short="Shorter Catechism",
        author="westminster-assembly", order=8, date="1647", language="English", translator="",
        summary="The Westminster Assembly's catechism of 107 questions and answers for the instruction of the "
                "young, beginning \"What is the chief end of man?\""),
    "thirty-nine-articles": dict(
        fn=thirty_nine, title="The Thirty-Nine Articles of Religion", short="Thirty-Nine Articles",
        author="church-of-england", order=9, date="1563, English text 1571", language="Latin and English",
        translator="",
        summary="The doctrinal articles of the Church of England, agreed in Convocation in 1562 and published in "
                "English in 1571, given here in the English text of 1571 with its original spelling."),
}


def main(argv: list[str]) -> int:
    if not argv or "luther-large-catechism" in argv:
        print("luther-large-catechism")
        large_catechism()
    m = meta(SRC)
    for slug, cfg in WORKS.items():
        if argv and slug not in argv:
            continue
        print(slug)
        secs = finalize(cfg["fn"]())
        work = {
            "id": slug, "title": cfg["title"], "short_title": cfg["short"], "author": cfg["author"],
            "collection": "reformation", "order": cfg["order"], "date": cfg["date"], "language": cfg["language"],
            "translator": cfg["translator"], "edition": EDITION, "source_url": m["url"], "source_sha256": m["sha256"],
            "retrieved": m["retrieved"], "license": "Public domain", "license_basis": BASIS, "summary": cfg["summary"],
        }
        p = write_work(OUT / f"{slug}.toml", work, secs)
        print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections, "
              f"{sum(section_words(s['blocks']) for s in secs)} words")
    return 0



# ---------------------------------------------------------------- Luther's Large Catechism (Triglot)

LC_EDITION = ("Martin Luther, The Large Catechism, trans. F. Bente and W. H. T. Dau, in Triglot Concordia: "
              "The Symbolical Books of the Ev. Lutheran Church (St. Louis: Concordia Publishing House, 1921); "
              "CCEL digitization (luther/largecatechism)")
LC_BASIS = "Published 1921 in the United States (Concordia Publishing House, St. Louis), before 1931"


def large_catechism() -> int:
    import ccelwork
    name = "largecatechism.xml"
    v = ccelwork.load(name)
    root = v.by_id["i"]
    secs = ccelwork.walk(v, root, 1, [], skip=lambda el: el.get("id") == "i_1")
    secs = ccelwork.finalize(secs)
    for s in secs:
        s["title"] = re.sub(r"\bOF THE CREED\b", "Of the Creed", s["title"])
        s["title"] = re.sub(r"\bOF (PRAYER|BAPTISM|THE SACRAMENT OF THE ALTAR)\b", lambda m: titlecase(m.group(0)), s["title"]).rstrip(".")
        s["blocks"] = order_notes(s["blocks"])
    m = meta(name)
    work = {
        "id": "luther-large-catechism", "title": "Luther's Large Catechism", "short_title": "Large Catechism",
        "author": "luther", "collection": "reformation", "order": 3, "date": "1529", "language": "German",
        "translator": "F. Bente and W. H. T. Dau", "edition": LC_EDITION, "source_url": m["url"],
        "source_sha256": m["sha256"], "retrieved": m["retrieved"], "license": "Public domain",
        "license_basis": LC_BASIS,
        "summary": "Luther's fuller instruction for pastors and heads of households on the Ten Commandments, the "
                   "Creed, the Lord's Prayer, Baptism and the Lord's Supper. This text begins with the Short "
                   "Preface; Luther's longer preface of 1530 is not included.",
    }
    p = write_work(OUT / "luther-large-catechism.toml", work, secs)
    print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
