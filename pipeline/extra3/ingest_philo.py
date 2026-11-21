"""Ingest Philo of Alexandria in C. D. Yonge's translation (London: H. G. Bohn, 1854-1855).

Usage:
  python3 -I pipeline/extra3/ingest_philo.py check   compare each candidate treatise with the Bohn scans
  python3 -I pipeline/extra3/ingest_philo.py         write library/jewish/philo/<slug>.toml for KEEP

Electronic text: CCEL philo/works.xml. That file is the 1993 Hendrickson "new updated edition" of
Yonge, which adds modern short titles, "Yonge's title" notes, editor notes, Loeb section numbers and
Greek transliteration, and in some treatises new translation or reordered material. This ingest:
  * takes only treatises with no new-translation or reorder note (see DROPPED for the rest),
  * strips every Hendrickson title note and editor note (EDITOR_NOTE),
  * undoes the file's systematic capitalization of the word before each footnote marker,
  * repairs double-encoded UTF-8 in the transliterations.
The check mode compares random sentences with the archive.org OCR of the four Bohn volumes
(cache/extra3/yonge{1,2,3,4}_djvu.txt).
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import collections
import difflib
import random
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import ccelwork  # noqa: E402
from common import fix_chars, order_notes, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402

CACHE = HERE.parent / "cache" / "extra3"
OUT = LIBRARY / "jewish" / "philo"
SOURCE = "philo.xml"
SCANS = [f"yonge{n}_djvu.txt" for n in (1, 2, 3, 4)]
SCAN_IDS = ["worksphilojudaeu01philuoft", "worksphilojudaeu02philuoft", "worksphilojudaeu03philuoft",
            "worksphilojudaeu04philuoft"]

# CCEL div id: (slug, title, short title, Yonge's title, summary)
TREATISES = {
    "iii.i": ("on-the-creation", "On the Creation", "Creation",
              "A Treatise on the Account of the Creation of the World, as Given by Moses",
              "Philo's reading of the six days of creation in Genesis 1 and 2, with his account of the "
              "intelligible world, the significance of numbers and the making of man."),
    "iii.ii": ("allegorical-interpretation-1", "Allegorical Interpretation, Book 1", "Allegorical Interpretation 1",
               "The First Book of the Treatise on the Allegories of the Sacred Laws",
               "An allegorical commentary on Genesis 2:1-17, reading the seventh day, the garden and its rivers "
               "as figures of the mind and the virtues."),
    "iii.iii": ("allegorical-interpretation-2", "Allegorical Interpretation, Book 2", "Allegorical Interpretation 2",
                "The Second Book of the Treatise on the Allegories of the Sacred Laws",
                "An allegorical commentary on Genesis 2:18-3:1, on the making of woman and the serpent, read as "
                "sense perception and pleasure."),
    "iii.iv": ("allegorical-interpretation-3", "Allegorical Interpretation, Book 3", "Allegorical Interpretation 3",
               "The Third Book of the Treatise on the Allegories of the Sacred Laws",
               "An allegorical commentary on Genesis 3:8-19, on Adam's hiding, the curse on the serpent and the "
               "contest between virtue and pleasure."),
    "iii.v": ("on-the-cherubim", "On the Cherubim", "Cherubim",
              "A Treatise on the Cherubim; and On the Flaming Sword; and On the First-Born Child of Man, Cain",
              "An allegorical commentary on Genesis 3:24 and 4:1, on the cherubim and the flaming sword at the "
              "gate of Eden and on the birth of Cain."),
    "iii.vii": ("the-worse-attacks-the-better", "That the Worse Is Wont to Attack the Better", "The Worse Attacks the Better",
                "A Treatise on the Principle that the Worse is Accustomed to be Always Plotting Against the Better",
                "An allegorical commentary on Genesis 4:8-15, reading Cain's murder of Abel as self-love attacking "
                "the love of God."),
    "iii.viii": ("on-the-posterity-of-cain", "On the Posterity of Cain and His Exile", "Posterity of Cain",
                 "A Treatise on the Posterity of Cain, the Man Wise in His own Conceit; and on the Way in Which Cain Became an Exile",
                 "An allegorical commentary on Genesis 4:16-25, on Cain's departure from the presence of God and "
                 "on his descendants."),
    "iii.ix": ("on-the-giants", "On the Giants", "Giants", "On the Giants",
               "A short commentary on Genesis 6:1-4, on the sons of God, the daughters of men and the giants, read "
               "as souls drawn toward or away from the body."),
    "iii.x": ("on-the-unchangeableness-of-god", "On the Unchangeableness of God", "Unchangeableness of God",
              "A Treatise on the Unchangeableness of God",
              "A commentary on Genesis 6:4-12 arguing that God does not change his mind, and explaining the "
              "language of Scripture that speaks of him as repenting."),
    "iii.xi": ("on-husbandry", "On Husbandry", "Husbandry", "A Treatise on the Tilling of the Earth by Noah",
               "A commentary on Genesis 9:20 contrasting the true husbandman with the mere worker of the soil, and "
               "the shepherd with the keeper of cattle and the horseman."),
    "iii.xii": ("on-noah-as-planter", "Concerning Noah's Work as a Planter", "Noah's Work as a Planter",
                "The Second Part of the Treatise about the Planting of Noah",
                "A continuation of the commentary on Genesis 9:20 on God as the planter of the world and on the "
                "planting of virtue in the soul."),
    "iii.xiii": ("on-drunkenness", "On Drunkenness", "Drunkenness", "A Treatise on Drunkenness",
                 "A commentary on Genesis 9:21, on the meanings of wine and drunkenness in Scripture, and on the "
                 "unsteadiness of human judgment."),
    "iii.xiv": ("on-sobriety", "On Sobriety", "Sobriety",
                "A Treatise on the Words that Noah Uttered When He Awoke from His Wine, or On Sobriety",
                "A commentary on Genesis 9:24-27, on Noah's waking from his wine and his blessing and curse on his "
                "sons."),
    "iii.xv": ("on-the-confusion-of-tongues", "On the Confusion of Tongues", "Confusion of Tongues",
               "A Treatise on the Confusion of Languages",
               "A commentary on Genesis 11:1-9, the tower of Babel, defending the passage against those who "
               "compared it to Greek myth and reading it as the confusion of the vices."),
    "iii.xvi": ("on-the-migration-of-abraham", "On the Migration of Abraham", "Migration of Abraham",
                "On the Migration of Abraham",
                "A commentary on Genesis 12:1-6, reading God's call of Abraham out of his land as the soul's "
                "departure from the body, the senses and speech."),
    "iii.xvii": ("who-is-the-heir", "Who Is the Heir of Divine Things", "Heir of Divine Things",
                 "A Treatise on the Question, Who is the Heir of Divine Things?",
                 "A commentary on Genesis 15:2-18, on Abraham's question about his heir, God's covenant and the "
                 "division of the sacrificial victims."),
    "iii.xviii": ("on-mating-with-the-preliminary-studies", "On Mating with the Preliminary Studies", "Preliminary Studies",
                  "A Treatise on the Meeting for the Sake of Seeking Instruction",
                  "A commentary on Genesis 16:1-6, reading Abraham's union with Hagar as the soul's training in "
                  "the general studies before it attains wisdom."),
    "iii.xix": ("on-flight-and-finding", "On Flight and Finding", "Flight and Finding", "A Treatise on Fugitives",
                "A commentary on Genesis 16:6-14, Hagar's flight and the angel at the well, on fleeing, finding and "
                "the cities of refuge."),
    "iii.xx": ("on-the-change-of-names", "On the Change of Names", "Change of Names",
               "A Treatise on the Question Why Certain Names in the Holy Scripture Are Changed",
               "A commentary on Genesis 17:1-22, on the names of God and on the renaming of Abram, Sarai and "
               "others."),
    "iii.xxi": ("on-dreams-1", "On Dreams, Book 1", "Dreams 1", "A Treatise on the Doctrine that Dreams Are Sent from God",
                "The first surviving book on dreams sent by God, treating Jacob's dreams of the ladder and of the "
                "flocks."),
    "iii.xxii": ("on-dreams-2", "On Dreams, Book 2", "Dreams 2", "On Dreams, Book 2",
                 "The second book on dreams, treating the dreams of Joseph, of Pharaoh's butler and baker and of "
                 "Pharaoh."),
    "iii.xxiii": ("on-abraham", "On Abraham", "Abraham",
                  "A Treatise on the Life of the Wise Man Made Perfect by Instruction or, On the Unwritten Law, That Is To Say, On Abraham",
                  "A life of Abraham as a living, unwritten law, preceded by accounts of Enos, Enoch and Noah, the "
                  "first triad of the righteous."),
    "iii.xxiv": ("on-joseph", "On Joseph", "Joseph",
                 "A Treatise of the Life of a Man Occupied with Affairs of State, or On Joseph",
                 "A life of Joseph as the model statesman, from his brothers' envy to his rule in Egypt, with an "
                 "allegorical reading of the story."),
    "iii.xxv": ("on-the-life-of-moses-1", "On the Life of Moses, Book 1", "Life of Moses 1",
                "A Treatise on the Life of Moses, that is to say, On the Theology and Prophetic Office of Moses, Book I",
                "The first book of Philo's life of Moses, from his birth and upbringing in Egypt through the exodus "
                "and the wilderness wanderings to the story of Balaam."),
    "iii.xxvii": ("on-the-decalogue", "On the Decalogue", "Decalogue",
                  "A Treatise Concerning the Ten Commandments, Which Are the Heads of the Law",
                  "An exposition of the Ten Commandments as the summary heads of the whole law, and of why God gave "
                  "them in the wilderness and in his own voice."),
    "iii.xxx": ("on-the-special-laws-3", "On the Special Laws, Book 3", "Special Laws 3",
                "A Treatise on Those Special Laws Which Are Referrible to Two Commandments in the Decalogue, the Sixth and Seventh",
                "An exposition of the laws grouped under the commandments against adultery and murder, on marriage, "
                "sexual conduct, homicide and assault."),
    "iii.xxxiv": ("every-good-man-is-free", "Every Good Man Is Free", "Every Good Man Is Free",
                  "A Treatise To Prove That Every Man Who is Virtuous is Also Free",
                  "A philosophical essay on the Stoic theme that only the virtuous man is truly free, with examples "
                  "that include the Essenes."),
    "iii.xxxvii": ("flaccus", "Flaccus", "Flaccus", "Against Flaccus",
                   "An account of the attacks on the Jews of Alexandria in 38 under the Roman prefect Aulus Avillius "
                   "Flaccus, and of his arrest, exile and death."),
    "iii.xxxviii": ("hypothetica", "Hypothetica", "Hypothetica", "Fragments of Lost Works",
                    "Fragments of a lost apology for the Jews preserved by Eusebius, describing the exodus, the laws "
                    "of Moses and the Essenes."),
    "iii.xxxix": ("on-providence-1", "On Providence, Fragment 1", "Providence 1", "Fragments of Lost Works",
                  "A short fragment on providence preserved by Eusebius, on the creation of matter."),
    "iii.xl": ("on-providence-2", "On Providence, Fragment 2", "Providence 2", "Fragments of Lost Works",
               "A fragment on providence preserved by Eusebius, answering objections that the wicked prosper and "
               "that nature's evils disprove providence."),
}

# Failed the first sample check (25 random sentences each) before the full correction; the CCEL
# wording differs from the Bohn scan by more than scan noise or transliteration.
FAILED_CHECK = {
    "iii.i": "On the Creation: 'dividing days and nights, of months and years' (Bohn: 'nights, months')",
    "iii.ix": "On the Giants: 'whether aquatic of terrestrial' (Bohn: 'or terrestrial')",
    "iii.xii": "Concerning Noah's Work as a Planter: 'the most supporting and firm foundation of the universe' "
               "(Bohn: 'the strong and lasting support'); 'there is placed the man' (Bohn: 'there he placed')",
    "iii.xv": "On the Confusion of Tongues: 'a slight foundation is being first laid' (Bohn: 'being first laid')",
    "iii.xvi": "On the Migration of Abraham: 'to also appear' (Bohn: 'also to appear'); 'the wicked man multitude' "
               "(Bohn: 'a mixed multitude')",
    "iii.xx": "On the Change of Names: 'O the man that thus thought worthy' (Bohn: 'O the man thus thought worthy')",
    "iii.xxii": "On Dreams, Book 2: 'characteristic of the wise man to go forth' (Bohn: 'of the one man')",
    "iii.xxiii": "On Abraham: 'the brother's son of a wise Abraham' (Bohn: 'of the wise Abraham')",
    "iii.xxv": "On the Life of Moses, Book 1: 'vast number of bodies' (Bohn: 'vast numbers of bodies')",
    "iii.xl": "On Providence, Fragment 2: 'as an act of relentless' (Bohn: 'as the act of relentless')",
}
# Held out until a two-scan correction restores the Bohn readings: their CCEL text carries 1993 wording.
HELD = {_did: TREATISES.pop(_did) for _did in FAILED_CHECK}

TREATISES["iii.xli"] = (
    "on-the-embassy-to-gaius", "On the Embassy to Gaius", "Embassy to Gaius",
    "A Treatise on the Virtues and on the Office of Ambassadors. Addressed to Caius",
    "Philo's account of the Alexandrian Jewish embassy he led to the emperor Gaius Caligula in 39 or 40, "
    "and of Gaius's attempt to set up his statue in the temple at Jerusalem. Yonge spells the emperor's name "
    "Caius, as here.")

# Left out, with the Hendrickson note that disqualifies each (new translation, or reordered material)
DROPPED = {
    "iii.vi": "On the Sacrifices of Abel and Cain: material reordered to the Loeb sequence",
    "iii.xxvi": "On the Life of Moses, Book 2: Yonge's separate treatise merged and reordered",
    "iii.xxviii": "On the Special Laws, Book 1: new 1993 translation and reordered material",
    "iii.xxix": "On the Special Laws, Book 2: new 1993 translation (10 notes) and reordered material",
    "iii.xxxi": "On the Special Laws, Book 4: Yonge's separate treatises merged and reordered",
    "iii.xxxii": "On the Virtues: reordered material",
    "iii.xxxiii": "On Rewards and Punishments: reordered material",
    "iii.xxxv": "On the Contemplative Life: reordered to the Loeb sequence",
    "iii.xxxvi": "On the Eternity of the World: reordered to the Loeb sequence",
}

EDITOR_NOTE = re.compile(r"^Yonge's|Yonge has|Loeb|Cohn|Wendland|publisher|reorder|this edition|this volume|"
                         r"newly translated|Hendrickson")

EDITION = ("C. D. Yonge, trans., The Works of Philo Judaeus, the Contemporary of Josephus, 4 vols. (London: "
           "H. G. Bohn, 1854-1855), {vol}; electronic text from CCEL (philo/works), checked against the archive.org "
           "scan of the Bohn edition ({scan})")
BASIS = ("Yonge's translation was published in London by H. G. Bohn in 1854-1855, before 1931, so it is in the "
         "public domain in the United States. The section numbering and the Greek transliteration follow the CCEL "
         "electronic text, which derives from a 1993 updated edition; that edition's added titles and editor notes "
         "are not included, and only treatises without its new translation or reordering are hosted.")

MOJIBAKE = [("â\x80\x94", "—"), ("Ì\x84", "̄"), ("Â̄", "̄"), ("Â", ""), ("\xa0", " ")]


def repair(t: str) -> str:
    for a, b in MOJIBAKE:
        t = t.replace(a, b)
    # a combining macron at the start of a word stands for a lost opening quote ("said, ̄Shall")
    t = re.sub(r"(^|\s)̄", r"\1‘", t)
    return unicodedata.normalize("NFC", t)


def vol_of(secs: list) -> int:
    """The Bohn volume whose scan holds this treatise (majority of sampled 8-word runs)."""
    vols = [" ".join(norm_words(re.sub(r"-\s*\n\s*", "", (CACHE / n).read_text(errors="replace")))) for n in SCANS]
    body = " ".join(b["text"] for s in secs for b in s["blocks"] if b["t"] == "p")
    w = norm_words(re.sub(r"\[\^[^\]]+\]|\*|\(\d+\)|\b[IVXLC]+\. ", " ", body))
    votes = collections.Counter()
    for k in range(0, max(1, len(w) - 8), max(1, len(w) // 40)):
        run = " ".join(w[k:k + 8])
        for i, v in enumerate(vols):
            if run in v:
                votes[i + 1] += 1
    return votes.most_common(1)[0][0]


# ---------------------------------------------------------------- reading the CCEL text

def raw_blocks(v, did: str) -> list:
    blocks = ccelwork.div_blocks(v, v.by_id[did])
    for b in blocks:
        b["text"] = repair(b["text"])
    return blocks


def yonge_title(v, did: str) -> str:
    """Yonge's own title, read from the 1993 edition's title note (the note itself is not kept)."""
    for b in raw_blocks(v, did):
        m = re.match(r"^Yonge's (?:full )?title, (.*)$", b["text"]) if b["t"] == "note" else None
        if m:
            t = re.split(r"; the mention|\. The publisher", m.group(1))[0]
            return fix_chars(t).rstrip(".")
    return ""


def mid_caps(v) -> collections.Counter:
    """Words seen capitalized mid-sentence (not before a note marker) across all kept treatises."""
    up, low = collections.Counter(), collections.Counter()
    for did in TREATISES:
        for b in raw_blocks(v, did):
            if b["t"] != "p":
                continue
            t = re.sub(r"\S+\[\^[^\]]+\]", " ", b["text"])
            for m in re.finditer(r"(?<=[a-z,;] )([A-Za-z][a-z]+)\b", t):
                w = m.group(1)
                (up if w[0].isupper() else low)[w.lower()] += 1
    return collections.Counter({w: up[w] - low[w] for w in up})


def decap(text: str, caps: collections.Counter) -> str:
    """Lowercase the word the CCEL file capitalized before each note marker, unless it is a word the
    text normally capitalizes mid-sentence (God, Lord, Israel, Moses)."""
    def rep(m):
        lead, w, tail = m.group(1), m.group(2), m.group(3)
        if re.search(r"[.?!][\"'’”]*\s*$", lead) or lead.strip() == "":
            return m.group(0)
        if w in ("I", "O") or caps.get(w.lower(), 0) > 0:
            return m.group(0)
        return f"{lead}{w.lower()}{tail}"
    return re.sub(r"((?:^|\S+)\s*[\"'‘“(]*)\b([A-Z][a-z]+)([.?!,;:)]*[\"'’”]*\s*\[\^)", rep, text)


def treatise(v, did: str, caps) -> list:
    blocks = raw_blocks(v, did)
    drop = {b["id"] for b in blocks if b["t"] == "note" and EDITOR_NOTE.search(b["text"])}
    out = []
    for b in blocks:
        if b["t"] == "note":
            if b["id"] in drop:
                continue
            b["text"] = fix_chars(b["text"])
            out.append(b)
            continue
        for nid in drop:
            b["text"] = b["text"].replace(f"[^{nid}]", "")
        if b["t"] == "p":
            b["text"] = decap(b["text"], caps)
        if b["t"] == "p" and re.fullmatch(r"PART \d", b["text"]):
            b = {"t": "h", "text": b["text"]}
        if b["t"] == "h":
            # the 1993 edition renumbered Yonge's "PART II" headings in arabic
            b["text"] = re.sub(r"\bPART (\d)\b", lambda m: "PART " + "I" * int(m.group(1)), b["text"])
        b["text"] = fix_chars(b["text"])
        out.append(b)
    # the first h is the 1993 short title; later h blocks "Giants.IV" mark Yonge's chapters
    secs, cur, held = [], None, []
    for b in out:
        if b["t"] == "h":
            m = re.match(r"^[A-Za-z0-9 ]+\.\s*([IVXLC]+)$", b["text"])
            if m:
                cur = {"roman": [m.group(1)], "blocks": held}
                held = []
                secs.append(cur)
                continue
            if cur is None:
                if b["text"].startswith("PART "):
                    held.append(b)  # Yonge's "PART I" before the first chapter
                continue  # leading title
        if cur is None:
            cur = {"roman": [], "blocks": []}
            secs.append(cur)
        cur["blocks"].append(b)
    return secs


def group(chapters: list, target: int = 3000) -> list:
    groups, g, n = [], None, 0
    for ch in chapters:
        w = section_words(ch["blocks"])
        if g is None or n >= target:
            g = {"roman": [], "blocks": []}
            groups.append(g)
            n = 0
        g["roman"] += ch["roman"]
        g["blocks"] += ch["blocks"]
        n += w
    if len(groups) > 1 and section_words(groups[-1]["blocks"]) < target / 3:
        tail = groups.pop()
        groups[-1]["roman"] += tail["roman"]
        groups[-1]["blocks"] += tail["blocks"]
    return groups


def roman_int(r: str) -> int:
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    total = 0
    for i, ch in enumerate(r):
        x = vals[ch]
        total += -x if i + 1 < len(r) and vals[r[i + 1]] > x else x
    return total


def sections_of(v, did: str, caps) -> list:
    groups = group(treatise(v, did, caps))
    secs = []
    for g in groups:
        r = g["roman"]
        if not r:
            title, sid = "Text", "text"
        elif len(r) == 1:
            title, sid = f"Chapter {r[0]}", f"chapter-{roman_int(r[0])}"
        else:
            title, sid = f"Chapters {r[0]}-{r[-1]}", f"chapters-{roman_int(r[0])}-{roman_int(r[-1])}"
        secs.append({"id": sid, "title": title, "level": 1, "blocks": order_notes(g["blocks"])})
    for s in secs:
        ccelwork.dedupe_notes(s)
    assert len({s["id"] for s in secs}) == len(secs), did
    return secs


# ---------------------------------------------------------------- check against the Bohn scans

def norm_words(t: str) -> list[str]:
    t = t.lower().replace("’", "'")
    return re.sub(r"[^a-z ]", "", re.sub(r"\s+", " ", t)).split()


def scan_index():
    text = "".join((CACHE / n).read_text(errors="replace") for n in SCANS)
    words = norm_words(re.sub(r"-\s*\n\s*", "", text))
    cnt = collections.Counter(tuple(words[k:k + 6]) for k in range(len(words) - 6))
    idx = {tuple(words[k:k + 6]): k for k in range(len(words) - 6) if cnt[tuple(words[k:k + 6])] == 1}
    return words, idx


OCR_SWAPS = [("li", "h"), ("ii", "n"), ("ii", "u"), ("rn", "m"), ("vv", "w"), ("tl", "th"), ("c", "e"), ("u", "n"),
             ("t", "f"), ("b", "h"), ("o", "e"), ("v", "y"), ("j", "i"), ("r", "t"), ("a", "o"), ("cl", "d")]


def ocr_like(a: str, b: str) -> bool:
    """True when b is a plausible misreading of a (common scan letter confusions)."""
    a, b = a.replace(" ", ""), b.replace(" ", "")
    if a == b:
        return True
    for x, y in OCR_SWAPS:
        b = b.replace(x, y) if len(a) != len(b) or x != y else b
    if a == b:
        return True
    return len(a) <= 5 and len(b) <= 6 and difflib.SequenceMatcher(None, a, b).ratio() >= 0.5 and a[:1] in b[:2] + a[:1]


def compare(sentence: str, words, idx):
    w = norm_words(sentence)
    pos = None
    for k in range(len(w) - 6):
        if tuple(w[k:k + 6]) in idx:
            pos = idx[tuple(w[k:k + 6])] - k
            break
    if pos is None:
        return None
    seg = words[max(0, pos - 3):pos + len(w) * 2 + 40]
    real = []
    sm = difflib.SequenceMatcher(None, w, seg, autojunk=False)
    ops = [op for op in sm.get_opcodes()]
    # the window runs past the sentence: trailing inserts are other text
    for t, a, b, c, e in ops:
        if t in ("equal", "insert"):
            continue
        A, B = " ".join(w[a:b]), " ".join(seg[c:e])
        if difflib.SequenceMatcher(None, A.replace(" ", ""), B.replace(" ", "")).ratio() >= 0.6:
            continue  # scan noise or a split word
        if ocr_like(A, B):
            continue
        if t == "replace" and len(seg[c:e]) > len(w[a:b]) + 6:
            # footnote or running head interleaved: is the CCEL text inside the inserted run?
            if " ".join(w[a:b]) in " ".join(seg[c:e]):
                continue
        if t == "replace" and len(seg[c:e]) > len(w[a:b]) + 6 and ocr_like(w[a], seg[e - len(w[a:b])]):
            continue  # inserted footnote or running head, then the same word in scan noise
        real.append((A, B[:120], " ".join(seg[max(0, c - 6):e + 6])[:300]))
    return real


def check(n_sent: int = 25) -> int:
    v = ccelwork.load(SOURCE)
    caps = mid_caps(v)
    words, idx = scan_index()
    rng = random.Random(1854)
    for did, info in TREATISES.items():
        paras = [b["text"] for s in sections_of(v, did, caps) for b in s["blocks"] if b["t"] == "p"]
        body = " ".join(paras)
        body = re.sub(r"\[\^[^\]]+\]|\*|\(\d+\)|\b[IVXLC]+\. ", " ", body)
        sents = [s for s in re.split(r"(?<=[.;?!])\s+", body) if len(s.split()) >= 14]
        sample = rng.sample(sents, min(n_sent, len(sents)))
        stats = collections.Counter()
        flags = []
        for s in sample:
            r = compare(s, words, idx)
            if r is None:
                stats["unanchored"] += 1
            elif r:
                stats["flagged"] += 1
                flags.append((s[:140], r))
            else:
                stats["same"] += 1
        print(f"{did:11} {info[0]:40} {dict(stats)}")
        for s, r in flags:
            print(f"    FLAG {s}")
            for x in r[:4]:
                print(f"         {x[0]!r} -> {x[1]!r}\n           scan: {x[2]}")
    return 0


# ---------------------------------------------------------------- write

def write() -> int:
    v = ccelwork.load(SOURCE)
    m = meta(SOURCE)
    caps = mid_caps(v)
    for i, (did, (slug, title, short, ytitle, summary)) in enumerate(TREATISES.items()):
        secs = sections_of(v, did, caps)
        vol = vol_of(secs)
        found = yonge_title(v, did)
        yt = f" Yonge's title: {found}." if found else ""
        if ytitle == "Fragments of Lost Works":
            yt = " Yonge printed it among his Fragments of Lost Works."
        work = {
            "id": f"philo-{slug}", "title": title, "short_title": short, "author": "philo", "collection": "jewish",
            "order": 10 + i, "date": "c. 20-50", "language": "Greek", "translator": "C. D. Yonge",
            "edition": EDITION.format(vol=f"vol. {['I', 'II', 'III', 'IV'][vol - 1]}",
                                      scan=f"archive.org {SCAN_IDS[vol - 1]}"),
            "source_url": m["url"], "source_sha256": m["sha256"], "retrieved": m["retrieved"],
            "license": "Public domain", "license_basis": BASIS, "summary": summary + yt,
        }
        p = write_work(OUT / f"{slug}.toml", work, secs)
        print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections, "
              f"{sum(section_words(s['blocks']) for s in secs)} words")
    return 0


if __name__ == "__main__":
    sys.exit(check() if sys.argv[1:] == ["check"] else write())
