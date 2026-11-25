"""Public-domain art and artifacts for the evidence pages (/evidence/).

Paintings and icons are public domain by age. The artifact photographs are either public domain or
CC0, a public domain dedication; a CC0 photograph is credited to its photographer. Each
entry: id, Commons file, title, artist, year, tags. Alt text lives in alt_text.py.
"""
from __future__ import annotations

P = [
    ("burnand-disciples", "File:Disciples running by EB.jpg",
     "The Disciples Peter and John Running to the Sepulchre", "Eugène Burnand", "1898", ["bible:john:20"]),
    ("sinai-pantocrator", "File:Spas vsederzhitel sinay (cropped1).jpg",
     "Christ Pantocrator, Saint Catherine's Monastery, Sinai", "Unknown icon painter", "6th century", ["bible:colossians:1"]),
    ("grunewald-resurrection", "File:Matthias Grünewald - Resurrection.jpg",
     "The Resurrection, Isenheim Altarpiece", "Matthias Grünewald", "1512-1516", ["bible:matthew:28"]),
    ("angelico-noli-me-tangere", "File:Fra Angelico - Noli Me Tangere (Cell 1) - WGA00535.jpg",
     "Noli Me Tangere", "Fra Angelico", "1440s", ["bible:john:20"]),
    ("caravaggio-thomas", "File:The Incredulity of Saint Thomas-Caravaggio (1601-2).jpg",
     "The Incredulity of Saint Thomas", "Caravaggio", "c. 1601-1602", ["bible:john:20"]),
    ("caravaggio-emmaus", "File:1602-3 Caravaggio,Supper at Emmaus National Gallery, London.jpg",
     "The Supper at Emmaus", "Caravaggio", "1601", ["bible:luke:24"]),
    ("caravaggio-damascus", "File:Conversion on the Way to Damascus-Caravaggio (c.1600-1).jpg",
     "The Conversion on the Way to Damascus", "Caravaggio", "c. 1600-1601", ["bible:acts:9"]),
    ("ciseri-ecce-homo", "File:Ecce homo by Antonio Ciseri (1).jpg",
     "Ecce Homo", "Antonio Ciseri", "1871", ["bible:john:19"]),
    ("velazquez-crucified", "File:Cristo crucificado.jpg",
     "Christ Crucified", "Diego Velázquez", "c. 1632", ["bible:john:19"]),
    ("hunt-light-of-the-world", "File:Hunt-light-of-the-world.jpeg",
     "The Light of the World", "William Holman Hunt", "1851-1853", ["bible:revelation:3"]),
    ("gerome-martyrs-prayer", "File:Jean-Léon Gérôme - The Christian Martyrs' Last Prayer - Walters 37113.jpg",
     "The Christian Martyrs' Last Prayer", "Jean-Léon Gérôme", "1863-1883", ["work:martyrdom-of-polycarp"]),
    ("papyrus-52", "File:Manchester, John Rylands Library Ms Greek P 457 (Papyrus 52) recto John 18, 31-33.jpg",
     "Papyrus 52, John 18:31-33, John Rylands Library", "Unknown scribe", "2nd century", ["bible:john:18"]),
    ("papyrus-46", "File:Ann Arbor, University of Michigan P.Mich.inv. 6238 (Papyrus 46) fol. 142r - 2 Corinthians 11,33-12,9.jpg",
     "Papyrus 46, 2 Corinthians 11:33 to 12:9, University of Michigan", "Unknown scribe", "c. 175-225", ["bible:2-corinthians:12"]),
    ("isaiah-scroll-53", "File:Great Isaiah Scroll Ch53.jpg",
     "The Great Isaiah Scroll, chapter 53", "Unknown scribe", "2nd century BC", ["bible:isaiah:53"]),
    ("pilate-stone", "File:Pontius Pilate Inscription.JPG",
     "The Pilate Stone from Caesarea, Israel Museum", "Roman inscription", "AD 26-36", ["bible:matthew:27"]),
    ("caiaphas-ossuary", "File:Kayafa's Ossuary 1.JPG",
     "The Caiaphas ossuary, Israel Museum", "Jewish stone carver", "1st century", ["bible:matthew:26"]),
    ("crucified-heel-bone", "File:Nail & Heel Bone Only Known Evidence of Crucifixion, Jerusalem, 1st C. AD (29347803498).jpg",
     "The nailed heel bone of Yehohanan, Israel Museum", "Excavated at Giv'at ha-Mivtar, Jerusalem", "1st century", ["bible:john:19"]),
    ("bethesda-pool", "File:Jerusalem Bethesda BW 1.JPG",
     "The excavated pool of Bethesda, Jerusalem", "Photograph by Berthold Werner", "2008", ["bible:john:5"]),
    ("alexamenos-graffito", "File:Graffito d'Alexamenos.jpg",
     "The Alexamenos graffito, a 1904 drawing", "Unknown artist", "1904", ["bible:1-corinthians:1"]),
    ("tel-dan-stele", "File:Aramaic Inscription on Basalt Monument, Dan, 9th Century BC (43167226572).jpg",
     "The Tel Dan stele, Israel Museum", "Aramaean royal inscription", "9th century BC", ["bible:2-samuel:7"]),
]


def specs() -> list[dict]:
    return [{"id": i, "commons": f, "title": t, "artist": a, "year": y, "tags": tags, "crop": False, "rotate": 0}
            for i, f, t, a, y, tags in P]
