"""Ingest Philo of Alexandria in C. D. Yonge's translation (London: H. G. Bohn, 1854-1855).

Usage:
  python3 -I pipeline/extra3/ingest_philo.py check   print each treatise's residual differences from the Bohn scans
  python3 -I pipeline/extra3/ingest_philo.py         write library/jewish/philo/<slug>.toml for each treatise that passes

Electronic text: CCEL philo/works.xml. That file is the 1993 Hendrickson "new updated edition" of
Yonge, which adds modern short titles, "Yonge's title" notes, editor notes, Loeb section numbers and
Greek transliteration, and in some treatises new translation or reordered material. This ingest:
  * takes only treatises with no new-translation or reorder note (see DROPPED for the rest),
  * strips every Hendrickson title note and editor note (EDITOR_NOTE),
  * undoes the file's systematic capitalization of the word before each footnote marker,
  * repairs double-encoded UTF-8 in the transliterations.
Every treatise is corrected word by word against two archive.org OCR scans of the four Bohn volumes
(cache/extra3/yonge{1,2,3,4}_djvu.txt and yongeB{1,2,3,4}_djvu.txt), then compared with both scans again.
A treatise with any difference left that is not OCR noise, or with too much text that could not be
compared, is held: not written, its old file removed, and the reason recorded in philo-gate.tsv.
The check mode prints those residual differences without writing.
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import collections
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

# These ten failed the first sample check (25 random sentences each): the CCEL text carried 1993
# Hendrickson wording where the Bohn scans differ. The full two-scan correction (correct() and MANUAL)
# restores the Bohn reading; pipeline/tests/test_philo_scope.py checks each pair below in the library.
# treatise: [(1993 reading, Bohn reading), ...]
FAILED_CHECK = {
    "iii.i": [("dividing days and nights, of months and years", "days and nights, months and years")],
    "iii.ix": [("whether aquatic of terrestrial", "whether aquatic or terrestrial")],
    "iii.xii": [("the most supporting and firm foundation of the universe",
                 "the strong and lasting support of the universe"),
                ("there is placed the man", "there he placed the man")],
    "iii.xv": [("a slight foundation is being first laid", "a slight foundation being first laid")],
    "iii.xvi": [("to also appear", "also to appear"), ("the wicked man multitude", "the wicked man a mixed multitude")],
    "iii.xx": [("O the man that thus thought worthy", "O the man thus thought worthy")],
    "iii.xxii": [("characteristic of the wise man to go forth", "characteristic of the one man to go forth")],
    "iii.xxiii": [("the brother's son of a wise Abraham", "the brother's son of the wise Abraham")],
    "iii.xxv": [("vast number of bodies", "vast numbers of bodies")],
    "iii.xl": [("as an act of relentless", "as the act of relentless")],
}

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
           "H. G. Bohn, 1854-1855), {vol}; electronic text from CCEL (philo/works), corrected word by word to the "
           "Bohn wording against two archive.org scans of that edition ({scan} and {scan_b}). After correction "
           "every span of four or more words matches the scans except where they show OCR noise; {pct}% of "
           "the words (spans under four words) were not compared")
BASIS = ("Yonge's translation was published in London by H. G. Bohn in 1854-1855, before 1931, so it is in the "
         "public domain in the United States. The section numbering and the Greek transliteration follow the CCEL "
         "electronic text, which derives from a 1993 updated edition; where that edition's wording differs from the "
         "Bohn scans, the Bohn reading is restored, and a treatise is hosted only when a second comparison with "
         "both scans finds no remaining difference other than OCR noise in every span of four or more words; "
         "shorter spans are not compared (the edition note gives their share). Its added titles and editor notes are not "
         "included, and only treatises without its new translation or reordering are hosted.")

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


# ---------------------------------------------------------------- scan words

def norm_words(t: str) -> list[str]:
    t = t.lower().replace("’", "'")
    return re.sub(r"[^a-z ]", "", re.sub(r"\s+", " ", t)).split()


# ---------------------------------------------------------------- full correction against two scans

SCANS_B = [f"yongeB{n}_djvu.txt" for n in (1, 2, 3, 4)]
SCAN_B_IDS = ["worksofphilojuda01yonguoft", "worksofphilojuda02yonguoft", "theworksofphiloj03yonguoft",
              "theworksofphiloj04yonguoft"]
JUNK = {"philo", "judaeus", "judus", "judseus", "judeus", "genesis", "exodus", "leviticus", "deuteronomy",
        "psalm", "ibid", "vol", "see", "cf"}
CORRECTIONS = CACHE / "philo-corrections.tsv"
# Readings from the first sample check that the automated pass cannot take (a footnote inside the
# sentence, a break in one scan's OCR, or a reworded sentence), read from both scans by hand.
MANUAL = [
    ("iii.xii", "But it is the eternal law of the everlasting God which is the most supporting and firm foundation of "
     "the universe.", "But the eternal law of the everlasting God is the strong and lasting support of the universe."),
    ("iii.xii", "and there is placed the man whom he has made", "and there he placed the man whom he has made"),
    ("iii.xv", "a slight foundation is being first laid", "a slight foundation being first laid"),
    ("iii.xvi", "the soul of the wicked man multitude", "the soul of the wicked man a mixed multitude"),
    ("iii.xxv", "from such vast number of bodies", "from such vast numbers of bodies"),
    # typos in the CCEL text at a page break of the scan
    ("iii.iii", "ought to be birded", "ought to be girded"),
    ("iii.xix", "Of thiscompany Jacob", "Of this company Jacob"),
]
TRACE: list = []  # debugging: print the decision for every difference in sentences containing these


def scans():
    import scancheck
    a = scancheck.Scan([CACHE / n for n in SCANS])
    b = scancheck.Scan([CACHE / n for n in SCANS_B])
    return a, b


def vocabulary(v) -> set[str]:
    import scancheck
    words = scancheck.load_words(Path("/usr/share/dict/web2"))
    words = {x for x in words if len(x) >= 5}  # short dictionary words include OCR debris (bo, mose)
    for did in list(TREATISES) + list(DROPPED):
        for blk in raw_blocks(v, did):
            words |= {t[0] for t in scancheck.tokens(blk["text"])}
    return words | {"caius"}  # Yonge's spelling, replaced throughout by the 1993 edition


SHAPES = str.maketrans("bcoulta", "heenife")  # letters OCR and worn type confuse


def shape(x: str) -> str:
    return x.replace("rn", "m").replace("cl", "d").replace("li", "h").translate(SHAPES)


def refuse(old: list, alt: list, caps: list, vocab: set, agreed: bool = False) -> str:
    """Why a scan reading is not taken as a correction, or "" when it is. agreed: the other scan reads
    the same words here. The look-alike and dropped-letter tests guard against OCR misreading one scan;
    when both scans agree on a real word ("those" for "these", "number" for "numbers") the Bohn reading
    is taken."""
    if len(old) > 3 or len(alt) > 3 or (not old and len(alt) > 1) or (not alt and len(old) > 1):
        return "long span"
    if any(caps):
        return "running head"
    for x in alt:
        if x in JUNK or (len(x) == 1 and x != "a") or (re.fullmatch(r"[ivxlc]+", x) and x not in ("ill", "civil")):
            return "scan noise"
        if x not in vocab:
            return "not a word"
    if not alt and len(old[0]) == 1:
        return "scan noise"  # O and I read as digits
    if len(old) == 1 and len(alt) == 1 and not agreed:
        o, n = old[0], alt[0]
        if len(n) == len(o) - 1 and any(o[:k] + o[k + 1:] == n for k in range(len(o))):
            return "dropped letter"  # a misprint or broken type in the 1854 printing, e.g. "he measure"
        if shape(o) == shape(n):
            return "look-alike letters"
    return ""


def printed(raw: list, old: list, seps: list | None = None) -> str:
    """The scan's words as printed (so proper names keep their capitals). Where consecutive scan words
    spell one CCEL word they are joined as Bohn printed them: with a hyphen when the scan has one between
    them ("allaccomplished" in CCEL, "all-accomplished" in Bohn), else with a space ("forever" in CCEL,
    "for ever" in Bohn). seps[k] is the scan text before raw[k]."""
    words = [r.lower() if r.isupper() and len(r) > 1 else r for r in raw]
    seps = seps if seps is not None else ["-"] * len(raw)
    out, k = [], 0
    while k < len(words):
        for m in range(len(words), k + 1, -1):
            if scancheck_norm("".join(words[k:m])) in old:
                out.append(words[k] + "".join(("-" if "-" in seps[x] else " ") + words[x] for x in range(k + 1, m)))
                k = m
                break
        else:
            out.append(words[k])
            k += 1
    return " ".join(out)


def scancheck_norm(x: str) -> str:
    import scancheck
    return scancheck.norm(x)


def correct(secs: list, did: str, a, b, vocab: set, log: list) -> dict:
    """Take the Bohn reading wherever both scans agree on clean dictionary words that differ from the
    CCEL text. Returns counts; appends one row per correction to log."""
    import scancheck
    st = collections.Counter()
    for sec in secs:
        for blk in sec["blocks"]:
            if blk["t"] not in ("p", "q", "note"):
                continue
            text = blk["text"]
            edits = []
            for sa, sb in scancheck.sentences(text):
                sent = text[sa:sb]
                toks = scancheck.tokens(sent)
                w = [t[0] for t in toks]
                ra = a.align(w)
                if ra is None:
                    st["unanchored"] += len(w)
                    continue
                start_a = a.start
                ops_a, seg_a = ra
                rb = b.align(w)
                ops_b = {(o[1], o[2]): rb[1][o[3]:o[4]] for o in rb[0]} if rb else {}
                # Differences closer together than three matching words form one cluster ("to also appear"
                # against "also to appear" is a delete and an insert). A cluster needs firm ground: three
                # matching words on each side (or the sentence edge), so a footnote or verse quotation that
                # sits inside the sentence at a page break cannot pair stray words like "of the" across it.
                # A running head the scan carries inside the sentence is page furniture: it neither joins
                # nor breaks a cluster, and the matching words around it count together.
                def furniture(o):
                    seg = seg_a[o[3]:o[4]]
                    return o[0] == "insert" and (any(a.caps[start_a + o[3]:start_a + o[4]]) or seg[0] in JUNK)
                eqrun = {}  # op index -> matching words in its run, furniture skipped
                run, members = 0, []
                for m, o in enumerate(ops_a + [("delete", 0, 0, 0, 0)]):
                    if m < len(ops_a) and (o[0] == "equal" or furniture(o)):
                        run += o[2] - o[1]
                        members.append(m)
                        continue
                    for mm in members:
                        eqrun[mm] = run
                    run, members = 0, []
                clusters, cur = [], []
                for m, o in enumerate(ops_a):
                    if m in eqrun:
                        if eqrun[m] >= 3 and cur:
                            clusters.append(cur)
                            cur = []
                    else:
                        cur.append(m)
                if cur:
                    clusters.append(cur)

                def ground(m):
                    return m < 0 or m >= len(ops_a) or eqrun.get(m, 0) >= 3
                for cl in clusters:
                    m0, m1 = cl[0], cl[-1]
                    firm = ground(m0 - 1) and ground(m1 + 1)
                    # several differences together, or a reworded phrase, need matching words on both sides,
                    # not the sentence edge, where the anchor window can pair it with the sentence before
                    strict = all(0 <= x < len(ops_a) and eqrun.get(x, 0) >= 3 for x in (m0 - 1, m1 + 1))
                    if len(cl) > 1 and not strict:
                        firm = False
                    span_w = ops_a[m1][2] - ops_a[m0][1]
                    span_s = ops_a[m1][4] - ops_a[m0][3]
                    # a reworded phrase in the 1993 text: a replacement on both sides, confirmed by both scans,
                    # clean dictionary words and no page break near it, up to 12 words
                    phrase = (strict and span_w and span_s and span_s <= 12 and span_w <= 12
                              and not any(a.caps[max(0, start_a + ops_a[m0][3] - 8):start_a + ops_a[m1][4] + 8])
                              and all(x in vocab and x not in JUNK for x in seg_a[ops_a[m0][3]:ops_a[m1][4]])
                              and all(ops_b.get((ops_a[m][1], ops_a[m][2])) == seg_a[ops_a[m][3]:ops_a[m][4]]
                                      for m in cl))
                    whys, picks = [], []
                    for m in cl:
                        t, i1, i2, j1, j2 = ops_a[m]
                        alt = seg_a[j1:j2]
                        caps = a.caps[start_a + j1:start_a + j2]
                        why = refuse(w[i1:i2], alt, caps, vocab, agreed=ops_b.get((i1, i2)) == alt)
                        if why == "long span" and phrase:
                            why = ""
                        if not why and not firm:
                            why = "near page break" if any(
                                a.caps[max(0, start_a + j1 - 8):start_a + j2 + 8]) else "weak alignment"
                        if not why and not phrase and len(cl) > 1 and (span_w > 6 or span_s > 6):
                            why = "long span"
                        if not why and ((t == "insert" and i1 in (0, len(w))) or (t == "delete" and (i1 == 0 or i2 == len(w)))):
                            why = "edge"
                        if not why and i2 - i1 > 1 and sent[toks[i1][1]:toks[i2 - 1][2]].count(" ") != i2 - i1 - 1:
                            why = "punctuation inside"
                        if not why and any(c in sent[toks[k][1]:toks[k][2]] for k in range(i1, i2) for c in "'’"):
                            why = "apostrophe"
                        if not why and ops_b.get((i1, i2)) != alt:
                            why = "unconfirmed"
                        if TRACE and any(x in sent for x in TRACE):
                            print(f"TRACE {did} {w[i1:i2]} -> {alt} B={ops_b.get((i1, i2))}: {why or 'taken'}")
                        whys.append(why)
                        nxt = a.raw[start_a + j2] if start_a + j2 < len(a.raw) else ""
                        picks.append((sa, toks, i1, i2, a.raw[start_a + j1:start_a + j2], nxt,
                                      a.seps[start_a + j1:start_a + j2]))
                    # A cluster is taken whole or not at all, except that an unreadable scan word ("not a word",
                    # "scan noise") in a single-difference cluster only keeps the CCEL word in its own place. In a
                    # cluster of several differences ("to also appear" against "also to appear"), taking the rest
                    # would leave a reading that matches neither edition.
                    local = ("not a word", "scan noise") if len(cl) == 1 else ()
                    bad = [x for x in whys if x and x not in local]
                    if bad:
                        st[bad[0]] += len(cl)
                        continue
                    for why, pick in zip(whys, picks):
                        if why:
                            st[why] += 1
                        else:
                            edits.append(pick)
            # apply right to left
            for sa, toks, i1, i2, alt, nxt, seps in sorted(edits, key=lambda e: (e[0], e[2], e[3] > e[2]), reverse=True):
                if i1 < i2:
                    start, end = sa + toks[i1][1], sa + toks[i2 - 1][2]
                    old = text[start:end]
                    new = printed(alt, [t[0] for t in toks[i1:i2]], seps)
                    if old[:1].isupper():
                        new = new[:1].upper() + new[1:]
                    if not alt:  # Bohn lacks the word: drop it with one space
                        if end < len(text) and text[end] == " ":
                            end += 1
                        elif start > 0 and text[start - 1] == " ":
                            start -= 1
                else:
                    start = end = sa + toks[i1][1]
                    old, new = "", printed(alt, []) + " "
                    # Bohn opens with the inserted word ("He here calls"): take the scan's case for the next word
                    k2 = sa + toks[i1][1]
                    if nxt[:1].islower() and text[k2:k2 + 1].isupper() and new[:1].isupper():
                        text = text[:k2] + text[k2].lower() + text[k2 + 1:]
                ctx = text[max(0, start - 40):end + 40].replace("\t", " ")
                text = text[:start] + new + text[end:]
                log.append((did, sec["id"], old, new.strip(), ctx))
                st["corrections"] += 1
            blk["text"] = re.sub(r"  +", " ", text)
    return st


def match_rate(secs: list, a) -> tuple[int, int, int]:
    """Words in sentences found in scan A, and of those the words equal to the scan."""
    import scancheck
    found = eq = total = 0
    for sec in secs:
        for blk in sec["blocks"]:
            if blk["t"] not in ("p", "q"):
                continue
            for sa, sb in scancheck.sentences(blk["text"]):
                w = [t[0] for t in scancheck.tokens(blk["text"][sa:sb])]
                total += len(w)
                r = a.align(w)
                if r is None:
                    continue
                found += len(w)
                eq += sum(i2 - i1 for t, i1, i2, j1, j2 in r[0] if t == "equal")
    return eq, found, total


# ---------------------------------------------------------------- residual check and publication gate

def reading(ops, i1: int, i2: int) -> list:
    """Indices into the aligned scan segment of the words aligned with w[i1:i2] (an insertion point when
    i1 == i2)."""
    out = []
    for t, a1, a2, c1, c2 in ops:
        if t == "insert":
            if (i1 == i2 and a1 == i1) or i1 < a1 < i2:
                out += range(c1, c2)
        elif a1 < i2 and a2 > i1:
            if t == "equal":
                lo, hi = max(a1, i1), min(a2, i2)
                out += range(c1 + lo - a1, c1 + hi - a1)
            else:
                out += range(c1, c2)
    return out


def unreadable(x: str, vocab: set) -> bool:
    """A scan word that fails the vocabulary check (or is a roman numeral or a stray letter)."""
    return (x not in vocab or (len(x) == 1 and x not in ("a", "i", "o"))
            or (re.fullmatch(r"[ivxlc]+", x) is not None and x not in ("ill", "civil", "i")))


BOOKS = {"genesis", "exodus", "leviticus", "numbers", "deuteronomy", "psalm", "psalms", "isaiah", "jeremiah",
         "proverbs", "joshua", "judges", "kings", "samuel", "deut", "gen", "exod", "levit", "numb"}


def furniture(x: str) -> bool:
    """A scan token that is never a word of the text: a stray letter (a footnote dagger read as t, f or j)
    or a roman numeral (chapter and citation numbers)."""
    return (len(x) == 1 and x not in ("a", "i", "o")) or (
        re.fullmatch(r"[ivxlc]+", x) is not None and x not in ("i", "ill", "civil"))


def body_words(words: list, caps: list) -> tuple[list, bool]:
    """A reading without its page furniture: words set in capitals (running heads), stray letters, roman
    numerals, a book name citing a chapter ("Genesis vi"), and JUNK words next to other furniture.
    Returns the rest and whether anything was removed."""
    n = len(words)
    drop = [bool(caps[k]) or furniture(words[k]) for k in range(n)]
    for k in range(n - 1):
        if words[k] in BOOKS and (furniture(words[k + 1]) or words[k + 1] == "i"):  # "Genesis i. 27"
            drop[k] = drop[k + 1] = True
    for _ in range(2):
        for k in range(n):
            if words[k] in JUNK and ((k and drop[k - 1]) or (k + 1 < n and drop[k + 1])):
                drop[k] = True
    keep = [x for x, d in zip(words, drop) if not d]
    return keep, len(keep) != n


def classify(old: list, ra: tuple, rb: tuple | None, vocab: set) -> str:
    """Why a difference between the CCEL words old and the scans is OCR noise, or "" when it is not.
    ra and rb are (words, capitals) of scans A and B at that place; rb is None when B was not found.
    Noise needs support for the CCEL text: one scan reads the CCEL words once page furniture is removed
    (a word broken across a page counts as one), or neither scan offers a readable word in their place."""
    old, _ = body_words(old, [False] * len(old))
    alt, head = body_words(*ra)
    alt_b, head_b = body_words(*rb) if rb is not None else (None, False)
    for r, h in ((alt, head), (alt_b, head_b)):
        if r is not None and (r == old or (h and "".join(r) == "".join(old))):
            return "running head" if h else "one scan agrees"
    if old == ["o"] and not alt and not alt_b:
        return "O read as a digit"  # the scans print the vocative O as 0
    offered = alt + (alt_b or [])
    if offered and all(unreadable(x, vocab) for x in offered):
        return "not a word"
    return ""


def locate(scan, w: list, lo: int, hi: int):
    """Find w near scan positions lo..hi, allowing OCR noise and a running head inside. Returns
    (start, ops, seg) with difflib opcodes over (w, seg), or None."""
    import difflib
    n = len(w)
    lo, hi = max(0, lo), min(len(scan.words), hi)
    cand = {j - k for j in range(lo, hi) for k in range(min(3, n)) if scan.words[j] == w[k]}
    target = " ".join(w)
    best = None  # (words matched, -distance from the CCEL length, character similarity), (start, size)
    for j in sorted(cand):
        if j < 0:
            continue
        for size in range(max(1, n - 2), n + 8):
            seg = scan.words[j:j + size]
            rest, _ = body_words(seg, scan.caps[j:j + size])
            r = difflib.SequenceMatcher(None, target, " ".join(rest), autojunk=False).ratio()
            if r < LOCATE_MIN:
                continue
            same = sum(m.size for m in difflib.SequenceMatcher(None, w, rest, autojunk=False).get_matching_blocks())
            key = (same, -abs(len(rest) - n), r)
            if best is None or key > best[0]:
                best = (key, (j, size))
    if best is None:
        return None
    j, size = best[1]
    seg = scan.words[j:j + size]
    ops = difflib.SequenceMatcher(None, w, seg, autojunk=False).get_opcodes()
    while ops and ops[-1][0] == "insert":
        ops = ops[:-1]
    while ops and ops[0][0] == "insert":
        ops = ops[1:]
    return j, ops, seg


LOCATE_MIN = 0.8  # character similarity for a short or unanchored sentence to count as found
NEAR = 400  # scan words searched beyond a found neighbour


def residual(secs: list, a, b, vocab: set) -> tuple[collections.Counter, list]:
    """Compare the final text with both scans again.

    Every sentence of 8 words or more is anchored by a unique 6-word run. Every other span of 4 words or
    more (a short sentence, a sentence with no anchor, a heading) is looked for in each scan near its
    neighbours, allowing OCR noise; text found in neither scan (a sentence the 1993 edition added) is an
    unexplained difference. Found text is compared word by word, and so is the scan word just outside it
    against the neighbouring CCEL word, so a word dropped at a sentence edge is seen. A difference is OCR
    noise only as classify() allows; every other one is unexplained. Spans under 4 words count as
    uncompared ("unanchored"). Returns counts and one row per difference:
    (section, ccel, scan A, scan B, noise category or "" when unexplained, sentence)."""
    import scancheck
    st = collections.Counter()
    rows = []

    def note(sec, old, ra, rb, why, sent):
        st[why or "unexplained"] += 1
        rows.append((sec["id"], old, " ".join(ra[0]), "(not found)" if rb is None else " ".join(rb[0]), why,
                     sent[:200]))

    for sec in secs:
        # spans in reading order: (block index, block type, sentence text, words)
        spans = []
        for bi, blk in enumerate(sec["blocks"]):
            text = blk["text"]
            st["words"] += len(scancheck.tokens(text))
            parts = [(0, len(text))] if blk["t"] == "h" else scancheck.sentences(text, min_words=1)
            for sa, sb in parts:
                w = [t[0] for t in scancheck.tokens(text[sa:sb])]
                if w:
                    spans.append((bi, blk["t"], text[sa:sb], w))
        note_heads = {s[3][0] for s in spans if s[1] == "note"}

        def stream(x):  # notes are compared within their own block; the text runs on across blocks
            return ("note", spans[x][0]) if spans[x][1] == "note" else ("text",)
        found = {}  # span index -> {"a": (scan, start, ops, seg), "b": ... or absent}
        missing = set()  # spans in neither scan, already counted
        for k, (bi, kind, sent, w) in enumerate(spans):
            if kind != "h" and len(w) >= 8:
                hit = {}
                for name, scan in (("a", a), ("b", b)):
                    r = scan.align(w)
                    if r is not None:
                        hit[name] = (scan, scan.start, r[0], r[1])
                if "a" in hit:
                    found[k] = hit

        def near(k, name, scan):
            same = [x for x in range(len(spans)) if stream(x) == stream(k)]
            if spans[k][1] == "note":
                same = list(range(len(spans)))  # a note sits on the page of the text it annotates
            prev = next((found[x][name] for x in reversed(same) if x < k and x in found and name in found[x]), None)
            nxt = next((found[x][name] for x in same if x > k and x in found and name in found[x]), None)
            lo = prev[1] + (prev[2][-1][4] if prev[2] else 0) if prev else None
            hi = nxt[1] if nxt else None
            if lo is None and hi is None:
                return None
            if lo is None or hi is None or hi < lo or hi - lo > 4 * NEAR:
                lo, hi = (lo - 20, lo + NEAR) if lo is not None else (hi - NEAR, hi + 20)
            else:
                lo, hi = lo - 20, hi + 20
            r = locate(scan, spans[k][3], lo, hi)
            return (scan, *r) if r else None

        for k, (bi, kind, sent, w) in enumerate(spans):
            if len(w) < 4:
                st["unanchored"] += len(w)
                continue
            if k in found:
                continue
            hit = {name: r for name, scan in (("a", a), ("b", b)) if (r := near(k, name, scan)) is not None}
            if not hit:
                note(sec, " ".join(w), (["(not found)"], []), None, "", sent)
                missing.add(k)
                continue
            found[k] = hit if "a" in hit else {"a": hit["b"]}  # compare with the scan that has it
            st["located"] += len(w)

        for k in sorted(found):
            bi, kind, sent, w = spans[k]
            pa, sa_, ops_a, seg_a = found[k]["a"]
            sb_ = found[k].get("b")

            def at(scan, start, seg, idx):
                return [seg[x] for x in idx], [scan.caps[start + x] for x in idx]
            for t, i1, i2, j1, j2 in ops_a:
                if t == "equal":
                    continue
                ra = at(pa, sa_, seg_a, range(j1, j2))
                rb = at(sb_[0], sb_[1], sb_[3], reading(sb_[2], i1, i2)) if sb_ else None
                why = classify(w[i1:i2], ra, rb, vocab)
                note(sec, " ".join(w[i1:i2]), ra, rb, why, sent)
            if not ops_a:
                continue
            same = [x for x in range(len(spans)) if stream(x) == stream(k)]
            pos = same.index(k)
            for side in ("before", "after"):
                # the nearest CCEL text word outside the span, past chapter numbers
                order = reversed(same[:pos]) if side == "before" else same[pos + 1:]
                nb = cc = None
                for x in order:
                    if x in missing:
                        continue
                    ws = [y for y in spans[x][3] if not furniture(y)]
                    if ws:
                        nb, cc = x, (ws[-1] if side == "before" else ws[0])
                        break
                if nb is None or (side == "before" and nb in found):
                    continue  # the gap after a found span is checked from that span

                def edge(scan, start, ops):
                    # the nearest text word outside the span, past any page furniture (up to 8 scan words)
                    x = start + (ops[0][3] - 8 if side == "before" else ops[-1][4])
                    lo, hi = max(0, x), min(len(scan.words), x + 8)
                    rest, _ = body_words(scan.words[lo:hi], scan.caps[lo:hi])
                    if not rest:
                        return [], []
                    return ([rest[-1]], [False]) if side == "before" else ([rest[0]], [False])
                ra = edge(pa, sa_, ops_a)
                rb = edge(sb_[0], sb_[1], sb_[2]) if sb_ and sb_[2] else None
                if ra[0] == [cc] or (rb is not None and rb[0] == [cc]) or not ra[0]:
                    continue
                if side == "after" and ra[0][0] in note_heads:
                    continue  # a footnote printed at the foot of the page after this sentence
                why = classify([], ra, rb, vocab)  # a scan word CCEL lacks between two sentences
                note(sec, f"({side} sentence)", ra, rb, why, sent)
    return st, rows


# Above this share of uncompared words (spans under 4 words: chapter numbers, "Why so?") a treatise is held
# even with no unexplained difference. Every longer span is compared with the scans or counted as
# unexplained. Round 1 measured shares of 0.4% to 3.0% (then including all sentences under 8 words) and
# 0.73 unexplained differences per 1000 compared words; 3% stays as a second limit.
UNANCHORED_MAX = 0.03
GATE = HERE / "philo-gate.tsv"  # every treatise: residual counts and published or held, with the reason
RESIDUAL = HERE / "philo-residual.tsv"  # every unexplained difference (and, for published treatises, every
# difference filed as noise), for review by hand


def gate(st: collections.Counter) -> str:
    """Why a treatise is held from publication, or "" when it may be published."""
    why = []
    if st["unexplained"]:
        why.append(f"{st['unexplained']} unexplained difference(s) from both Bohn scans")
    share = st["unanchored"] / max(1, st["words"])
    if share > UNANCHORED_MAX:
        why.append(f"{100 * share:.1f}% of words not compared with the scans (limit {100 * UNANCHORED_MAX:.0f}%)")
    return "; ".join(why)


def build(v, did: str, caps, a, b, vocab: set, log: list) -> tuple[list, collections.Counter]:
    """The treatise's sections after the two-scan correction, MANUAL and the Caius restore."""
    secs = sections_of(v, did, caps)
    for s2 in secs:
        for b2 in s2["blocks"]:
            if b2["t"] == "note":  # the 1993 edition starts notes in lowercase; Bohn's start with capitals
                b2["text"] = re.sub(r"^([^A-Za-z]*)([a-z])", lambda m2: m2.group(1) + m2.group(2).upper(), b2["text"])
    st = correct(secs, did, a, b, vocab, log)
    for mdid, mold, mnew in MANUAL:
        if mdid != did:
            continue
        hits = [(s2, b2) for s2 in secs for b2 in s2["blocks"] if mold in b2["text"]]
        assert len(hits) == 1 and hits[0][1]["text"].count(mold) == 1, (did, mold)
        s2, b2 = hits[0]
        b2["text"] = b2["text"].replace(mold, mnew)
        log.append((did, s2["id"], mold, mnew, "checked by hand on both scans"))
        st["corrections"] += 1
    # The 1993 edition spells the emperor "Gaius" throughout; Yonge printed "Caius" (neither scan has
    # "Gaius" anywhere). Restore it in every treatise, possessives included.
    assert "gaius" not in a.words and "gaius" not in b.words
    for s2 in secs:
        for b2 in s2["blocks"]:
            for m2 in re.finditer(r"\bGaius\b", b2["text"]):
                log.append((did, s2["id"], "Gaius", "Caius", b2["text"][max(0, m2.start() - 40):m2.end() + 40]))
            b2["text"] = re.sub(r"\bGaius\b", "Caius", b2["text"])
    return secs, st


def check() -> int:
    """Run the full correction and print, per treatise, the residual differences from the Bohn scans."""
    v = ccelwork.load(SOURCE)
    caps = mid_caps(v)
    a, b = scans()
    vocab = vocabulary(v)
    for did, info in TREATISES.items():
        secs, _ = build(v, did, caps, a, b, vocab, [])
        res, rows = residual(secs, a, b, vocab)
        print(f"{did:11} {info[0]:40} {gate(res) or 'publish'}")
        for row in rows:
            if not row[4]:
                print(f"    {row[1]!r} -> A {row[2]!r} B {row[3]!r}\n      {row[5]}")
    return 0


# ---------------------------------------------------------------- write

def write() -> int:
    v = ccelwork.load(SOURCE)
    m = meta(SOURCE)
    caps = mid_caps(v)
    a, b = scans()
    vocab = vocabulary(v)
    log: list = []
    rates = []
    refused = collections.Counter()
    gates, details = [], []
    for i, (did, (slug, title, short, ytitle, summary)) in enumerate(TREATISES.items()):
        secs, st = build(v, did, caps, a, b, vocab, log)
        eq, found, total = match_rate(secs, a)
        rates.append((slug, st["corrections"], st["unconfirmed"], eq, found, total))
        refused.update({k: n for k, n in st.items() if k != "corrections"})
        res, rows = residual(secs, a, b, vocab)
        held = gate(res)
        gates.append((did, slug, res["words"], res["unanchored"], res["unexplained"], held))
        # every unexplained difference; for a published treatise also each one filed as noise, for audit
        details += [(did, *row[:4], row[4] or "UNEXPLAINED", row[5]) for row in rows if held == "" or not row[4]]
        path = OUT / f"{slug}.toml"
        if held:
            for p in (path, path.with_suffix(".md")):
                p.unlink(missing_ok=True)
            print(f"  HELD {slug}: {held}")
            continue
        vol = vol_of(secs)
        found = yonge_title(v, did)
        yt = f" Yonge's title: {found}." if found else ""
        if ytitle == "Fragments of Lost Works":
            yt = " Yonge printed it among his Fragments of Lost Works."
        work = {
            "id": f"philo-{slug}", "title": title, "short_title": short, "author": "philo", "collection": "jewish",
            "order": 10 + i, "date": "c. 20-50", "language": "Greek", "translator": "C. D. Yonge",
            "edition": EDITION.format(vol=f"vol. {['I', 'II', 'III', 'IV'][vol - 1]}",
                                      scan=f"archive.org {SCAN_IDS[vol - 1]}", scan_b=SCAN_B_IDS[vol - 1],
                                      pct=f"{100 * res['unanchored'] / max(1, res['words']):.1f}"),
            "source_url": m["url"], "source_sha256": m["sha256"], "retrieved": m["retrieved"],
            "license": "Public domain", "license_basis": BASIS, "summary": summary + yt,
        }
        p = write_work(path, work, secs)
        print(f"  wrote {p.relative_to(LIBRARY.parent)}: {len(secs)} sections, "
              f"{sum(section_words(s['blocks']) for s in secs)} words")
    with open(CORRECTIONS, "w", encoding="utf-8") as f:
        f.write("treatise\tsection\tccel\tbohn\tcontext\n")
        for row in log:
            f.write("\t".join(x.replace("\t", " ") for x in row) + "\n")
    with open(GATE, "w", encoding="utf-8") as f:
        f.write("treatise\tslug\twords\tunanchored\tunanchored_pct\tunexplained\tstatus\treason\n")
        for did, slug, words, un, ux, held in gates:
            f.write(f"{did}\t{slug}\t{words}\t{un}\t{100 * un / max(1, words):.2f}\t{ux}\t"
                    f"{'held' if held else 'published'}\t{held}\n")
    with open(RESIDUAL, "w", encoding="utf-8") as f:
        f.write("treatise\tsection\tccel\tscan_a\tscan_b\tverdict\tsentence\n")
        for row in details:
            f.write("\t".join(x.replace("\t", " ").replace("\n", " ") for x in row) + "\n")
    print("refused readings:", dict(refused.most_common()))
    print(f"{'treatise':42} {'fixed':>5} {'unconf':>6} {'match%':>7} {'found%':>7}")
    for slug, c, u, eq, found, total in rates:
        print(f"{slug:42} {c:5} {u:6} {100 * eq / max(1, found):7.2f} {100 * found / max(1, total):7.1f}")
    print(f"{'treatise':42} {'words':>6} {'unanch%':>7} {'unexpl':>6} status")
    for did, slug, words, un, ux, held in gates:
        print(f"{slug:42} {words:6} {100 * un / max(1, words):7.2f} {ux:6} {'HELD' if held else 'published'}")
    return 0


if __name__ == "__main__":
    sys.exit(check() if sys.argv[1:] == ["check"] else write())
