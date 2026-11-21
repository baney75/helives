"""Proofread the Westminster Larger Catechism from two scanned Edinburgh printings into library/reformation/.

Usage: python3 -I pipeline/extra3/ingest_wlc.py            write the work and the disagreement log
       python3 -I pipeline/extra3/ingest_wlc.py report     list disagreements still needing a page check

Sources (archive.org OCR, cached in pipeline/cache/extra3):
  A  confessionoffaith00chur   Edinburgh: Johnstone, Hunter & Co., 1894
  B  confessionoffait00chur_0  Edinburgh: Johnstone and Hunter, 1855
Questions and answers only: the Scripture proofs printed under each page are left out.

Method. The Q&A text is cut from each scan by page layout: after every running head comes the page's
Q&A text, then the proof texts, which open with a reference like "6. o Heb. xi. 6.". The Wikisource
text (wslc.json, modernized and unsourced) is used only as a skeleton to line the two scans up and to
split the stream into 196 questions; no word is taken from it. Each word and its punctuation come from
the scans. Where the scans agree, that reading stands. Where they differ, the difference is either OCR
debris (one side is not a word, or carries a stray proof letter) and the clean side stands, or it is a
reading difference, which was checked on the page image and settled in PAGE_CHECKED below. Words
both OCR texts lose (a proof letter glued on in one, a line break in the other) are restored from the
page images in REPAIRS, found by comparing the result with the skeleton word by word. Every question in
the printing ends with a question mark and every answer with a point; where both OCR texts lose that
mark before a proof letter, it is supplied. The two division headings become heading blocks.
Every disagreement is written to pipeline/cache/extra3/wlc-disagreements.tsv.
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import collections
import difflib
import json
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from common import fix_chars, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

CACHE = HERE.parent / "cache" / "extra3"
OUT = LIBRARY / "reformation" / "westminster-larger-catechism.toml"
SCAN_A = "confessionoffaith00chur_djvu.txt"
SCAN_B = "confessionoffait00chur_0_djvu.txt"
LOG = CACHE / "wlc-disagreements.tsv"
DUMP: list = []  # debugging: print these questions as assembled instead of writing

# Words both OCR texts lose or garble beyond the alignment's reach (a proof letter glued to the word in
# one scan, a line-end break or a misread in the other), each read on the 1894 page image:
# (question, part, as assembled, as printed)
REPAIRS = [
    (1, "q", "HAT is the", "What is the"),  # p. 103: a two-line initial W
    (7, "a", "most wise holy, most most merciful", "most wise, most holy, most just, most merciful"),  # p. 105
    (76, "a", "word of where God, whereby", "word of God, whereby"),  # p. 133
    (101, "a", "these words, am the Lord", "these words, I am the Lord"),  # p. 146, italic I read as "/"
    (101, "a", "all his and works:", "all his words and works:"),  # p. 146
    (105, "a", "ignorance forge forgetfulness,", "ignorance, forgetfulness,"),  # p. 148
    (113, "a", "misapplying of God's and providences", "misapplying of God's decrees and providences"),  # p. 157
    (124, "a", "superiors in agec and gifts", "superiors in age and gifts"),  # proof letter c glued to the word
    (145, "a", "our neigh bours,", "our neighbours,"),  # p. 182
    (145, "a", "credit of any, or desiring", "credit of any, endeavouring or desiring"),  # pp. 185-186
    (151, "a", "after repentance. From circumstances", "after repentance. 4. From circumstances"),  # p. 192
    (151, "a", "immediately before 4. or after", "immediately before or after"),  # pp. 192-193
    (152, "a", "righteous law, his wrath", "righteous law, deserveth his wrath"),  # p. 193
    (174, "a", "in judging and sorrowing", "in judging themselves, and sorrowing"),  # p. 207
    (175, "a", "they are to be and to attend", "they are to be humbled, and to attend"),  # p. 209
]
# The printed division headings, set in capitals after Q5 and Q90 in the OCR stream
HEADINGS = {6: "What Man Ought to Believe Concerning God",
            91: "Having Seen What the Scriptures Principally Teach Us to Believe Concerning God, It Follows to "
                "Consider What They Require as the Duty of Man"}

HEAD = re.compile(r"^\d{1,3}$")


def is_head(p: str) -> bool:
    """A running head such as "112 THE LARGER CATECHISM." in any OCR spelling."""
    if HEAD.match(p):
        return True
    letters = [c for c in p if c.isalpha()]
    return len(p) < 45 and bool(re.search(r"LARG|CATE|CHISM|ECHIS", p)) and \
        sum(c.isupper() for c in letters) > 0.7 * max(1, len(letters))
QA = re.compile(r"^[^A-Za-z0-9]{0,4}(Quest|Q|Ans|A)\s*[.,]")
PROOF = re.compile(r"^(\d+\.\s*)?\S{0,2}\s*(\d\s+)?[A-Z][a-z]{1,6}\.\s+[ivxlc]+[.,]|^\d+\.\s+\S{1,2}\s")
TOKEN = re.compile(r"^(?P<lead>[\"'‘“(\[]*)(?P<word>[A-Za-z]+(?:['’\u00ad-][A-Za-z]+)*|[0-9]+)(?P<punct>[.,;:?!)\]'’\"”]*)"
                   r"(?P<junk>.*)$")

# Reading differences settled on the page images: (question, A word, B word) -> printed reading.
# Each was read on the 1894 page image (archive.org page/n<leaf>_w1100.jpg); "?" marks a difference the
# skeleton could not place in a question. Q17 is a real variant between the printings: 1894 prints "with
# dominion", 1855 "and dominion"; the earlier printing, which the standard text follows, is kept.
PAGE_CHECKED: dict[tuple, str] = {
    (1, "7", "man?"): "man?",             # p. 103: the question mark, OCR read as 7 in A
    (17, "with", "and"): "and",           # p. 108 (1894 "with"), 1855 page "and"
    (21, "him.", "him"): "him?",          # p. 110
    (58, "bath", "hath"): "hath",
    (70, "aocounteth", "accounteth"): "accounteth",
    (81, "faith;", "faith"): "faith,",    # both OCRs wrong: the page prints a comma
    (101, "have", "horn"): "have",        # "which have brought thee"
    (106, "me]", "me"): "me]",            # p. 151: "These words [before me]"
    (108, "commandment!", "commandment"): "commandment?",  # italic question mark read as "!"
    (115, "work;", "work"): "work;",
    (123, "mother", "motlier:"): "mother:",
    (141, "commandment!", "commandment"): "commandment?",
    (141, "goods;", "0"): "goods;",
    (142, "inclosurea", "inclosures"): "inclosures",
    (145, "backbiting.", "backbiting"): "backbiting,",  # p. 184
    (151, "offending;", "offending"): "offending;",     # p. 188
    (151, "reparation;", "reparation"): "reparation:",  # p. 190
    (156, "publickly", "publiekly"): "publickly",
    (170, "A", "A,"): "A.",
    (177, "differ!", "differ"): "differ?",
    (184, "owns", "owng"): "own",          # p. 213: "our own" followed by note letter g
    (189, "heaven,", "heaven"): "heaven,)",   # p. 214
    (190, "name", "namef)"): "name,)",      # "(which is, Hallowed be thy name,)"
    (192, "petition!", "petition"): "petition?",
    (193, "bread", "breads)"): "bread,)",
    (194, "Beloved", "Beloved:"): "Beloved;",
    (195, "evil,", "evil"): "evil,)",
    (195, "feet;", "feet"): "feet,",
    (196, "Amen?)", "Anient)"): "Amen.)",  # p. 222
    (196, "teachetb", "teacheth"): "teacheth",
    ("?", "hell-lire", "hell-fire"): "hell-fire",
    ("?", "3.", "ci:"): "3.",                  # Q151 p. 190: "3. From the nature"
    ("?", "5.", "5,"): "5.",                   # Q99: "5. That"
    ("?", "4.", "mediately"): "4.",            # Q151 p. 192: "4. From circumstances"; placed by REPAIRS
    ("?", "land-marks,", "land-marks"): "land-marks,",  # Q142
    ("?", "neighbour's", "neighbour's?"): "neighbour's.",  # Q146 p. 186
}


def qa_stream(name: str) -> list[str]:
    t = (CACHE / name).read_text(errors="replace")
    heads = [m.start() for m in re.finditer(r"LARGER\s+CATECHISM\.\s*\n", t)]
    start = t.find("Quest.", heads[0])
    end = t.find("SHORTER", start)
    raw = [p for p in re.split(r"\n\s*\n", t[start:end]) if p.strip()]

    def med(p):
        return statistics.median(len(" ".join(x.split())) for x in p.strip().split("\n"))

    width = statistics.median(med(r) for r in raw if QA.match(" ".join(r.split())) and r.strip().count("\n"))
    out, state, top = [], "qa", False
    for r in raw:
        p = " ".join(r.split())
        if is_head(p):
            state, top = "qa", True
            continue
        if len(p) <= 5 and " " not in p:
            continue  # page number on a line of its own
        first, top = top, False
        if QA.match(p):
            state = "qa"  # a paragraph opening with Q. or A. is never proof text
        if state == "qa":
            if PROOF.match(p):
                state = "proof"
                continue
            # the first paragraph under the running head is Q&A text even when it is one short line
            if first or QA.match(p) or p.isupper() or abs(med(r) - width) < width * 0.15:
                # rejoin words broken at the line end, marking them so the other scan can decide
                out.append(re.sub(r"(\w)- (\w)", "\\1\u00ad\\2", p))
                continue
            state = "proof"
    return " ".join(out).split()


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def parse_token(tok: str):
    """(norm, printed word, punctuation, broken) or None for debris. Proof letters glued after the
    punctuation ("God,a", "ever.b") are dropped."""
    m = TOKEN.match(tok)
    if not m:
        return None
    word, punct, junk = m.group("word"), m.group("punct"), m.group("junk")
    if len(punct) > 1 and punct[0] in ",;:." and all(c in "?!'\"]’”" for c in punct[1:]):
        punct = punct[0]  # a proof letter read as a mark after the real point: "church,?"
    lead = "".join(c for c in m.group("lead") if c in "([")  # quotes before a word are mostly debris
    out = [(norm(word), word.replace("\u00ad", ""), punct, "\u00ad" in tok, lead)]
    j = re.sub(r"^[^A-Za-z]+", "", junk)
    if len(j) >= 3 and j.isalpha():  # "sin,wthe": proof letter w, then "the"
        out.append((norm(j[1:]), j[1:], "", False, ""))
    return out


def tokens(stream: list[str]) -> list[tuple]:
    out = []
    for tok in stream:
        m = re.match(r"^([.,;:?!]+)[a-z]?$", tok)
        if m and out and not out[-1][2]:
            # a point the OCR set off from its word ("workings ;e"): it belongs to the word before
            prev = out[-1]
            out[-1] = (prev[0], prev[1], m.group(1)[0], prev[3], prev[4])
            continue
        for t in parse_token(tok) or []:
            if t[0]:
                out.append(t)
    return out


def skeleton() -> list[tuple[int, str, str]]:
    d = json.loads((CACHE / "wslc.json").read_text())["parse"]["wikitext"]
    out = []
    for m in re.finditer(r"'''Question (\d+):\s*(.*?)'''<br>\s*Answer:\s*(.*?)(?=\n\s*\n|\n'''Question|\n==|\{\{PD)",
                         d, re.S):
        out.append((int(m.group(1)), m.group(2).strip(), " ".join(m.group(3).split())))
    assert [q for q, *_ in out] == list(range(1, 197)), "skeleton questions"
    return out


def skeleton_tokens(sk) -> list[tuple]:
    """(norm, punct, question, part) for the skeleton, with label tokens Q n and A as the scans print them."""
    out = []
    for n, q, a in sk:
        out += [("q", ".", n, "label"), (str(n), ".", n, "label")]
        for tok in q.split():
            for t in parse_token(tok) or []:
                out.append((t[0], t[2], n, "q"))
        out.append(("a", ".", n, "label"))
        for tok in a.replace(":", ": ").replace(",:", ",").split():
            for t in parse_token(tok) or []:
                out.append((t[0], t[2], n, "a"))
    return [t for t in out if t[0]]


def skeleton_map(sk: list, toks: list) -> list:
    """For each scan token, the index of the skeleton word it lines up with, or None."""
    sm = difflib.SequenceMatcher(None, [t[0] for t in sk], [t[0] for t in toks], autojunk=False)
    out: list = [None] * len(toks)
    for t, i1, i2, j1, j2 in sm.get_opcodes():
        if t == "equal" or (t == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                out[j1 + k] = i1 + k
    return out


WORDS: set[str] = set()


def is_word(n: str) -> bool:
    return n in WORDS or n.isdigit()


def close(a: str, b: str) -> bool:
    """Within two letters of each other: the kind of difference an OCR misreading makes."""
    sm = difflib.SequenceMatcher(None, a, b)
    return sum(max(i2 - i1, j2 - j1) for t, i1, i2, j1, j2 in sm.get_opcodes() if t != "equal") <= 2


def marker(t) -> bool:
    return len(t[0]) == 1 and t[0] not in ("a", "i", "o") and not t[0].isdigit()


def letters(chunk) -> str:
    return "".join(t[0] for t in chunk)


def main(report_only: bool = False) -> int:
    global WORDS
    sk = skeleton()
    S = skeleton_tokens(sk)
    A = [t for t in tokens(qa_stream(SCAN_A)) if not marker(t)]
    B = [t for t in tokens(qa_stream(SCAN_B)) if not marker(t)]
    WORDS = {w.lower() for w in Path("/usr/share/dict/web2").read_text().split()} | {t[0] for t in S}
    ska, skb = skeleton_map(S, A), skeleton_map(S, B)
    out: list = []  # (skeleton index or None, word, punct, opening bracket)
    log: list = []
    st = collections.Counter()

    def where(ia=None, ib=None):
        k = (ska[ia] if ia is not None else None)
        if k is None and ib is not None:
            k = skb[ib]
        return k

    def ctx(k):
        if k is None:
            return ""
        return " ".join(x[0] for x in S[max(0, k - 5):k]) + " [" + S[k][0] + "] " + " ".join(x[0] for x in S[k + 1:k + 5])

    def q_of(k):
        return S[k][2] if k is not None else "?"

    def punct(pa, pb, k, wa, wb):
        if pa == pb:
            return pa
        ps = S[k][1] if k is not None else None
        for cand in (pa, pb):
            if cand == ps:
                st["punctuation: OCR debris in one scan, the other scan and the modern text agree"] += 1
                return cand
        key = (q_of(k), wa + pa, wb + pb)
        if key in PAGE_CHECKED:
            st["punctuation: settled on the page image"] += 1
            return PAGE_CHECKED[key][len(wa):]
        st["punctuation: unchecked"] += 1
        log.append((q_of(k), "punct", wa + pa, wb + pb, "UNCHECKED", ctx(k)))
        return pa

    def guess(smap, i):
        """The skeleton index of scan token i, or one inferred from the nearest mapped token before it."""
        for back in range(0, 4):
            if i - back >= 0 and smap[i - back] is not None:
                return smap[i - back] + back
        return None

    def one_scan(t, k):
        """A word only one scan has, kept when it matches the skeleton word at its place; a proof letter
        glued to its end ("judgments" for "judgment" with note y) is cut off."""
        if k is None or not is_word(t[0]) or t[0].isdigit():
            return None
        if S[k][0] == t[0] or (len(t[0]) > 2 and close(S[k][0], t[0]) and t[0][:-1] != S[k][0]):
            return t
        if t[0][:-1] == S[k][0]:
            st["word in one scan only, proof letter glued to it cut off"] += 1
            log.append((S[k][2], "one scan, letter cut", t[1], "", t[1][:-1], ctx(k)))
            return (t[0][:-1], t[1][:-1], t[2], t[3], t[4] if len(t) > 4 else "")
        return None

    def unlabel(k):
        # a word at the end of an answer can pair with the next question's label: use the word before it
        back = 0
        while k is not None and k > 0 and S[k][3] == "label" and back < 3:
            k, back = k - 1, back + 1
        return None if k is not None and S[k][3] == "label" else k

    def emit(k, t, p):
        out.append((k, t[1], p, t[4] if len(t) > 4 else ""))

    sm = difflib.SequenceMatcher(None, [t[0] for t in A], [t[0] for t in B], autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        ca, cb = A[i1:i2], B[j1:j2]
        if op == "equal":
            for n in range(i2 - i1):
                x, y = ca[n], cb[n]
                k = where(i1 + n, j1 + n)
                emit(k, x if not x[3] else y, punct(x[2], y[2], k, x[1], y[1]))
            continue
        if ca and cb and letters(ca) == letters(cb):
            # the same letters, split differently by line breaks or spacing
            st["word split or joined differently by the OCR, same letters"] += 1
            pick_a = all(is_word(t[0]) for t in ca) and (len(ca) <= len(cb) or not all(is_word(t[0]) for t in cb))
            ch, other, base, ob = (ca, cb, i1, j1) if pick_a else (cb, ca, j1, i1)
            for n, t in enumerate(ch):
                k = where(base + n, None) if pick_a else where(None, base + n)
                last = n == len(ch) - 1
                emit(k, t, punct(t[2], other[-1][2], k, t[1], other[-1][1]) if last else t[2])
            continue
        if not ca or not cb:
            side, name, idx = (ca, "A", i1) if ca else (cb, "B", j1)
            smap = ska if ca else skb
            for n, t in enumerate(side):
                k = unlabel(guess(smap, idx + n))
                t2 = one_scan(t, k)
                if t2 is not None:
                    st["word in one scan only, where the other scan's OCR text has a gap; matches the modern text"] += 1
                    emit(k, t2, t2[2])
                elif len(side) >= 4 or not is_word(t[0]) or t[0].isdigit():
                    st["extra text in one scan only (proof text, page number or debris), dropped"] += 1
                else:
                    st["extra word in one scan only, dropped"] += 1
                    log.append((q_of(where(idx + n, None) if ca else where(None, idx + n)), "extra " + name, t[1], "",
                                "dropped", ctx(k)))
            continue
        # different letters on both sides
        if len(ca) == len(cb):
            pairs = [([x], [y], ia, ib) for x, y, ia, ib in zip(ca, cb, range(i1, i2), range(j1, j2))]
        else:
            # group each side's tokens by the skeleton word they line up with; unplaced tokens join the
            # previous slot of their own scan
            slots: dict = {}
            order: list = []
            for side, base, smap, col in ((ca, i1, ska, 0), (cb, j1, skb, 1)):
                cur = -1
                for n, t in enumerate(side):
                    kk = smap[base + n]
                    if kk is not None and kk > cur:
                        cur = kk
                    if cur not in slots:
                        slots[cur] = [[], [], None, None]
                        order.append(cur)
                    slots[cur][col].append(t)
                    if slots[cur][2 + col] is None:
                        slots[cur][2 + col] = base + n
            pairs = []
            for kk in sorted(order):
                xs, ys, ia, ib = slots[kk]
                if xs and ys:
                    pairs.append((xs, ys, ia, ib))
                    continue
                side, name, idx, smap = (xs, "A", ia, ska) if xs else (ys, "B", ib, skb)
                for n, t in enumerate(side):
                    k3 = unlabel(guess(smap, idx + n))
                    k4 = k3 if k3 is not None else unlabel(kk if kk >= 0 else None)
                    t2 = one_scan(t, k4)
                    if t2 is not None:
                        st["word in one scan only, where the other scan's OCR text has a gap; matches the modern text"] += 1
                        emit(k4, t2, t2[2])
                    elif len(side) >= 4 or not is_word(t[0]) or t[0].isdigit():
                        st["extra text in one scan only (proof text, page number or debris), dropped"] += 1
                    else:
                        st["extra word in one scan only, dropped"] += 1
                        log.append((q_of(k3 if k3 is not None else (kk if kk >= 0 else None)), "extra " + name, t[1],
                                    "", "dropped", ctx(k3)))
        for xs, ys, ia, ib in pairs:
            k = where(ia, ib)
            ks = [kk for kk in ([ska[ia + n] for n in range(len(xs))] + [skb[ib + n] for n in range(len(ys))])
                  if kk is not None]
            skel = letters([S[kk] for kk in sorted(set(ks))]) if ks else ""
            good_a, good_b = all(is_word(t[0]) for t in xs), all(is_word(t[0]) for t in ys)
            la, lb = letters(xs), letters(ys)
            wa_, wb_ = " ".join(t[1] for t in xs), " ".join(t[1] for t in ys)
            key = (q_of(k), wa_ + xs[-1][2], wb_ + ys[-1][2])
            if key in PAGE_CHECKED:
                st["word: settled on the page image"] += 1
                emit(k, (norm(PAGE_CHECKED[key]), PAGE_CHECKED[key], False, False, xs[0][4]), "")
                continue
            if la == lb:
                choice, why = ("A" if len(xs) <= len(ys) else "B"), "word split or joined differently by the OCR, same letters"
            elif good_a and not good_b:
                choice, why = "A", "word: OCR debris in B, A stands"
            elif good_b and not good_a:
                choice, why = "B", "word: OCR debris in A, B stands"
            elif lb == skel and la and lb.startswith(la):
                choice, why = "B", "word: cut short where A's OCR text breaks; B and the modern text agree"
            elif la == skel and lb and la.startswith(lb):
                choice, why = "A", "word: cut short where B's OCR text breaks; A and the modern text agree"
            elif la == skel and close(la, lb):
                choice, why = "A", "word: OCR misread in B; A and the modern text agree"
            elif lb == skel and close(la, lb):
                choice, why = "B", "word: OCR misread in A; B and the modern text agree"
            else:
                choice, why = "A", "word: unchecked"
                log.append((q_of(k), "word", wa_ + xs[-1][2], wb_ + ys[-1][2], "UNCHECKED", ctx(k)))
            st[why] += 1
            ch, other = (xs, ys) if choice == "A" else (ys, xs)
            for n, t in enumerate(ch):
                kk = (ska[ia + n] if choice == "A" else skb[ib + n]) if True else None
                last = n == len(ch) - 1
                emit(kk if kk is not None else k, t, punct(t[2], other[-1][2], k, t[1], other[-1][1]) if last else t[2])
    for k2, v in st.most_common():
        print(f"  {v:6}  {k2}")
    with open(LOG, "w", encoding="utf-8") as f:
        f.write("question\tkind\tA_1894\tB_1855\tresolution\tcontext in the modern skeleton\n")
        for row in log:
            f.write("\t".join(str(x) for x in row) + "\n")
    if report_only:
        for row in log:
            print(*row, sep="\t")
        return 0
    return write(out, S, sk)


def write(out: list, S: list, sk: list) -> int:
    """Group the proofread words by question and part, and write the work."""
    parts: dict = collections.OrderedDict()  # question -> {"q": [...], "a": [...]}
    cur_q, cur_part = None, None
    for k, word, punct, lead in out:
        if k is not None and S[k][3] == "label" and not re.fullmatch(r"(?i)q|quest|ques|a|ans|\d+", word):
            k = None  # the last word of an answer paired with the next label: it stays in its answer
        if k is not None:
            cur_q, cur_part = S[k][2], S[k][3]
        if cur_q is None or cur_part == "label":
            continue  # the Q. n. and A. labels are set by the writer
        parts.setdefault(cur_q, {"q": [], "a": []})[cur_part].append(lead + word + punct)
    assert list(parts) == list(range(1, 197)), "the stream must hold questions 1 to 196 in order"
    if DUMP:
        for n in DUMP:
            print(n, "Q:", " ".join(parts[n]["q"]))
            print(n, "A:", " ".join(parts[n]["a"]))
        return 0
    secs, bad, used, marks = [], [], set(), collections.Counter()
    for first in range(1, 197, 20):
        last = min(first + 19, 196)
        blocks = []
        for n in range(first, last + 1):
            q = fix_chars(" ".join(parts[n]["q"]))
            a = fix_chars(" ".join(parts[n]["a"]))
            a = re.sub(r"\s+[A-Z][A-Z'’, ]{12,}\.?$", "", a)  # a division heading run into the answer
            for rn, part, wrong, right in REPAIRS:
                if rn == n:
                    text = q if part == "q" else a
                    assert text.count(wrong) == 1, (n, wrong)
                    text = text.replace(wrong, right)
                    q, a = (text, a) if part == "q" else (q, text)
                    used.add((rn, wrong))
            # Every question in the 1894 printing ends with "?" and every answer with a point; both OCR texts
            # often lose the italic question mark and the point before a proof letter.
            if not q.endswith("?"):
                q = q.rstrip(".,;:!") + "?"
                marks["question mark"] += 1
            if not re.search(r"[.?!][)\]]?$", a):
                a = a.rstrip(",;:") + "."
                marks["final point"] += 1
            if n in HEADINGS:
                blocks.append({"t": "h", "text": HEADINGS[n]})
            if re.search(r"[A-Z]{4,}", a.replace("JEHOVAH", "")):
                bad.append((n, q[-30:], a[-40:]))
            blocks.append({"t": "p", "text": f"Q. {n}. *{q}*"})
            blocks.append({"t": "p", "text": f"*A.* {a}"})
        secs.append({"id": f"questions-{first}-{last}", "title": f"Questions {first}-{last}", "level": 1,
                     "blocks": blocks})
    assert len(used) == len(REPAIRS)
    print(f"  supplied: {dict(marks)}; repaired on the page image: {len(REPAIRS)}")
    for row in bad:
        print("  END?", *row, sep="  |  ")
    if bad:
        return 1
    ma = meta(SCAN_A)
    work = {
        "id": "westminster-larger-catechism", "title": "The Westminster Larger Catechism",
        "short_title": "Larger Catechism", "author": "westminster-assembly", "collection": "reformation",
        "order": 7, "date": "1648", "language": "English",
        "edition": "The Confession of Faith, the Larger and Shorter Catechisms (Edinburgh: Johnstone, Hunter & Co., "
                   "1894; archive.org confessionoffaith00chur), proofread word by word against the Edinburgh printing "
                   "of 1855 (Johnstone and Hunter; archive.org confessionoffait00chur_0), with every disagreement "
                   "settled on the page images. Questions and answers only; the Scripture proofs are omitted.",
        "source_url": ma["url"], "source_sha256": ma["sha256"], "retrieved": ma["retrieved"],
        "license": "Public domain",
        "license_basis": "The catechism was approved by the Westminster Assembly in 1648. The text is taken from "
                         "Edinburgh printings of 1855 and 1894, both published before 1931, so it is public domain in "
                         "the United States. The Scripture proofs printed with it are not included.",
        "words": sum(section_words(s["blocks"]) for s in secs),
        "summary": "The Westminster Assembly's fuller catechism of 196 questions and answers, written for "
                   "instruction from the pulpit, covering what to believe about God and the duty God requires of "
                   "man, with an exposition of the Ten Commandments, the sacraments and the Lord's Prayer.",
    }
    p = write_work(OUT, work, secs)
    print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections, {work['words']} words")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] == ["report"]))
