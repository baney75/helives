"""Write library/catalog/{apostolic,ante-nicene,nicene,aquinas}.toml from the ingested CCEL works.

Each author key is written once, in the catalog of the first collection (in collection order) where it
appears; author keys are global. Dates come from the volume's own notice where it prints them:
the ANF introductory notices open with a bracketed "[A.D. ...]" line, read here from the work's text;
the NPNF 14 council title pages print each council's year. Where the volume prints no dates the
field stays empty. Names and roles are as the volumes style them.

Usage: python3 -I pipeline/ccel/catalog.py
"""
from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from libtoml import LIBRARY, toml_str  # noqa: E402

COLLECTIONS = [
    ("apostolic", "Apostolic Fathers", 3,
     "Writings of the generation after the apostles: Clement of Rome, Ignatius, Polycarp, Barnabas, Hermas, Papias, the Didache and the Epistle to Diognetus, in the Ante-Nicene Fathers translation."),
    ("ante-nicene", "Ante-Nicene Fathers", 4,
     "Christian writings before the Council of Nicaea (A.D. 325), from the American edition of the Ante-Nicene Fathers edited by Roberts, Donaldson and Coxe."),
    ("nicene", "Nicene and Post-Nicene Fathers", 5,
     "Augustine, Chrysostom, Athanasius, the Cappadocians, Jerome and other fathers of the fourth to eighth centuries, with the canons of the seven ecumenical councils, from the two series edited by Philip Schaff and Henry Wace."),
    ("aquinas", "Thomas Aquinas", 7,
     "The Summa Theologica of St. Thomas Aquinas in the translation of the Fathers of the English Dominican Province."),
]

# name, role (as the volumes style them; councils carry the year printed on the NPNF 14 title page)
AUTHORS = {
    "clement-of-rome": ("Clement of Rome", "Bishop of Rome"),
    "mathetes": ("Mathetes", "Author of the Epistle to Diognetus"),
    "polycarp": ("Polycarp", "Bishop of Smyrna"),
    "church-of-smyrna": ("The Church of Smyrna", "Church"),
    "ignatius": ("Ignatius of Antioch", "Bishop of Antioch"),
    "anonymous": ("Anonymous", "Unknown or uncertain author"),
    "barnabas": ("Barnabas", "Author of the Epistle of Barnabas"),
    "papias": ("Papias", "Bishop of Hierapolis"),
    "hermas": ("Hermas", "Author of the Shepherd"),
    "justin-martyr": ("Justin Martyr", "Apologist and martyr"),
    "irenaeus": ("Irenæus", "Bishop of Lyons"),
    "tatian": ("Tatian", "Apologist"),
    "theophilus-of-antioch": ("Theophilus of Antioch", "Bishop of Antioch"),
    "athenagoras": ("Athenagoras", "Apologist"),
    "clement-of-alexandria": ("Clement of Alexandria", "Teacher at Alexandria"),
    "tertullian": ("Tertullian", "Presbyter of Carthage"),
    "pseudo-tertullian": ("Pseudo-Tertullian", "Works once attributed to Tertullian"),
    "minucius-felix": ("Minucius Felix", "Apologist"),
    "commodianus": ("Commodianus", "Christian poet"),
    "origen": ("Origen", "Teacher at Alexandria and Cæsarea"),
    "hippolytus": ("Hippolytus", "Bishop of Portus"),
    "pontius-the-deacon": ("Pontius the Deacon", "Deacon of Carthage, biographer of Cyprian"),
    "cyprian": ("Cyprian", "Bishop of Carthage"),
    "pseudo-cyprian": ("Pseudo-Cyprian", "Works once attributed to Cyprian"),
    "caius": ("Caius", "Presbyter of Rome"),
    "novatian": ("Novatian", "Presbyter of Rome"),
    "gregory-thaumaturgus": ("Gregory Thaumaturgus", "Bishop of Neocæsarea"),
    "dionysius-of-alexandria": ("Dionysius of Alexandria", "Bishop of Alexandria"),
    "julius-africanus": ("Julius Africanus", "Chronographer"),
    "anatolius": ("Anatolius", "Bishop of Laodicea"),
    "alexander-of-cappadocia": ("Alexander of Cappadocia", "Bishop of Jerusalem"),
    "theognostus": ("Theognostus of Alexandria", "Teacher at Alexandria"),
    "pierius": ("Pierius", "Presbyter of Alexandria"),
    "theonas": ("Theonas", "Bishop of Alexandria"),
    "phileas": ("Phileas", "Bishop of Thmuis"),
    "pamphilus": ("Pamphilus", "Presbyter of Cæsarea"),
    "malchion": ("Malchion", "Presbyter of Antioch"),
    "archelaus": ("Archelaus", "Bishop in Mesopotamia"),
    "alexander-of-lycopolis": ("Alexander of Lycopolis", "Writer against the Manichæans"),
    "peter-of-alexandria": ("Peter of Alexandria", "Bishop of Alexandria"),
    "alexander-of-alexandria": ("Alexander of Alexandria", "Bishop of Alexandria"),
    "methodius": ("Methodius", "Bishop of Olympus"),
    "arnobius": ("Arnobius", "Apologist"),
    "lactantius": ("Lactantius", "Rhetorician and apologist"),
    "venantius": ("Venantius", "Christian poet"),
    "asterius-urbanus": ("Asterius Urbanus", "Writer against the Montanists"),
    "victorinus": ("Victorinus", "Bishop of Petau"),
    "dionysius-of-rome": ("Dionysius of Rome", "Bishop of Rome"),
    "council-of-nicaea": ("The First Council of Nicæa", "First Ecumenical Council"),
    "pseudo-clement": ("Pseudo-Clement", "Works once attributed to Clement of Rome"),
    "zephyrinus": ("Zephyrinus", "Bishop of Rome"),
    "callistus": ("Callistus", "Bishop of Rome"),
    "urban-i": ("Urban I", "Bishop of Rome"),
    "pontianus": ("Pontianus", "Bishop of Rome"),
    "anterus": ("Anterus", "Bishop of Rome"),
    "fabian": ("Fabian", "Bishop of Rome"),
    "jacob-of-serug": ("Jacob of Serug", "Syriac poet and bishop"),
    "simeon-metaphrastes": ("Simeon Metaphrastes", "Byzantine hagiographer"),
    "moses-of-chorene": ("Moses of Chorene", "Armenian historian"),
    "bardesan": ("Bardesan", "Syriac writer"),
    "mara-bar-serapion": ("Mara bar Serapion", "Syriac letter writer"),
    "quadratus": ("Quadratus", "Apologist"),
    "aristo-of-pella": ("Aristo of Pella", "Apologist"),
    "melito": ("Melito", "Bishop of Sardis"),
    "hegesippus": ("Hegesippus", "Church historian"),
    "dionysius-of-corinth": ("Dionysius of Corinth", "Bishop of Corinth"),
    "rhodon": ("Rhodon", "Writer against Marcion"),
    "maximus-of-jerusalem": ("Maximus of Jerusalem", "Bishop of Jerusalem"),
    "claudius-apollinaris": ("Claudius Apollinaris", "Bishop of Hierapolis"),
    "polycrates": ("Polycrates", "Bishop of Ephesus"),
    "theophilus-of-caesarea": ("Theophilus of Cæsarea", "Bishop of Cæsarea"),
    "serapion-of-antioch": ("Serapion", "Bishop of Antioch"),
    "apollonius": ("Apollonius", "Writer against the Montanists"),
    "pantaenus": ("Pantænus", "Teacher at Alexandria"),
    "pseudo-irenaeus": ("Pseudo-Irenæus", "Fragments once attributed to Irenæus"),
    "aristides": ("Aristides", "Apologist"),
    "philip-schaff": ("Philip Schaff", "Editor, Nicene and Post-Nicene Fathers"),
    "augustine": ("Augustine of Hippo", "Bishop of Hippo"),
    "albert-henry-newman": ("Albert Henry Newman", "Editor's essayist, Nicene and Post-Nicene Fathers"),
    "chester-d-hartranft": ("Chester D. Hartranft", "Editor's essayist and reviser, Nicene and Post-Nicene Fathers"),
    "benjamin-b-warfield": ("Benjamin B. Warfield", "Editor's essayist, Nicene and Post-Nicene Fathers"),
    "david-schley-schaff": ("David Schley Schaff", "Editor's essayist, Nicene and Post-Nicene Fathers"),
    "john-chrysostom": ("John Chrysostom", "Archbishop of Constantinople"),
    "john-a-broadus": ("John A. Broadus", "Editor's essayist and reviser, Nicene and Post-Nicene Fathers"),
    "arthur-cushman-mcgiffert": ("Arthur Cushman McGiffert", "Translator and editor, Nicene and Post-Nicene Fathers"),
    "eusebius-of-caesarea": ("Eusebius of Cæsarea", "Bishop of Cæsarea, church historian"),
    "ernest-cushing-richardson": ("Ernest Cushing Richardson", "Translator and editor, Nicene and Post-Nicene Fathers"),
    "constantine": ("Constantine the Great", "Roman emperor"),
    "socrates-scholasticus": ("Socrates Scholasticus", "Church historian"),
    "sozomen": ("Sozomen", "Church historian"),
    "blomfield-jackson": ("Blomfield Jackson", "Translator and editor, Nicene and Post-Nicene Fathers"),
    "theodoret": ("Theodoret", "Bishop of Cyrus"),
    "jerome": ("Jerome", "Presbyter and translator of the Vulgate"),
    "gennadius": ("Gennadius", "Presbyter of Marseilles"),
    "william-henry-fremantle": ("William Henry Fremantle", "Translator and editor, Nicene and Post-Nicene Fathers"),
    "rufinus": ("Rufinus", "Presbyter of Aquileia"),
    "anastasius-of-rome": ("Anastasius", "Bishop of Rome"),
    "archibald-robertson": ("Archibald Robertson", "Editor, Nicene and Post-Nicene Fathers"),
    "athanasius": ("Athanasius", "Bishop of Alexandria"),
    "william-moore-and-henry-austin-wilson": ("William Moore and Henry Austin Wilson", "Translators and editors, Nicene and Post-Nicene Fathers"),
    "gregory-of-nyssa": ("Gregory of Nyssa", "Bishop of Nyssa"),
    "cyril-of-jerusalem": ("Cyril of Jerusalem", "Archbishop of Jerusalem"),
    "charles-gordon-browne-and-james-edward-swallow": ("Charles Gordon Browne and James Edward Swallow", "Translators, Nicene and Post-Nicene Fathers"),
    "gregory-nazianzen": ("Gregory Nazianzen", "Archbishop of Constantinople"),
    "basil": ("Basil the Great", "Archbishop of Cæsarea"),
    "e-w-watson": ("E. W. Watson", "Translator, Nicene and Post-Nicene Fathers"),
    "hilary-of-poitiers": ("Hilary of Poitiers", "Bishop of Poitiers"),
    "john-of-damascus": ("John of Damascus", "Monk and theologian"),
    "h-de-romestin": ("H. de Romestin", "Translator, Nicene and Post-Nicene Fathers"),
    "ambrose": ("Ambrose", "Bishop of Milan"),
    "alexander-roberts": ("Alexander Roberts", "Translator and editor, Ante-Nicene and Nicene Fathers"),
    "sulpitius-severus": ("Sulpitius Severus", "Historian and biographer of St. Martin"),
    "vincent-of-lerins": ("Vincent of Lérins", "Monk of Lérins"),
    "edgar-c-s-gibson": ("Edgar C. S. Gibson", "Translator, Nicene and Post-Nicene Fathers"),
    "john-cassian": ("John Cassian", "Monk and abbot at Marseilles"),
    "charles-lett-feltoe": ("Charles Lett Feltoe", "Translator, Nicene and Post-Nicene Fathers"),
    "leo-the-great": ("Leo the Great", "Bishop of Rome"),
    "james-barmby": ("James Barmby", "Translator, Nicene and Post-Nicene Fathers"),
    "gregory-the-great": ("Gregory the Great", "Bishop of Rome"),
    "john-gwynn": ("John Gwynn", "Editor, Nicene and Post-Nicene Fathers"),
    "ephraim-the-syrian": ("Ephraim the Syrian", "Syriac hymn writer and deacon"),
    "aphrahat": ("Aphrahat", "The Persian Sage"),
    "henry-r-percival": ("Henry R. Percival", "Editor, Nicene and Post-Nicene Fathers"),
    "council-of-ancyra": ("The Council of Ancyra", "Provincial synod"),
    "council-of-neocaesarea": ("The Council of Neocæsarea", "Provincial synod"),
    "council-of-gangra": ("The Council of Gangra", "Provincial synod"),
    "synod-of-antioch": ("The Synod of Antioch in Encæniis", "Provincial synod"),
    "synod-of-laodicea": ("The Synod of Laodicea", "Provincial synod"),
    "first-council-of-constantinople": ("The First Council of Constantinople", "Second Ecumenical Council"),
    "council-of-ephesus": ("The Council of Ephesus", "Third Ecumenical Council"),
    "council-of-chalcedon": ("The Council of Chalcedon", "Fourth Ecumenical Council"),
    "second-council-of-constantinople": ("The Second Council of Constantinople", "Fifth Ecumenical Council"),
    "third-council-of-constantinople": ("The Third Council of Constantinople", "Sixth Ecumenical Council"),
    "council-in-trullo": ("The Council in Trullo (Quinisext)", "Council"),
    "council-of-sardica": ("The Council of Sardica", "Council"),
    "council-of-carthage-419": ("The Council of Carthage (419)", "African council"),
    "council-of-constantinople-394": ("The Council of Constantinople under Nectarius", "Council"),
    "council-of-carthage-257": ("The Council of Carthage under Cyprian", "African council"),
    "second-council-of-nicaea": ("The Second Council of Nicæa", "Seventh Ecumenical Council"),
    "thomas-aquinas": ("Thomas Aquinas", "Dominican friar and theologian"),
}

# years printed on the NPNF 14 council title pages (and the anf07 Nicene creed's council)
COUNCIL_DATES = {
    "council-of-nicaea": "325", "council-of-ancyra": "314", "council-of-neocaesarea": "c. 315",
    "council-of-gangra": "325-381", "synod-of-antioch": "341", "synod-of-laodicea": "343-381",
    "first-council-of-constantinople": "381", "council-of-ephesus": "431", "council-of-chalcedon": "451",
    "second-council-of-constantinople": "553", "third-council-of-constantinople": "680-681",
    "council-in-trullo": "692", "council-of-sardica": "343 or 344", "council-of-carthage-419": "419",
    "council-of-constantinople-394": "394", "council-of-carthage-257": "257", "second-council-of-nicaea": "787",
}
NO_DATES = {"anonymous", "church-of-smyrna", "pseudo-tertullian", "pseudo-cyprian", "pseudo-clement", "pseudo-irenaeus"}
AD_RX = re.compile(r"\[(?:a\.d\.|A\.D\.)\s*([^\]]{1,40}?)\.?\]")


def notice_dates(doc: dict) -> str:
    text = " ".join(b["text"] for s in doc["section"][:2] for b in s["blocks"])[:4000]
    m = AD_RX.search(re.sub(r"\[\^[^\]]+\]", "", text))
    if not m:
        return ""
    d = m.group(1).replace("*circa*", "c.").replace("–", "-").replace("—", "-").strip(" .")
    return d


def toml_line(k: str, v) -> str:
    return f"{k} = {v}" if isinstance(v, int) else f"{k} = {toml_str(v)}"


def main() -> int:
    first: dict = {}
    for coll, *_ in COLLECTIONS:
        files = sorted((LIBRARY / coll).rglob("*.toml"), key=lambda p: tomllib.loads(p.read_text())["work"]["order"])
        for f in files:
            doc = tomllib.loads(f.read_text())
            a = doc["work"]["author"]
            if a not in first:
                first[a] = (coll, doc)
    missing = sorted(a for a in first if a not in AUTHORS)
    if missing:
        print("authors without a catalog entry:", missing)
        return 1
    for coll, title, order, summary in COLLECTIONS:
        lines = ["[[collection]]", toml_line("id", coll), toml_line("title", title), toml_line("order", order),
                 toml_line("summary", summary), ""]
        for a, (c, doc) in first.items():
            if c != coll:
                continue
            name, role = AUTHORS[a]
            dates = COUNCIL_DATES.get(a) or ("" if a in NO_DATES else notice_dates(doc))
            lines += [f"[authors.{a}]", toml_line("name", name), toml_line("dates", dates), toml_line("role", role),
                      toml_line("portrait", ""), toml_line("source", doc["work"]["source_url"]), ""]
        path = LIBRARY / "catalog" / f"{coll}.toml"
        text = "\n".join(lines)
        tomllib.loads(text)
        path.write_text(text, encoding="utf-8")
        print(f"{path.relative_to(LIBRARY)}: {sum(1 for c, _ in first.values() if c == coll)} authors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
