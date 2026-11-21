"""Public-domain Bible and church-history maps (19th and early 20th century atlases on Commons).

Rule for maps: Commons must state "Public domain" (LicenseShortName, Copyrighted=False) and the map
must be published before 1930. Main sources: Townsend MacCoun, The Holy Land in Geography and in
History (1899); George Adam Smith and J. G. Bartholomew, Atlas of the Historical Geography of the
Holy Land (1915); William R. Shepherd, Historical Atlas (1911/1923); Edward Weller (d. 1884);
Heinrich Kiepert (1903); S. A. Mitchell; Sidney Hall; Edward Wells (1712).
"""
from __future__ import annotations

MC = "Townsend MacCoun"
MCB = "The Holy Land in Geography and in History (1899)"
SM = "George Adam Smith and J. G. Bartholomew"
SH = "William R. Shepherd"


def mc(page: str) -> str:
    return f"File:MACCOUN(1899) {page}.jpg"


B = lambda book, *chs: [f"bible:{book}"] + [f"bible:{book}:{c}" for c in chs]  # noqa: E731

M = [
    # id, file, title, artist, year, region, period, tags
    ("maccoun-dispersion-of-nations", mc("p025 DISPERSION OF THE RACE"), "The Dispersion of the Nations (Genesis 10)", MC, "1899",
     "Ancient Near East", "Primeval history", B("genesis", 10, 11)),
    ("maccoun-canaan-patriarchs", mc("p033 ABOUT 2250-1700 B.C. - CANAAN AT THE TIME OF THE PATRIARCHES"), "Canaan at the Time of the Patriarchs", MC, "1899",
     "Canaan", "Patriarchs", B("genesis", 12, 13, 26)),
    ("maccoun-abram-in-canaan", mc("p035 ABOUT 2300 B.C. - ABRAM IN CANAAN"), "Abram in Canaan", MC, "1899",
     "Canaan", "Patriarchs", B("genesis", 12, 13, 14)),
    ("maccoun-jacob-in-canaan", mc("p041 JACOB IN CANAAN"), "Jacob in Canaan", MC, "1899",
     "Canaan", "Patriarchs", B("genesis", 28, 33, 35)),
    ("maccoun-joseph-in-egypt", mc("p043 JOSEPH IN EGYP"), "Joseph in Egypt", MC, "1899",
     "Egypt", "Patriarchs", B("genesis", 37, 41, 46, 47)),
    ("wells-travels-of-patriarchs-and-israel", "File:A New Map Shewing the Travels of the Patriarchs. As also of the Children of Israel, from Egypt whrough the Wilderness, to the Land of Canaan.jpg",
     "The Travels of the Patriarchs and of the Children of Israel from Egypt to Canaan", "Edward Wells", "1712",
     "Egypt, Sinai and Canaan", "Patriarchs and Exodus", B("genesis", 12) + B("exodus", 12, 13, 14) + B("numbers", 33)),
    ("maccoun-lower-egypt", mc("p047 ABOUT 1440 B.C. - LOWER EGYPT"), "Lower Egypt and the Start of the Exodus", MC, "1899",
     "Egypt", "Exodus", B("exodus", 1, 12, 13, 14)),
    ("maccoun-elim-to-rephidim", mc("p049 ELIM TO REPHIDIM"), "The Exodus Route: Elim to Rephidim", MC, "1899",
     "Sinai Peninsula", "Exodus", B("exodus", 15, 16, 17)),
    ("maccoun-rephidim-to-sinai", mc("p053 REPHIDIM TO MT.SINAI"), "The Exodus Route: Rephidim to Mount Sinai", MC, "1899",
     "Sinai Peninsula", "Exodus", B("exodus", 17, 18, 19)),
    ("maccoun-desert-of-wanderings", mc("p059 DESERT OF THE WANDERINGS, THE NEGEB OR SOUTH COUNTRY"), "The Desert of the Wanderings and the Negeb", MC, "1899",
     "Negev and Sinai", "Wilderness wanderings", B("numbers", 13, 14, 20, 33)),
    ("maccoun-mt-hor-to-arnon", mc("p061 MT.HOR TO RIVER ARNON - ARABIA PETRAEA IN THE SOUTH COUNTRY"), "From Mount Hor to the River Arnon", MC, "1899",
     "Edom and Moab", "Wilderness wanderings", B("numbers", 20, 21) + B("deuteronomy", 2)),
    ("maccoun-canaan-death-of-moses", mc("p063 ABOUT 138 B.C. - CANAAN AT THE DEATH OF MOSES"), "Canaan at the Death of Moses", MC, "1899",
     "Canaan", "Conquest", B("deuteronomy", 34) + B("numbers", 34)),
    ("maccoun-joshua-campaigns", mc("p075 JOSHUA'S CAMAIGNS. THE CONQUEST, WEST OF JORDAN"), "Joshua's Campaigns: The Conquest West of the Jordan", MC, "1899",
     "Canaan", "Conquest", B("joshua", 6, 8, 10, 11)),
    ("maccoun-twelve-tribes", mc("p079 SECOND DIVISION BY JOSHUA"), "The Land Divided among the Twelve Tribes", MC, "1899",
     "Canaan", "Conquest and settlement", B("joshua", 13, 14, 15, 16, 17, 18, 19)),
    ("hall-canaan-twelve-tribes", "File:Sidney Hall, Canaan as divided among the Tribes (FL35098524 3892364).jpg",
     "Canaan as Divided among the Tribes", "Sidney Hall", "c. 1830",
     "Canaan", "Conquest and settlement", B("joshua", 13, 15, 18, 19)),
    ("maccoun-judges", mc("p081 ABOUT 1350 TO 1020 B.C. - ISRAEL, TIME OF THE JUDGES"), "Israel in the Time of the Judges", MC, "1899",
     "Canaan", "Judges", B("judges") + B("ruth")),
    ("maccoun-david-in-wilderness", mc("p089 DAVID IN THE WILDERNESS"), "David in the Wilderness", MC, "1899",
     "Judah", "United monarchy", B("1-samuel", 22, 23, 24, 26)),
    ("maccoun-kingdom-david-solomon", mc("p095 ABOUT 975 TO 930 B.C. - KINGDOM OF DAVID AND SOLOMON"), "The Kingdom of David and Solomon", MC, "1899",
     "Israel and neighbors", "United monarchy", B("2-samuel", 8) + B("1-kings", 4, 9) + B("1-chronicles", 18)),
    ("smith-palestine-david-solomon", "File:Palestine under David and Solomon (Smith, 1915).jpg", "Palestine under David and Solomon", SM, "1915",
     "Israel and neighbors", "United monarchy", B("2-samuel", 5, 8) + B("1-kings", 4)),
    ("maccoun-jerusalem-david-solomon", mc("p097 JERUSALEM - TIME OF DAVID AND SOLOMON"), "Jerusalem in the Time of David and Solomon", MC, "1899",
     "Jerusalem", "United monarchy", B("2-samuel", 5) + B("1-kings", 6, 7) + B("2-chronicles", 3)),
    ("maccoun-division-of-kingdom", mc("p101 ABOUT 930 B.C. - THE DIVISION OF SOLOMON'S KINGDOM"), "The Division of Solomon's Kingdom", MC, "1899",
     "Israel and Judah", "Divided kingdom", B("1-kings", 12) + B("2-chronicles", 10)),
    ("weller-kingdoms-judah-israel", "File:Edward Weller, The Kingdoms of Judah and Israel (FL36012236 3897579).jpg",
     "The Kingdoms of Judah and Israel", "Edward Weller", "before 1884", "Israel and Judah", "Divided kingdom",
     B("1-kings", 12, 15) + B("2-kings")),
    ("maccoun-elijah-elisha", mc("p105 ELIJAH AND ELISHA"), "Elijah and Elisha", MC, "1899",
     "Israel", "Divided kingdom", B("1-kings", 17, 18, 19) + B("2-kings", 2, 4, 5)),
    ("shepherd-assyrian-empire", "File:Shepherd-c-005.jpg", "The Assyrian Empire and the Eastern Mediterranean, 750-625 B.C.", SH, "1911",
     "Ancient Near East", "Assyrian empire", B("2-kings", 15, 17, 18, 19) + B("isaiah", 36) + B("jonah") + B("nahum")),
    ("maccoun-fall-of-israel", mc("p121 722 B.C. FALL OF ISRAEL - TAKEN CAPATIVE BY SARGON"), "The Fall of Israel, 722 B.C.", MC, "1899",
     "Israel", "Assyrian empire", B("2-kings", 17) + B("hosea")),
    ("maccoun-sennacherib-invades-judah", mc("p123 701 B.C. SENNACHERIB INVADES JUDAH"), "Sennacherib Invades Judah, 701 B.C.", MC, "1899",
     "Judah", "Assyrian empire", B("2-kings", 18, 19) + B("isaiah", 36, 37) + B("2-chronicles", 32)),
    ("shepherd-oriental-empires-600bc", "File:Shepherd-c-008.jpg", "The Oriental Empires about 600 B.C.", SH, "1911",
     "Ancient Near East", "Babylonian empire", B("2-kings", 24, 25) + B("jeremiah") + B("daniel", 1) + B("habakkuk")),
    ("maccoun-captivity-of-judah", mc("p127 587 B.C. CAPATIVITY OF JUDAH"), "The Captivity of Judah, 587 B.C.", MC, "1899",
     "Judah and Babylonia", "Babylonian empire", B("2-kings", 25) + B("jeremiah", 39, 52) + B("lamentations") + B("ezekiel")),
    ("shepherd-persian-empire", "File:The Persian Empire about 500 B.C. (William R. Shepherd).jpg", "The Persian Empire about 500 B.C.", SH, "1911",
     "Ancient Near East", "Persian empire", B("ezra", 1) + B("nehemiah", 1) + B("esther", 1) + B("daniel", 6) + B("haggai") + B("zechariah")),
    ("maccoun-palestine-persian-kings", mc("p131 538 B.C.-322 B.C. PALESTINE AND PHOENICIA AT THE TIME OF PERSIAN KINGS"), "Palestine under the Persian Kings", MC, "1899",
     "Palestine", "Persian empire", B("ezra", 2) + B("nehemiah", 3, 7) + B("malachi")),
    ("maccoun-jerusalem-nehemiah", mc("p133 JERUSALEM - TIME OF NEHEMIAH"), "Jerusalem in the Time of Nehemiah", MC, "1899",
     "Jerusalem", "Persian empire", B("nehemiah", 2, 3, 12)),
    ("shepherd-macedonian-empire", "File:Shepherd-c-018-019.jpg", "The Macedonian Empire and the Kingdoms of the Diadochi", SH, "1911",
     "Eastern Mediterranean and Near East", "Hellenistic", B("daniel", 8, 11) + ["topic:intertestamental"]),
    ("maccoun-maccabean-palestine", mc("p143 176 B.C.- 164 B.C. PALESTINE - MACCABEAN PERIOD, AT THE TIME OF JUDAS AND JONATHAN"), "Palestine in the Maccabean Period", MC, "1899",
     "Palestine", "Hasmonean", ["topic:intertestamental", "deuterocanon:1-maccabees:3", "bible:daniel:11"]),
    ("maccoun-kingdom-of-herod", mc("p157 30 B.C.- 4 B.C. KINGDOM OF HEROD THE GREAT"), "The Kingdom of Herod the Great", MC, "1899",
     "Palestine", "Herodian", B("matthew", 2) + B("luke", 1)),
    ("maccoun-palestine-time-of-christ", mc("p175 7 A.D.- 37 A.D. PALESTINE - THE TIME OF THE CHRIST"), "Palestine in the Time of Christ", MC, "1899",
     "Palestine", "Life of Christ", B("matthew") + B("mark") + B("luke", 3) + B("john")),
    ("weller-palestine-time-of-christ", "File:Edward Weller, Palestine in the time of Christ.after Wilson, Kiepert & Menke (FL35098623 3892377).jpg",
     "Palestine in the Time of Christ", "Edward Weller", "before 1884", "Palestine", "Life of Christ",
     B("matthew") + B("mark") + B("luke") + B("john")),
    ("maccoun-galilee-christs-teaching", mc("p177 SCENE OF CHRIST'S TEACHINGS"), "Galilee: The Scene of Christ's Teaching", MC, "1899",
     "Galilee", "Life of Christ", B("matthew", 4, 8, 14) + B("mark", 1, 6) + B("john", 6, 21)),
    ("maccoun-jerusalem-time-of-herod", mc("p179 JERUSALEM, TIME OF HEROD"), "Jerusalem in the Time of Herod and of Jesus", MC, "1899",
     "Jerusalem", "Life of Christ", B("matthew", 21, 27) + B("mark", 11, 15) + B("luke", 19, 23) + B("john", 5, 9, 19)),
    ("jerusalem-time-of-christ-1857", "File:Map of Jerusalem at the Time of Christ.png", "Jerusalem at the Time of Christ", "Unknown engraver", "1857",
     "Jerusalem", "Life of Christ", B("matthew", 21, 26, 27) + B("john", 18, 19)),
    ("maccoun-temple-area", mc("p181 JERUSALEM, PLAN OF THE TEMPLE AREA"), "Jerusalem: Plan of the Temple Area", MC, "1899",
     "Jerusalem", "Life of Christ", B("john", 2, 10) + B("mark", 11, 13) + B("acts", 3)),
    ("weller-roman-empire-apostolic-age", "File:Edward Weller, The Roman Empire.in the Apostolic age (FL36012225 3897577).jpg",
     "The Roman Empire in the Apostolic Age", "Edward Weller", "before 1884", "Roman Empire", "Apostolic age",
     B("acts") + B("romans") + ["collection:apostolic"]),
    ("mitchell-roman-empire-107", "File:Map of the Roman Empire, At the period of its greatest extent about the year A.D. 107. Engraved to illustrate Mitchell's (IA dr map-of-the-roman-empire-at-the-period-of-its-greatest-extent-about-the-yea-4564058).jpg",
     "The Roman Empire at Its Greatest Extent, about A.D. 107", "S. Augustus Mitchell", "1840s",
     "Roman Empire", "c. 100", ["collection:apostolic", "collection:ante-nicene", "author:ignatius", "author:polycarp", "author:clement-of-rome"]),
    ("maccoun-paul-first-second-journeys", mc("p225 PAUL'S 1ST AND 2D TOURS"), "Paul's First and Second Missionary Journeys", MC, "1899",
     "Eastern Mediterranean", "Apostolic age", B("acts", 13, 14, 15, 16, 17, 18) + B("galatians")),
    ("weller-paul-second-journey", "File:Edward Weller, Map showing St. Paul's 2nd missionary journey (FL36012228 3897562).jpg",
     "Paul's Second Missionary Journey", "Edward Weller", "before 1884", "Eastern Mediterranean", "Apostolic age",
     B("acts", 15, 16, 17, 18) + B("philippians") + B("1-thessalonians")),
    ("maccoun-paul-third-journey-and-rome", mc("p227 PAULS 3D TOUR AND VOYAGE TO ROME"), "Paul's Third Missionary Journey and Voyage to Rome", MC, "1899",
     "Eastern Mediterranean", "Apostolic age", B("acts", 18, 19, 20, 21, 27, 28) + B("ephesians") + B("1-corinthians")),
    ("weller-paul-voyage-to-rome", "File:Edward Weller, St. Paul's voyage to Rome (FL36012231 3897563).jpg",
     "Paul's Voyage to Rome", "Edward Weller", "before 1884", "Mediterranean", "Apostolic age", B("acts", 27, 28)),
    ("smith-paul-travels", "File:St. Paul's Travels (Smith, 1915).jpg", "Saint Paul's Travels", SM, "1915",
     "Eastern Mediterranean", "Apostolic age", B("acts", 13, 16, 18, 27)),
    ("knecht-paul-missionary-journeys", "File:A Practical Commentary on Holy Scripture (1910), The Missionary Journeys of St. Paul.jpg",
     "The Missionary Journeys of Saint Paul", "From Knecht, A Practical Commentary on Holy Scripture", "1910",
     "Eastern Mediterranean", "Apostolic age", B("acts", 13, 15, 18, 27)),
    ("smith-seven-churches", "File:Asia Minor showing positions of the Seven Churches (Smith, 1915).jpg", "Asia Minor, Showing the Seven Churches of Revelation", SM, "1915",
     "Asia Minor", "Apostolic age", B("revelation", 1, 2, 3)),
    ("shepherd-asia-minor", "File:Shepherd-c-020.jpg", "Asia Minor under the Greeks and Romans", SH, "1911",
     "Asia Minor", "Greek and Roman", B("acts", 13, 14, 16, 19) + B("galatians") + B("colossians") + B("revelation", 2)),
    ("smith-church-empire-trajan", "File:Church and Empire in the East under Trajan (Smith, 1915).jpg", "Church and Empire in the East under Trajan", SM, "1915",
     "Eastern Roman provinces", "c. 100", ["collection:apostolic", "collection:ante-nicene", "author:ignatius", "author:polycarp"]),
    ("smith-church-empire-constantine", "File:Church and Empire in the East under Constantine (Smith, 1915).jpg", "Church and Empire in the East under Constantine", SM, "1915",
     "Eastern Roman provinces", "Fourth century", ["collection:nicene", "author:eusebius", "author:athanasius", "topic:council-of-nicaea"]),
    ("smith-expansion-of-christianity", "File:Expansion of Christianity (Smith, 1915).jpg", "The Expansion of Christianity", SM, "1915",
     "Roman world", "Early church", ["collection:apostolic", "collection:ante-nicene", "collection:nicene", "bible:acts"]),
    ("shepherd-roman-empire-395", "File:Roman empire 395.jpg", "The Roman Empire about 395", SH, "1923",
     "Roman Empire", "c. 400", ["collection:nicene", "author:augustine", "author:ambrose", "author:jerome", "author:john-chrysostom"]),
    ("kiepert-roman-dioceses-provinces", "File:Heinrich Kiepert. Imperium Romanum in praefecturas, dioceses, provincias divisum.jpg",
     "The Roman Empire Divided into Prefectures, Dioceses and Provinces", "Heinrich Kiepert", "1903", "Roman Empire", "Fourth century",
     ["collection:nicene", "topic:council-of-nicaea", "topic:council-of-chalcedon"]),
    ("maccoun-palestine-constantine", mc("p201 323 A.D. - 336 A.D. PALESTINE IN THE TIME OF CONSTANTINE"), "Palestine in the Time of Constantine", MC, "1899",
     "Palestine", "Fourth century", ["collection:nicene", "author:eusebius", "author:cyril-of-jerusalem"]),
    ("smith-palestine-eusebius-jerome", "File:Palestine according to Eusbius and Jerome - Smith 1915.jpg", "Palestine according to Eusebius and Jerome", SM, "1915",
     "Palestine", "Fourth century", ["author:eusebius", "author:jerome", "collection:nicene"]),
    ("shepherd-christianity-to-1300", "File:Shepherd-c-046-047.jpg", "The Development of Christianity to 1300", SH, "1911",
     "Europe and the Mediterranean", "Early and medieval church", ["collection:ante-nicene", "collection:nicene", "author:gregory-the-great", "author:thomas-aquinas"]),
]


def specs() -> list[dict]:
    out = []
    for mid, f, title, artist, year, region, period, tags in M:
        out.append({"id": mid, "commons": f, "title": title, "artist": artist, "year": year,
                    "region": region, "period": period, "tags": list(dict.fromkeys(tags)),
                    "crop": False, "rotate": 0})
    ids = [m["id"] for m in out]
    assert len(ids) == len(set(ids))
    return out
