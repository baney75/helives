"""The Gustave Doré Bible illustrations (1866): one spec per plate, tagged to book and chapter.

Plate list and order come from the Commons gallery "Doré's Bible Illustrations" (dore_list.py).
OT plates use the 2010 numbered upload of the English edition. NT plates on that gallery are mostly
small copies or Flickr "No restrictions" scans (not stated as public domain), so they are replaced by
the National Library of Poland (Polona) scans of the Polish Doré Bibles (1874 and 1930), cropped to
the engraving. Chapter tags were checked against the Bible text and, for Polona pages, against the
reference printed under the plate.
"""
from __future__ import annotations

import json
import re
import sys

from common import CACHE
from dore_list import gallery

sys.path.insert(0, str(CACHE.parent.parent))
from libtoml import slugify  # noqa: E402

# OT plate number (as in the file name) -> tags. Deuterocanonical plates get `deuterocanon:` tags
# because the library's Bible is the 66-book Protestant canon (BSB).
OT = {
    "001": ["genesis:1"], "002": ["genesis:2"], "003": ["genesis:3"], "004": ["genesis:4"],
    "005": ["genesis:4"], "006": ["genesis:7"], "007": ["genesis:7"], "008": ["genesis:8"],
    "009": ["genesis:9"], "010": ["genesis:11"], "011": ["genesis:12"], "012": ["genesis:18"],
    "013": ["genesis:19"], "014": ["genesis:21"], "015": ["genesis:21"], "016": ["genesis:22"],
    "017": ["genesis:23"], "018": ["genesis:24"], "019": ["genesis:24"], "020": ["genesis:27"],
    "021": ["genesis:28"], "022": ["genesis:29"], "023": ["genesis:32"], "024": ["genesis:32"],
    "025": ["genesis:33"], "026": ["genesis:37"], "027": ["genesis:41"], "028": ["genesis:45"],
    "029": ["genesis:46"], "030": ["exodus:2"], "031": ["exodus:2"], "032": ["exodus:7"],
    "033": ["exodus:9"], "034": ["exodus:10"], "035": ["exodus:12"], "036": ["exodus:12"],
    "037": ["exodus:14"], "038": ["exodus:19", "exodus:20"], "039": ["exodus:34"],
    "040": ["numbers:16"], "041": ["exodus:17", "numbers:20"], "041A": ["exodus:32"], "041B": ["numbers:13"],
    "042": ["numbers:21"], "043": ["numbers:22"], "044": ["joshua:3"], "045": ["joshua:5"],
    "046": ["joshua:6"], "047": ["joshua:6"], "048": ["joshua:7"], "049": ["joshua:8"],
    "050": ["joshua:10"], "051": ["joshua:10"], "052": ["judges:4"], "053": ["judges:5"],
    "054": ["judges:7"], "055": ["judges:7"], "056": ["judges:9"], "057": ["judges:9"],
    "058": ["judges:11"], "059": ["judges:11"], "060": ["judges:14"], "061": ["judges:15"],
    "062": ["judges:16"], "063": ["judges:16"], "064": ["judges:16"], "065": ["judges:19"],
    "066": ["judges:19"], "067": ["judges:21"], "068": ["ruth:1"], "069": ["ruth:2"],
    "070": ["1-samuel:6"], "070A": ["1-samuel:9", "1-samuel:10"], "071": ["1-samuel:15"], "071A": ["1-samuel:17"],
    "072": ["1-samuel:18", "1-samuel:19"], "073": ["1-samuel:19"], "073A": ["1-samuel:20"],
    "074": ["1-samuel:24"], "075": ["1-samuel:28"], "076": ["1-samuel:31"], "077": ["1-samuel:31"],
    "078": ["2-samuel:2"], "079": ["2-samuel:12"], "080": ["2-samuel:18"], "081": ["2-samuel:18"],
    "082": ["2-samuel:21"], "083": ["2-samuel:21"], "084": ["1-kings:3"], "085": ["1-kings:5"],
    "086": ["1-kings:10"], "087": ["1-kings:11", "1-kings:4"], "088": ["1-kings:13"], "089": ["1-kings:17"],
    "090": ["1-kings:18"], "091": ["1-kings:19"], "092": ["1-kings:20"], "093": ["1-kings:22"],
    "094": ["2-kings:1"], "095": ["2-kings:2"], "096": ["2-kings:6"], "097": ["2-kings:9"],
    "098": ["2-kings:9"], "099": ["2-kings:11"], "100": ["2-kings:17"], "101": ["2-kings:19", "isaiah:37"],
    "102": ["2-kings:25", "jeremiah:52"], "102A": ["2-samuel:24", "1-chronicles:21"],
    "103": ["2-chronicles:20"], "104": ["ezra:1"], "105": ["ezra:3"], "106": ["ezra:7"],
    "107": ["ezra:9"], "108": ["nehemiah:2"], "109": ["nehemiah:8"],
    "110": ["deuterocanon:tobit:6"], "111": ["deuterocanon:tobit:12"],
    "112": ["deuterocanon:judith:13"], "113": ["deuterocanon:judith:13"],
    "114": ["esther:1"], "115": ["esther:5"], "116": ["esther:6"], "117": ["esther:7"],
    "118": ["job:1"], "119": ["job:2"], "120": ["isaiah:1"], "121": ["isaiah:13"],
    "122": ["isaiah:27"], "123": ["jeremiah:1"], "124": ["lamentations:1"],
    "125": ["deuterocanon:baruch:1"], "126": ["ezekiel:14"], "127": ["ezekiel:37"],
    "128": ["daniel:2"], "129": ["daniel:3"], "130": ["daniel:5"], "131": ["daniel:6"],
    "132": ["daniel:7"], "133": ["deuterocanon:susanna:1"], "134": ["deuterocanon:susanna:1"],
    "135": ["deuterocanon:bel-and-the-dragon:1"], "136": ["amos:1"], "137": ["jonah:2"],
    "138": ["jonah:3"], "139": ["micah:7"], "140": ["zechariah:6"],
    "141": ["deuterocanon:1-maccabees:2"], "142": ["deuterocanon:1-maccabees:2"],
    "143": ["deuterocanon:1-maccabees:5"], "144": ["deuterocanon:1-maccabees:6"],
    "145": ["deuterocanon:1-maccabees:7"], "146": ["deuterocanon:1-maccabees:10"],
    "147": ["deuterocanon:2-maccabees:3"], "148": ["deuterocanon:2-maccabees:5"],
    "149": ["deuterocanon:2-maccabees:6"], "150": ["deuterocanon:2-maccabees:7"],
    "151": ["deuterocanon:2-maccabees:9"], "152": ["deuterocanon:2-maccabees:15"],
}
# Two files share plate number 095 and two share 123; keyed by title instead.
OT_BY_TITLE = {
    "Some Children Are Destroyed by Bears": ["2-kings:2"],
    "Baruch Writes Jeremiah's Prophecies": ["jeremiah:36"],
    "The Prophet Jeremiah": ["jeremiah:1"],
}

P30 = "pismo"   # Pismo Święte w obrazach Gustawa Doré (Warsaw, 1930), page index in sorted order
P74 = "p1874"   # Pismo Święte Starego i Nowego Testamentu, vol. 2 (Warsaw, 1874)
# NT: gallery title -> (source, tags, page rotation). Source is a Polona page index or a Commons file.
NT = {
    "The Annunciation": ((P30, 156), ["luke:1"], 0),
    "The Nativity": ((P30, 157), ["luke:2"], 0),
    "The Wise Men Guided by the Star": ((P30, 158), ["matthew:2"], 0),
    "The Flight Into Egypt": ((P30, 159), ["matthew:2"], 0),
    "The Massacre of the Innocents": ((P30, 160), ["matthew:2"], 0),
    "Jesus With the Doctors": ((P30, 161), ["luke:2"], 0),
    "John the Baptist Preaching in the Wilderness": ((P30, 162), ["matthew:3", "mark:1"], 0),
    "The Baptism of Jesus": ((P30, 163), ["matthew:3", "mark:1"], 0),
    "The Temptation of Jesus": ((P30, 164), ["matthew:4", "luke:4"], 0),
    "The Marriage in Cana": ((P30, 165), ["john:2"], 0),
    "The Buyers and Sellers Driven Out of the Temple": ((P30, 166), ["john:2"], 0),
    "Jesus and the Woman of Samaria": ((P30, 169), ["john:4"], 0),
    "Jesus Preaching at the Sea of Galilee": ((P30, 173), ["luke:5"], 0),
    "The Disciples Plucking Corn on the Sabbath": ((P30, 175), ["matthew:12", "mark:2"], 0),
    "The Sermon on the Mount": ((P30, 172), ["matthew:5"], 0),
    "Mary Magdalene Repentant": ((P30, 177), ["luke:7"], 0),
    "The Dumb Man Possessed": ((P30, 180), ["matthew:9", "matthew:12"], 0),
    "Jesus Stilling the Tempest": ((P30, 174), ["mark:4"], 0),
    "Jesus Raising Up the Daughter of Jairus": ((P30, 171), ["luke:8"], 0),
    "Christ in the Synagogue": ((P30, 193), ["luke:4"], 0),
    "Christ Feeding the Multitude": ((P30, 178), ["matthew:14"], 0),
    "Jesus Walking on the Sea": ((P30, 179), ["matthew:14", "john:6"], 270),
    "Jesus Healing the Sick": ("File:Jesus healing the sick (89476181).jpg", ["matthew:15"], 0),
    "The Transfiguration": ((P30, 181), ["matthew:17"], 0),
    "Jesus Healing the Lunatic": ((P30, 182), ["matthew:17"], 0),
    "Jesus and the Woman Taken in Adultery": ((P30, 176), ["john:8"], 0),
    "The Good Samaritan": ((P30, 183), ["luke:10"], 0),
    "Arrival of the Good Samaritan at the Inn": ((P30, 184), ["luke:10"], 0),
    "Jesus at the House of Martha and Mary": ((P30, 185), ["luke:10"], 0),
    "Jesus Preaching to the Multitude": ((P30, 167), ["matthew:4", "luke:12"], 0),
    "The Return of the Prodigal Son": ((P30, 188), ["luke:15"], 90),
    "The Prodigal Son in the Arms of His Father": ((P30, 189), ["luke:15"], 0),
    "Lazarus at the Rich Man's House": ((P30, 186), ["luke:16"], 0),
    "The Pharisee and the Publican": ((P30, 187), ["luke:18"], 0),
    "Jesus Blessing the Little Children": ((P30, 190), ["mark:10", "matthew:19"], 0),
    "Resurrection of Lazarus": ((P30, 191), ["john:11"], 0),
    "Entry of Jesus Into Jerusalem": ((P30, 192), ["matthew:21"], 0),
    "Christ and the Tribute Money": ((P30, 195), ["matthew:22"], 0),
    "The Widow's Mite": ((P30, 194), ["mark:12"], 0),
    "The Last Supper": ((P30, 196), ["mark:14", "matthew:26"], 0),
    "The Agony in the Garden": ((P30, 198), ["luke:22"], 0),
    "Jesus Praying in the Garden": ((P30, 197), ["matthew:26"], 0),
    "The Judas Kiss": ("File:Gustave Doré - The Holy Bible - Plate CXLI, The Judas Kiss.jpg", ["mark:14", "matthew:26"], 0),
    "Peter Denying Christ": ((P30, 201), ["john:18", "luke:22"], 0),
    "Jesus Scourged": ((P30, 202), ["matthew:27", "john:19"], 0),
    "The Crown of Thorns": ((P30, 203), ["john:19"], 0),
    "Christ Presented to the People": ((P30, 204), ["john:19"], 0),
    "Christ Mocked": ((P30, 200), ["matthew:27"], 0),
    "Jesus Falling Beneath the Cross": ((P30, 205), ["luke:23", "mark:15"], 0),
    "The Arrival at Calvary": ((P30, 206), ["john:19", "matthew:27"], 90),
    "The Erection of the Cross": ((P30, 208), ["john:19", "matthew:27"], 0),
    "The Crucifixion": ((P30, 209), ["luke:23"], 0),
    "Nailing Christ to the Cross": ((P30, 207), ["john:19"], 0),
    "The Darkness at the Crucifixion": ((P30, 210), ["luke:23"], 0),
    "The Descent From the Cross": ((P30, 211), ["matthew:27", "john:19"], 0),
    "The Dead Christ": ((P30, 212), ["matthew:27"], 0),
    "The Burial of Christ": ((P30, 213), ["john:19", "matthew:27"], 0),
    "The Resurrection": ((P30, 214), ["mark:16", "matthew:28"], 0),
    "Jesus and the Disciples Going to Emmaus": ((P30, 215), ["luke:24"], 0),
    "The Miraculous Draught of Fishes": ((P30, 170), ["luke:5"], 0),
    "The Ascension": ((P30, 216), ["acts:1", "mark:16"], 0),
    "The Descent of the Spirit": ((P30, 217), ["acts:2"], 0),
    "The Apostles Preaching the Gospel": ((P30, 218), ["acts:2"], 0),
    "Peter and John at the Beautiful Gate": ((P30, 219), ["acts:3"], 0),
    "Martydom of Stephen": ("File:The Death of Stephen (89485178).jpg", ["acts:7"], 0),
    "Conversion of Saul": ((P30, 221), ["acts:9"], 0),
    "Peter the House of Cornelius": ((P30, 222), ["acts:10"], 0),
    "Peter Delivered From Prison": ((P30, 223), ["acts:12"], 0),
    "Paul at Ephesus": ("File:Paul in Ephesus (89485605).jpg", ["acts:19"], 0),
    "Paul Rescued From the Multitude": ("File:Paul Addresses the Crowd After His Arrest (89485728).jpg", ["acts:21"], 0),
    "Paul Shipwrecked": ((P74, 103), ["acts:27"], 0),
    "Paul Preaching to the Thessalonians": ((P30, 224), ["acts:17", "1-thessalonians:2"], 0),
    "John at Patmos": ((P30, 226), ["revelation:1"], 0),
    "The Vision of Death": ("gallery", ["revelation:6"], 0),
    "The Crowned Virgin: A Vision of John": ((P30, 228), ["revelation:12"], 0),
    "Babylon Fallen": ("gallery", ["revelation:18"], 0),
    "The Last Judgment": ((P30, 230), ["revelation:20"], 0),
    "The New Jerusalem": ((P30, 229), ["revelation:21"], 0),
}
TITLE_FIX = {"Martydom of Stephen": "The Martyrdom of Stephen",
             "Peter the House of Cornelius": "Peter at the House of Cornelius",
             "The Dumb Man Possessed": "Jesus Heals a Mute Man Possessed by a Demon"}
# Gallery NT entries with no public-domain copy on Commons (only Flickr "No restrictions" scans).
# They come from the Internet Archive copy of the Bibliothèque nationale de France scan of the 1866
# Tours (Mame) edition, volume 2: (item, leaf) -> tags. The leaf is the "n" page number on archive.org.
IA_1866 = "bnf-bpt6k10443187"
NT_IA = {"The Daughter of Herod Receiving the Head of John the Baptist": ((IA_1866, 350), ["matthew:14", "mark:6"]),
         # The Commons copy is 561 px wide; this scan is about 2800.
         "Death of Ananias": ((IA_1866, 590), ["acts:5"])}
# Commons NT files that are whole printed pages (margin and caption), cropped to the engraving.
CROP_PAGES = {"File:Gustave Doré - The Holy Bible - Plate CXLI, The Judas Kiss.jpg"}
# Gallery entries that repeat an engraving already listed under another title.
NT_DUPLICATE = {"Jesus Healing the Man Possessed With a Devil": "The Dumb Man Possessed"}


def _polona(kind: str, n: int) -> str:
    return json.load(open(CACHE / "thumbs" / kind / "index.json"))[n]


def specs() -> tuple[list[dict], list[str]]:
    out, rejected = [], []
    for r in gallery():
        title = r["title"]
        m = re.match(r"File:(\d{3}[AB]?)\.", r["file"])
        rotate, crop, ia = 0, False, None
        if m:
            num = m.group(1)
            tags = OT_BY_TITLE.get(title) or OT[num]
            src = r["file"]
            if r["file"] == "File:095.Some Children Are Destroyed by Bears.jpg":
                num = "095B"
            if r["file"] == "File:123.Baruch Writes Jeremiah's Prophecies.jpg":
                num = "123B"
        else:
            num = None
            if title in NT_DUPLICATE:
                rejected.append(f"Doré, {title}: same engraving as '{NT_DUPLICATE[title]}', which is "
                                f"already in the catalog")
                continue
            if title in NT_IA:
                (item, leaf), tags = NT_IA[title]
                ia, crop, src = [item, leaf], True, f"ia:{item}/n{leaf}"
            else:
                source, tags, rotate = NT[title]
                if source == "gallery":
                    src = r["file"]
                elif isinstance(source, tuple):
                    src, crop = _polona(*source), True
                else:
                    src, crop = source, source in CROP_PAGES
        title = TITLE_FIX.get(title, title)
        bible = [t for t in tags if not t.startswith("deuterocanon:")]
        out.append({
            "id": "dore-" + slugify(title),
            "plate": num,
            "commons": src,
            "title": title,
            "artist": "Gustave Doré",
            "year": "1866",
            "tags": [("bible:" + t) for t in bible] + [t for t in tags if t.startswith("deuterocanon:")],
            "crop": crop,
            "rotate": rotate,
            "ia": ia,
            "section": r["section"],
        })
    ids = [s["id"] for s in out]
    dup = {i for i in ids if ids.count(i) > 1}
    assert not dup, dup
    return out, rejected


if __name__ == "__main__":
    s, rej = specs()
    print(len(s), "plates;", len(rej), "rejected")
    for x in rej:
        print("  ", x)
