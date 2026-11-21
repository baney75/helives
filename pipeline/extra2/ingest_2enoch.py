"""Ingest 2 Enoch, the Book of the Secrets of Enoch, recension A, in the translation of N. Forbes and
R. H. Charles, from Charles' Apocrypha and Pseudepigrapha of the Old Testament, vol. 2 (Oxford:
Clarendon Press, 1913).

Usage: python3 -I pipeline/extra2/ingest_2enoch.py [--report]
Text: The Forgotten Books of Eden (ed. R. H. Platt, 1926), as transcribed at sacred-texts.com
(archive.sacred-texts.com/bib/fbe, pages fbe108 to fbe175, cached in pipeline/cache/extra2/fbe-arch/).
Platt reprints the longer recension (APOT's column A) chapter by chapter but numbers the verses by
sentence. His numbers are removed and APOT's verse numbers are put back from a hand reading of the
page images of APOT vol. 2 (NUMBERS below). APOT prints each verse number in the margin beside the
printed line where the verse begins, often mid-sentence; the verse starts at the clause that the
footnotes and the parallel column B point to. Chapter headings are kept where APOT prints them
(Platt's own headnotes, which the scans lack, are dropped). The shorter recension (column B) is not included.
"""
from __future__ import annotations

import difflib
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from align import DIGITISH, WORD, fold, words_with_pos  # noqa: E402
from common import files_sha256, gaps, guard, roman  # noqa: E402
from fetch import CACHE, meta  # noqa: E402
from ia import ocr  # noqa: E402
from libtoml import LIBRARY, write_work  # noqa: E402
from stext import extract  # noqa: E402
from hocr import marked_lines  # noqa: E402

HOCR = {i: CACHE / "hocr" / f"{i}_p424-470.hocr.html" for i in ("apocryphapseudep0002unse", "apocryphapseudep0002rhch_w1w3")}
UNREAD = "qqmark"  # stands for a margin mark the OCR could not read (APOT prints some numbers sideways)

PAGES = [CACHE / "fbe-arch" / f"fbe{n}.htm" for n in range(108, 176)]
SCANS = ("apocryphapseudep0002unse", "apocryphapseudep0002rhch_w1w3")
OUT = LIBRARY / "pseudepigrapha" / "2-enoch.toml"
# Checked against the scans and the page images; (chapter, reprint, printed text). Applied to the
# chapter text before the verses are cut.
CORRECTIONS: list[tuple[str, str, str]] = [
    ("1", "Enoch, do mot fear", "Enoch, do not fear"),
    ("8", "and san the produce", "and saw the produce"),
    ("10", "led me upon to the Northern side", "led me up on to the Northern side"),
    ("15", "break into song, there fore every", "break into song, therefore every"),
    ("31", "understood that I wanted to create", "understood that I want to create"),
    ("31", "as a fugitive he made Sotona", "as a fugitive he made, he made Sotona"),
    ("31", "as his name was Satanail,", "as his name was Satomail,"),
    ("36", "I s all send my angel", "I shall send my angel"),
    ("39", "filling heaven as be helped me", "filling heaven as he helped me"),
    ("40", "does not exhaust the treasure-houses", "does not exhaust their treasure-houses"),
    ("7", "and I answered to them", "and I answered them"),
    ("14", "and guarded [by four hundred angels", "and guarded by four hundred angels"),
    ("19", "And when they see evildoing", "And when they see evil-doing"),
    ("21", "come with me.' And I answered him", "come with me,' and I answered him"),
    ("29", "[Monday is the first day.] AND for all", "[Monday is the first day.] And for all"),
    ("30", "and the third day was, [Tuesday.] ON the third day", "and the third day was. [Tuesday]. On the third day"),
    ("57", "And Methosalam. made haste", "And Methosalam made haste"),
    ("60", "HE who works the killing", "He who works the killing"),
    ("66", "Walk, my children, in longsuffering", "Walk, my children, in long-suffering"),
    ("43", "I my children, measured", "I, my children, measured"),
    ("44", "and tie who vents anger", "and he who vents anger"),
    ("48", "then the earth is and makes grow", "then the earth is glad and makes grow"),
    ("48", "from the seventeenth of Thevan it goes up", "from the seventeenth of Thevad it goes up"),
    ("49", "a place prepared for the repose of the soul", "a place prepared for the repose of that soul"),
    ("55", "the time nave approached", "the time have approached"),
    ("57", "summon all thy brethren and our household", "summon all thy brethren and all your household"),
    ("63", "he commits contempt, and forfeit", "he commits contempt, and will forfeit"),
    ("65", "understand that after that he created man", "understand that after all that he created man"),
    ("67", "covered those men standing with Enoch", "covered those men standing and talking with Enoch"),
]
# Every verse start of recension A, read by hand on the page images of APOT vol. 2, pages 431 to 469
# (archive.org apocryphapseudep0002unse, images n450 to n488): (chapter, verse, words the verse begins
# with). APOT sets each number beside the printed line where the verse begins; inside that line the
# verse is taken to begin at the clause the footnotes and the parallel column B point to.
NUMBERS: list[tuple[int, int, str]] = [
    (1, 2, 'On the first day of the first month'),
    (1, 3, 'And when I was asleep'),
    (1, 4, 'And there appeared to me two men'),
    (1, 5, 'their faces were shining'),
    (1, 6, 'And I arose from my sleep'),
    (1, 7, 'And I saluted them'),
    (1, 8, 'and those men said to me'),
    (1, 9, 'and thou shalt tell thy sons'),
    (1, 10, 'And I made haste'),
    (2, 2, 'now therefore, my children'),
    (2, 3, 'and may the Lord make confident'),
    (2, 4, 'And now, my children'),
    (3, 2, 'And there I looked'),
    (3, 3, 'they placed me on the first heaven'),
    (4, 2, 'and fly with their wings'),
    (5, 2, 'and the clouds whence'),
    (7, 2, 'and these angels were dark-looking'),
    (7, 3, 'Wherefore are these'),
    (7, 4, 'And I felt great pity'),
    (7, 5, 'and I answered them'),
    (8, 2, 'And I saw all the sweet-flowering'),
    (8, 3, 'And in the midst of the trees'),
    (8, 4, 'and adorned more than every existing thing'),
    (8, 5, 'And paradise is between'),
    (8, 6, 'and go down into the'),
    (8, 7, 'And here there is no unfruitful tree'),
    (8, 8, 'And there are three hundred angels'),
    (10, 2, 'and there were all manner of tortures'),
    (10, 3, 'thirst and shivering'),
    (10, 4, 'Woe, woe, how very terrible'),
    (10, 5, 'stealing, lies, calumnies'),
    (10, 6, 'and who knew not their creator'),
    (11, 2, 'And I measured their goings'),
    (11, 3, 'Its passage and return'),
    (11, 4, 'And by day fifteen myriads'),
    (11, 5, 'and a hundred angels kindle'),
    (12, 2, 'their wings are like those'),
    (12, 3, 'Thus the sun revolves'),
    (13, 2, 'And I saw six gates open'),
    (13, 4, 'and rises throughout all the months'),
    (13, 5, 'thus the period of the whole year'),
    (14, 2, 'Thus again it goes down'),
    (14, 3, 'and guarded by four hundred angels'),
    (15, 2, 'The giver of light comes'),
    (15, 3, 'and they showed me this calculation'),
    (15, 4, 'for this reason the sun is a great creation'),
    (16, 2, 'It goes in at the first gate'),
    (16, 3, 'And it goes through the western gates'),
    (16, 4, 'and accomplishes the three hundred'),
    (16, 5, 'while the lunar year has'),
    (16, 6, 'The quarter of a day is omitted'),
    (16, 7, 'And when the western gates are finished'),
    (16, 8, 'It has a sevenfold course'),
    (18, 2, 'and their faces withered'),
    (18, 3, 'And they said to me: These are the Grigori'),
    (18, 4, 'and after them are those who are held'),
    (18, 5, 'and befouled the earth'),
    (18, 6, 'And therefore God judged them'),
    (18, 7, 'And I said to the Grigori'),
    (18, 8, "And I said: 'Wherefore do you wait"),
    (18, 9, 'And they listened to my admonition'),
    (19, 2, 'and these make the orders'),
    (19, 3, 'And when they see evil-doing'),
    (19, 4, 'measure all life in heaven'),
    (19, 5, 'and the angels who write all'),
    (19, 6, 'in their midst are six Phoenixes'),
    (20, 2, 'and those men took me'),
    (20, 3, 'and showed me the Lord from afar'),
    (20, 4, 'and would again go to their places'),
    (21, 2, 'When I saw all these things'),
    (21, 3, 'And the Lord sent one of his glorious ones'),
    (21, 4, 'and I answered him'),
    (21, 5, 'And Gabriel caught me up'),
    (21, 6, 'And I saw the eighth Heaven'),
    (22, 2, 'And who am I to tell'),
    (22, 3, 'nor their incessant singing'),
    (22, 4, 'And I fell prone and bowed down'),
    (22, 5, 'and the Lord with his lips said to me'),
    (22, 6, 'And the archistratege Michael lifted me up'),
    (22, 7, 'and the glorious ones bowed down'),
    (22, 8, 'And the Lord said to Michael'),
    (22, 9, 'And Michael did thus'),
    (22, 10, 'and I looked at myself'),
    (22, 11, 'And the Lord summoned one of his arch'),
    (22, 12, 'and the Lord said to Pravuil'),
    (23, 2, 'and the formation of their songs'),
    (23, 4, 'Sit and write all the souls'),
    (23, 5, 'for all souls are prepared'),
    (23, 6, 'And all double thirty days'),
    (24, 2, 'Enoch, beloved'),
    (24, 3, 'Hear, Enoch, and take in these my words'),
    (24, 4, 'For before all things were visible'),
    (24, 5, 'But even the sun has peace'),
    (25, 2, 'And I said to him'),
    (25, 3, 'And he came undone'),
    (25, 4, 'And I placed for myself a throne'),
    (25, 5, 'And above the light there is nothing'),
    (26, 2, "And I said: 'Be opened, Archas"),
    (26, 3, 'and I saw that it was good'),
    (27, 2, "and I said: 'Be thick"),
    (27, 3, 'and then I made firm the waters'),
    (27, 4, 'And I separated between light'),
    (28, 2, 'Out of the waves I created rock'),
    (28, 3, 'and the midst of the earth I called'),
    (28, 4, 'I collected the sea'),
    (28, 5, 'This day I called me the first-created'),
    (29, 2, 'which is both fire in water'),
    (29, 3, 'And from the rock I cut off'),
    (29, 4, 'And one from out the order of angels'),
    (29, 5, 'And I threw him out from the height'),
    (30, 2, 'Then came evening, and came morning the fourth'),
    (30, 3, 'On the first uppermost circle'),
    (30, 4, 'on the fifth Zeus'),
    (30, 5, 'And on the lower I placed the sun'),
    (30, 6, 'The sun that it should go'),
    (30, 7, 'Then evening came and morning came the fifth'),
    (30, 8, 'And there came evening, and there came morning the sixth'),
    (30, 9, 'And I gave him seven natures'),
    (30, 10, 'I conceived a cunning saying'),
    (30, 11, 'and I placed him on earth, a second angel'),
    (30, 12, 'and I appointed him as ruler'),
    (30, 13, 'And I appointed him a name'),
    (30, 14, 'and I appointed for him four special stars'),
    (30, 15, 'and showed him the two ways'),
    (30, 16, 'For I have seen his nature'),
    (30, 17, 'And I put sleep into him'),
    (30, 18, 'that death should come to him by his wife'),
    (31, 2, 'I made the heavens open to him'),
    (31, 3, 'And he was continuously in paradise'),
    (31, 4, 'The devil is the evil spirit'),
    (31, 5, 'thus he became different from the angels'),
    (31, 6, 'And he understood his condemnation'),
    (31, 7, 'But I cursed ignorance'),
    (31, 8, 'nor the earth, nor other creatures'),
    (32, 2, 'And I blessed the seventh day'),
    (33, 2, 'and that the first seven revolve'),
    (33, 3, 'And now, Enoch, all that I have told thee'),
    (33, 4, 'and there is no counsellor'),
    (33, 5, 'And apply thy mind, Enoch'),
    (33, 6, 'And I give thee Samuil and Raguil'),
    (33, 7, 'For I created all forces'),
    (33, 8, 'Give them the books of the handwriting'),
    (33, 9, 'And let them distribute the books'),
    (33, 10, 'And I will give thee, Enoch, my intercessor'),
    (34, 2, 'and have laden the whole earth'),
    (34, 3, 'And therefore I will bring down a deluge'),
    (35, 2, 'He who raises that generation'),
    (35, 3, 'And they shall tell another generation'),
    (36, 2, 'And after thirty days I'),
    (37, 2, "And the Lord said to me: 'Enoch, if thy face"),
    (38, 2, 'And they placed me by night on my couch'),
    (38, 3, 'And Mathusal expecting my coming'),
    (39, 2, 'I have been let come to you'),
    (39, 3, 'For the Lord has let me come to you'),
    (39, 4, 'You look now upon my eyes'),
    (39, 5, 'You see now, my children, the right hand'),
    (39, 6, 'You see the compass of my work'),
    (39, 7, 'You hear the words of my lips'),
    (39, 8, 'And now, my children, hear the discourses'),
    (40, 2, 'I know all things, and have written'),
    (40, 3, 'What man has seen their revolutions'),
    (40, 4, "And I measured the sun's circle"),
    (40, 8, 'and the dwelling-places of the clouds'),
    (40, 9, 'And I investigated all things'),
    (40, 10, 'I wrote the treasure-houses of the snow'),
    (40, 11, 'And I wrote the resting-places of the winds'),
    (40, 12, 'And I measured out the whole earth'),
    (40, 13, 'And I saw how the prisoners'),
    (41, 2, "'Blessed is the man who has not been born"),
    (42, 14, "and I saw all the Lord's works"),
    (43, 2, 'As one year is more honourable'),
    (43, 3, 'let it be heard everywhere'),
    (44, 2, 'and he who vents anger'),
    (44, 3, 'he who spits on the face'),
    (44, 4, 'Blessed is the man who does not direct'),
    (44, 5, 'and shall do charity to the needy'),
    (45, 2, 'But whoever increases his lamp'),
    (45, 3, 'When the Lord demands bread'),
    (46, 2, 'Or if one man make himself'),
    (46, 3, 'And when the Lord shall send a great light'),
    (47, 2, "Take these books of your father's"),
    (47, 3, 'And if you will observe my handwriting'),
    (47, 4, 'The Lord has placed the foundations'),
    (47, 5, 'and who has counted the water'),
    (48, 2, 'that it go down on a short day'),
    (48, 3, 'And thus it goes close to the earth'),
    (48, 4, 'All this he measured'),
    (48, 5, 'From the invisible he made all things visible'),
    (48, 6, 'Thus I make known to you'),
    (48, 7, 'and amongst the nations'),
    (48, 8, 'And those who understand not the Lord'),
    (48, 9, 'Blessed is the man who shall bear their yoke'),
    (49, 2, 'And I swear to you, yea, yea'),
    (50, 2, 'I see all things'),
    (50, 3, 'Endure for the sake of the Lord'),
    (50, 4, 'If ill-requitals befall you'),
    (50, 5, 'Whoever of you spends gold'),
    (51, 2, 'Hide not your silver'),
    (51, 3, 'And every grievous and cruel yoke'),
    (51, 4, 'It is good to go morning'),
    (51, 5, 'Because every breathing thing'),
    (52, 2, 'Cursed every man who opens his lips'),
    (52, 3, 'Blessed is he who opens his lips blessing'),
    (52, 4, 'Cursed is he before the Lord'),
    (52, 5, 'Blessed is he who blesses all'),
    (52, 6, "Cursed is he who brings the Lord's creation"),
    (52, 7, 'Blessed is he who looks down'),
    (52, 8, 'Cursed is he who looks to and is eager'),
    (52, 9, 'Blessed is he who keeps the foundations'),
    (52, 10, 'Cursed is he who perverts'),
    (52, 11, 'Blessed is he who implants peace'),
    (52, 12, 'Cursed is he who disturbs'),
    (52, 13, 'Blessed is he who speaks with humble'),
    (52, 14, 'Cursed is he who speaks peace'),
    (52, 15, 'For all these things will be laid bare'),
    (53, 2, 'You see how I wrote all works'),
    (53, 3, 'and none can tell or relate'),
    (53, 4, 'And now, my children, mark well'),
    (55, 2, 'For to-morrow I shall go up'),
    (55, 3, 'Therefore I bid you do'),
    (56, 2, 'Enoch answered to his son Methosalam'),
    (57, 2, 'And Methosalam made haste'),
    (58, 2, 'and the Lord called all the beasts'),
    (58, 3, 'And the Lord appointed him ruler'),
    (58, 4, 'The Lord will not judge a single soul'),
    (58, 5, 'for men have a special place'),
    (58, 6, 'nor all souls of beast'),
    (59, 2, 'For man brings clean animals'),
    (59, 3, 'All is given you for food'),
    (59, 4, 'But whoever kills beast without wound'),
    (59, 5, 'And he who does any beast any injury'),
    (60, 2, 'He who works the killing'),
    (60, 3, 'He who puts a man in any snare'),
    (60, 4, 'He who puts a man in any vessel'),
    (60, 5, 'He who works crookedly'),
    (61, 2, 'so let him do to every living soul'),
    (61, 3, 'Blessed are those who enter the good houses'),
    (61, 4, 'Hear, my children, small and great'),
    (61, 5, 'And if his hands made it'),
    (62, 2, 'But if he take back his words'),
    (62, 3, 'Because every work which man does'),
    (63, 2, 'But if his heart murmur'),
    (63, 3, 'And if his own heart is filled'),
    (63, 4, 'Every proud and magniloquent man'),
    (64, 2, 'and two thousand men came together'),
    (64, 3, 'And the elders of the people'),
    (64, 4, 'and now bless thy sons'),
    (64, 5, 'For thou shalt be glorified'),
    (65, 2, 'And as much time as there was'),
    (65, 3, "And the Lord saw all man's works"),
    (65, 4, 'And in those he appointed the hours'),
    (65, 5, 'because no work is hidden'),
    (65, 6, 'When all creation visible and invisible'),
    (65, 7, 'and then all time shall perish'),
    (65, 8, 'There will be one aeon'),
    (65, 9, 'and then too there will be amongst them'),
    (65, 10, 'And they shall have a great indestructible wall'),
    (66, 2, 'Bow down to the true God'),
    (66, 3, 'For the Lord sees all things'),
    (66, 4, 'If you look to heaven'),
    (66, 5, 'For the Lord created all things'),
    (66, 6, 'Walk, my children, in long-suffering'),
    (66, 7, 'Blessed are the just who shall escape'),
    (66, 8, 'for in this world the seventh part'),
    (67, 2, 'and they took Enoch up on to the highest heaven'),
    (67, 3, 'And the people saw and understood'),
    (68, 2, 'He wrote all these signs'),
    (68, 3, 'and handed them over to his sons'),
    (68, 4, "As every man's nature"),
    (68, 5, 'Methosalam and his brethren'),
    (68, 6, 'And they took sacrificial oxen'),
    (68, 7, 'All people, the elders of the people'),
]
# Numbers APOT does not print in column A (checked on the page images): 13:3, 23:3; 40 prints "4, 6, 7"
# beside one paragraph (5 lacking in A), kept as verse 4; 42 prints verses 1 and 14 only (2 to 13 are B only).
PRINTED_GAPS = {(13, 3), (23, 3), (40, 5), (40, 6), (40, 7)} | {(42, n) for n in range(2, 14)}
# Chapters whose first sentence the reprint set as its heading; APOT prints it as the start of verse 1.
HEAD_IS_TEXT = {29, 30, 60, 68}
# Headings APOT prints inside a chapter: (chapter, heading, words of the text it stands before).
MIDHEADS = [
    (29, "The fiery Essence.", "And for all the heavenly troops"),
    (29, "Here Satanail with his angels was thrown down from the height.", "And one from out the order of angels"),
    (60, "How it is not fitting to kill man neither by weapon nor by tongue.", "He who works the killing"),
]
BREAK = re.compile(r"[.;:!?,][\"'’”)\]]*\s+$")
STRONG = re.compile(r"[.;:!?][\"'’”)\]]*\s+$")


def chapters():
    """[(heading or None, prologue or None, body text)] per chapter, Platt's numbers removed."""
    out = []
    for k, path in enumerate(PAGES, 1):
        blocks = extract(path)
        if blocks[0]["kind"] != "h":
            raise SystemExit(f"{path.name}: no heading")
        head = blocks[1]["text"].replace("*", "").strip()
        paras = [b["text"].replace("*", "") for b in blocks[2:]]
        paras = [re.sub(r"^\d{1,2}\.?\s+", "", p).strip() for p in paras]
        prologue = None
        if k == 1:  # the book's opening paragraph stands before chapter 1, verse 1 in APOT
            prologue = paras[0] + " " + paras[1]
            paras = paras[2:]
        if k in HEAD_IS_TEXT:
            paras.insert(0, head.replace(" The fiery Essence.", ""))
            head = None
        body = " ".join(p for p in paras if p)
        body = re.sub(r"^A ND\b", "And", body)
        body = re.sub(r"^Saw the key-holders", "I saw the key-holders", body)
        body = re.sub(r"^(I )?([A-Z]{2,})\b", lambda m: (m.group(1) or "") + (m.group(2).lower() if m.group(1) else m.group(2).capitalize()), body)
        if prologue:
            prologue = re.sub(r"^([A-Z]{2,})\b", lambda m: m.group(1).capitalize(), prologue)
        out.append((head, prologue, re.sub(r"\s+", " ", body)))
    return out


def ocr_words(raw: str):
    raw = re.sub(r"(\w)-[ \t]*\n\s*([a-z])", r"\1\2", raw)
    raw = re.sub(r"(?m)^(\s*\d{1,2})(?=[a-z])", r"\1 ", raw)  # "6name" -> "6 name"
    f = fold(raw)
    out, line = [], 0
    for m in WORD.finditer(f):
        ls = f.rfind("\n", 0, m.start()) + 1
        before = f[ls:m.start()]
        out.append((m.group().lower(), m.group(), not re.search(r"[A-Za-z0-9]", before), ls))
    return out


def num(tok: str) -> int | None:
    if len(tok) > 2:
        return None
    t = tok.translate(DIGITISH)
    return int(t) if t.isdigit() else None


def scan_region(ident: str) -> str:
    """The 2 Enoch pages as text lines from the hOCR, margin marks put at the start of their line."""
    out = []
    for mark, text in marked_lines(HOCR[ident]):
        if mark:
            m = num(mark.split()[-1].strip(".,:;"))
            text = f"{m if m is not None else UNREAD} {text}"
        out.append(text)
    raw = "\n".join(out)
    i = raw.find("THERE was a wise man, a great artificer")
    j = raw.find("whence and where Enoch had been taken up to heaven", i)
    if i < 0 or j < 0:
        raise SystemExit(f"{ident}: 2 Enoch not found")
    return raw[i:j + 200]


def build(chs, log):
    """Sections from the hand-read verse starts; a verse start must be found in order in its chapter."""
    sections = []
    for c, (head, prologue, body) in enumerate(chs):
        k = c + 1
        mids = []
        for ch, text, before in MIDHEADS:
            if ch != k:
                continue
            body = re.sub(r"\s*" + re.escape(text) + r"\s*", " ", body).strip()
            at = body.find(before)
            if at < 0:
                raise SystemExit(f"{k}: heading anchor not found: {before!r}")
            mids.append((at, text))
        cuts, last = [(1, 0)], 0
        for ch, v, words in NUMBERS:
            if ch != k:
                continue
            pos = body.find(words, last + 1)
            if pos < 0:
                raise SystemExit(f"{k}:{v}: verse start not found after the previous one: {words!r}")
            if v <= cuts[-1][0]:
                raise SystemExit(f"{k}:{v}: verse numbers out of order")
            for n in range(cuts[-1][0] + 1, v):
                if (k, n) not in PRINTED_GAPS:
                    raise SystemExit(f"{k}: verse {n} missing")
            cuts.append((v, pos))
            last = pos
        blocks = []
        if head:
            blocks.append({"t": "h", "level": 3, "text": head})
        if prologue:
            blocks.append({"t": "p", "text": prologue})
        for i, (n, pos) in enumerate(cuts):
            end = cuts[i + 1][1] if i + 1 < len(cuts) else len(body)
            inner = sorted((a, t) for a, t in mids if pos <= a < end)
            start, first = pos, True
            for a, t in inner:
                if body[start:a].strip():
                    blk = {"t": "v", "n": n, "text": body[start:a].strip()}
                    if not first:
                        blk["cont"] = True
                    blocks.append(blk)
                    first = False
                blocks.append({"t": "h", "level": 3, "text": t})
                start = a
            blk = {"t": "v", "n": n, "text": body[start:end].strip()}
            if not first:
                blk["cont"] = True
            blocks.append(blk)
        sections.append({"id": str(k), "title": f"Chapter {k}", "level": 1, "blocks": blocks})
    return sections


def printed_heading(head: str, raw: str) -> bool:
    """True when the heading's words stand in the scan OCR in order (APOT's heading, not Platt's note)."""
    ws = [w for w, _ in words_with_pos(head)]
    flat = " ".join(w for w, *_ in ocr_words(raw))
    return len(ws) > 0 and " ".join(ws[:6]) in flat


def main(argv):
    chs = chapters()
    if len(chs) != 68:
        raise SystemExit("expected 68 chapters")
    log: list[str] = []
    regions = [scan_region(i) for i in SCANS]
    chs = [(h if h and any(printed_heading(h, r) for r in regions) else None, p, b) for h, p, b in chs]
    chs = [list(c) for c in chs]
    for cid, old, new in CORRECTIONS:
        c = chs[int(cid) - 1]
        if old not in c[2]:
            raise SystemExit(f"correction not applied: {cid} {old!r}")
        c[2] = c[2].replace(old, new)
        log.append(f"correction {cid}: {old!r} -> {new!r}")
    sections = build([tuple(c) for c in chs], log)
    left = [(si, a, k) for si, a, k in gaps(sections) if (si + 1, k) not in PRINTED_GAPS]
    m = meta("fbe-arch/fbe108.htm")
    work = {
        "id": "2-enoch",
        "title": "2 Enoch, or the Book of the Secrets of Enoch",
        "short_title": "2 Enoch",
        "author": "pseudepigrapha-anonymous",
        "collection": "pseudepigrapha",
        "order": 3,
        "date": "1st century AD (Charles dates it between 1 BC and AD 50)",
        "language": "Old Church Slavonic, from a lost Greek original",
        "translator": "N. Forbes and R. H. Charles",
        "edition": "The Book of the Secrets of Enoch, recension A, translated by N. Forbes and R. H. Charles, in The Apocrypha and Pseudepigrapha of the Old Testament in English, edited by R. H. Charles, vol. 2 (Oxford: Clarendon Press, 1913), pages 425 to 469",
        "source_url": "https://archive.sacred-texts.com/bib/fbe/index.htm",
        "source_sha256": files_sha256(PAGES),
        "retrieved": m["retrieved"],
        "license": "Public domain",
        "license_basis": f"The Apocrypha and Pseudepigrapha of the Old Testament in English, vol. 2, published in Oxford by the Clarendon Press in 1913; in the public domain in the United States because it was published before 1931. The words follow the 1926 reprint in The Forgotten Books of Eden (New York: Alpha House, 1926), also published before 1931; verse numbers rebuilt and wording checked against two archive.org scans of the 1913 printing ({SCANS[0]}, {SCANS[1]}).",
        "summary": "A Jewish apocalypse preserved only in Slavonic, in which Enoch is taken up through the heavens, is shown the creation and the order of the world, and returns to teach his sons before he is taken away. This text follows one recension, the longer one (APOT's recension A); the shorter recension is not included. It is outside every Jewish and Christian canon and is kept here for history and study. It is not Scripture.",
    }
    for sec in sections:
        for blk in sec["blocks"]:
            guard(blk["text"], f"section {sec['id']}")
    write_work(OUT, work, sections)
    if "--report" in argv:
        print("\n".join(log))
    nv = sum(1 for s in sections for b in s["blocks"] if b["t"] == "v")
    print(f"chapters {len(sections)}, verses {nv}, headings {sum(1 for h, _, _ in chs if h)}, gaps left {len(left)}")
    longest = sorted(((len(b["text"].split()), s["id"], b["n"]) for s in sections for b in s["blocks"] if b["t"] == "v"), reverse=True)[:8]
    print("longest verses (words, chapter, verse):", longest)
    single = [s["id"] for s in sections if sum(1 for b in s["blocks"] if b["t"] == "v") == 1]
    print("one-verse chapters:", single)
    for si, a, k in left:
        print("gap", sections[si]["id"], a, k)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
