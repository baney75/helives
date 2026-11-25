"""Chunker and speech normalization. Standard library only: python3 -m unittest discover audio/tests"""
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import prep  # noqa: E402

FIX = HERE / "fixtures" / "library"


def plan(path, sid=None):
    w = prep.load_work(path)
    s = next(x for x in w["sections"] if sid is None or str(x["id"]) == sid)
    return w, prep.plan_section(w, s, prep.Lexicon.load())


class Chunker(unittest.TestCase):
    def test_psalm_23(self):
        _, p = plan(FIX / "bible/bsb/19-psalms.toml")
        self.assertEqual(p.chunks[0].text, "Psalm twenty-three.")
        self.assertEqual(p.chunks[0].kind, "title")
        body = " ".join(c.ref_text for c in p.chunks[1:])
        self.assertTrue(body.startswith("A Psalm of David. The Lord is my shepherd; I shall not want."))
        self.assertTrue(body.endswith("in the house of the Lord forever."))
        self.assertNotIn("The Lord Is My Shepherd", body)      # editorial heading skipped
        self.assertNotIn("LORD", body)

    def test_genesis_1_skips_heading_note_ref_and_marker(self):
        _, p = plan(FIX / "bible/bsb/01-genesis.toml")
        self.assertEqual(p.chunks[0].text, "Genesis, chapter one.")
        body = " ".join(c.ref_text for c in p.chunks)
        for gone in ("The Creation", "The First Day", "Elohim", "Hebrews", "[^a]", "John 1"):
            self.assertNotIn(gone, body)
        self.assertIn("morning, the first day.", body)           # em dash -> comma pause

    def test_book_title_read_once(self):
        w = {"id": "w", "title": "W", "collection": "medieval", "sections": []}
        s = {"id": "book-1", "title": "Book One", "level": 1, "blocks": [{"t": "h", "text": "Book One"}]}
        p = prep.plan_section(w, s, prep.Lexicon.load())
        self.assertEqual(" ".join(c.ref_text for c in p.chunks).count("Book One"), 1)

    def test_limits_and_whole_sentences(self):
        for path in (FIX / "bible/bsb/01-genesis.toml", FIX / "bible/bsb/19-psalms.toml"):
            _, p = plan(path)
            for c in p.chunks:
                self.assertLessEqual(len(c.text), prep.MAX_CHARS)
                self.assertRegex(c.ref_text, r"[.!?][”’\"]?$", c.ref_text)   # ends at a sentence end

    def test_text_is_complete_and_in_order(self):
        w, p = plan(FIX / "bible/bsb/01-genesis.toml")
        expected = " ".join(prep.normalize(b["text"], bible=True)
                            for b in w["sections"][0]["blocks"] if b["t"] == "v")
        got = " ".join(c.ref_text for c in p.chunks[1:])
        self.assertEqual(re.sub(r"\s+", " ", got), re.sub(r"\s+", " ", expected))

    def test_verse_anchors_point_at_verse_start(self):
        w, p = plan(FIX / "bible/bsb/01-genesis.toml")
        verses = {f"v{b['n']}": prep.normalize(b["text"], bible=True)
                  for b in w["sections"][0]["blocks"] if b["t"] == "v"}
        seen = []
        for c in p.chunks[1:]:
            words = c.ref_text.split()
            for anchor, widx in c.anchors:
                seen.append(anchor)
                self.assertEqual(" ".join(words[widx:widx + 3]), " ".join(verses[anchor].split()[:3]), anchor)
        self.assertEqual(seen, [f"v{n}" for n in range(1, 32)])

    def test_pauses(self):
        _, p = plan(FIX / "bible/bsb/01-genesis.toml")
        self.assertEqual(p.chunks[0].pause_before_ms, prep.PAUSE_LEAD_MS)
        self.assertEqual(p.chunks[1].pause_before_ms, prep.PAUSE_TITLE_MS)
        self.assertEqual({c.pause_before_ms for c in p.chunks[2:]}, {prep.PAUSE_PARA_MS, prep.PAUSE_SENT_MS})

    def test_long_sentence_splits_at_clauses(self):
        s = "; ".join(f"clause number {i} goes on for a while with several words" for i in range(12)) + "."
        parts = prep.split_long(s, 120)
        self.assertTrue(all(len(x) <= 120 for x in parts))
        self.assertEqual(" ".join(parts), s)
        self.assertTrue(all(x.endswith((";", ".")) for x in parts))

    def test_balanced_pack_has_no_tiny_tail(self):
        sents = ["A" * 150 + "."] * 3
        out = prep.balanced_pack(sents, 380)
        self.assertEqual(len(out), 2)

    def test_cont_verse_joins_without_new_anchor(self):
        work = {"id": "bsb-song-of-solomon", "collection": "bible", "book_number": 22, "chapters": 8, "title": "Song"}
        sec = {"id": "1", "blocks": [
            {"t": "v", "n": 4, "p": True, "text": "Take me away with you,"},
            {"t": "h", "text": "The Friends"},
            {"t": "v", "n": 4, "p": True, "cont": True, "text": "we will rejoice in you."},
            {"t": "v", "n": 5, "text": "I am dark."}]}
        p = prep.plan_section(work, sec)
        self.assertEqual(p.chunks[0].text, "Song of Solomon, chapter one.")
        self.assertEqual(p.chunks[1].ref_text, "Take me away with you, we will rejoice in you. I am dark.")
        self.assertEqual([a for a, _ in p.chunks[1].anchors], ["v4", "v5"])

    def test_single_chapter_book_title(self):
        work = {"id": "bsb-jude", "collection": "bible", "book_number": 65, "chapters": 1, "title": "Jude"}
        self.assertEqual(prep.bible_title(work, {"id": "1"}), "Jude.")

    def test_prose_reads_headings_and_skips_notes(self):
        _, p = plan(FIX / "nicene/augustine/confessions.toml")
        self.assertEqual(p.chunks[0].text, "Book One.")
        self.assertEqual(p.chunks[1].kind, "heading")
        self.assertEqual(p.chunks[1].text, "Chapter One, He Proclaims the Greatness of God.")
        body = " ".join(c.ref_text for c in p.chunks)
        self.assertNotIn("145", body)
        self.assertNotIn("See note", body)
        self.assertTrue(any("greek-transliterated" in c.flags and "hebrew-skipped" in c.flags for c in p.chunks))

    def test_english_detection(self):
        work = {"id": "x", "collection": "creeds"}
        greek = prep.plan_section(work, {"id": "greek", "title": "Greek", "blocks": [
            {"t": "p", "text": "Πιστεύομεν εἰς ἕνα Θεὸν Πατέρα παντοκράτορα, πάντων ὁρατῶν τε καὶ ἀοράτων ποιητήν."}]})
        latin = prep.plan_section(work, {"id": "latin", "title": "Latin", "blocks": [
            {"t": "p", "text": "Credo in Deum Patrem omnipotentem, Creatorem caeli et terrae."}]})
        english = prep.plan_section(work, {"id": "text", "title": "Text", "blocks": [
            {"t": "p", "text": "I believe in God the Father Almighty, Maker of heaven and earth."}]})
        self.assertFalse(prep.is_english(greek))
        self.assertFalse(prep.is_english(latin))
        self.assertTrue(prep.is_english(english))

    def test_queue_order(self):
        names = [p.name for _, p in prep.queue(FIX)]
        if prep.GATE.exists():
            self.assertEqual(names[0], "gate.toml")  # the daily gate's prayers render first
            names = names[1:]
        self.assertEqual(names, ["19-psalms.toml", "01-genesis.toml", "confessions.toml"])


class Normalize(unittest.TestCase):
    def n(self, s, **kw):
        return prep.normalize(s, **kw)

    def test_numbers(self):
        self.assertEqual(prep.cardinal(969), "nine hundred sixty-nine")
        self.assertEqual(prep.cardinal(144000), "one hundred forty-four thousand")
        self.assertEqual(prep.ordinal(600), "six hundredth")
        self.assertEqual(prep.ordinal(21), "twenty-first")
        self.assertEqual(self.n("Methuselah lived 969 years", bible=True), "Methuselah lived nine hundred sixty-nine years")
        self.assertEqual(self.n("there were 1,000 men", bible=True), "there were one thousand men")
        self.assertEqual(self.n("the 3rd day"), "the third day")
        self.assertEqual(self.n("published in 1886."), "published in eighteen eighty-six.")
        self.assertEqual(self.n("in A.D. 397 he wrote"), "in A D three ninety-seven he wrote")

    def test_scripture_references(self):
        self.assertEqual(self.n("Ps. 23:1"), "Psalm twenty-three, verse one")
        self.assertEqual(self.n("1 Cor. 13:4-7"), "First Corinthians thirteen, verses four to seven")
        self.assertEqual(self.n("Rom. v. 8"), "Romans five, verse eight")
        self.assertEqual(self.n("Matt. 5:3"), "Matthew five, verse three")

    def test_abbreviations(self):
        self.assertEqual(self.n("cf. the Son, i.e. the Word, viz. Christ, etc."),
                         "compare the Son, that is the Word, namely Christ, et cetera")
        self.assertEqual(self.n("St. Ignatius"), "Saint Ignatius")

    def test_roman_numerals_in_titles(self):
        self.assertEqual(self.n("Book XII"), "Book Twelve")
        self.assertEqual(self.n("Chapter IV.—Of God"), "Chapter Four, Of God")
        self.assertEqual(self.n("I said, I will"), "I said, I will")      # the pronoun stays

    def test_markup_brackets_dashes(self):
        self.assertEqual(self.n("*A Psalm of David.* The LORD is my shepherd;[^a] I"),
                         "A Psalm of David. The Lord is my shepherd; I")
        self.assertEqual(self.n("the Lord GOD said"), "the Lord God said")
        self.assertEqual(self.n("He went [up] to the city [See Note 3.] at once"), "He went up to the city at once")
        self.assertEqual(self.n("morning—the first day"), "morning, the first day")
        self.assertEqual(self.n("life—I have given"), "life, I have given")

    def test_greek_and_hebrew(self):
        flags = set()
        self.assertEqual(self.n("the word λόγος here", flags=flags), "the word logos here")
        self.assertEqual(self.n("Ἰησοῦς"), "Iesous")
        self.assertEqual(self.n("peace שָׁלוֹם be", flags=flags), "peace be")
        self.assertEqual(flags, {"greek-transliterated", "hebrew-skipped"})

    def test_lexicon_respelling_changes_only_tts_text(self):
        lex = prep.Lexicon(respell={"Habakkuk": "Huh-BACK-uk"})
        work = {"id": "bsb-habakkuk", "collection": "bible", "book_number": 35, "chapters": 3, "title": "Habakkuk"}
        p = prep.plan_section(work, {"id": "1", "blocks": [{"t": "v", "n": 1, "text": "The burden that Habakkuk saw."}]}, lex)
        self.assertIn("Huh-BACK-uk", p.chunks[1].text)
        self.assertIn("Habakkuk", p.chunks[1].ref_text)
        self.assertEqual(p.chunks[0].text, "Huh-BACK-uk, chapter one.")

    def test_hast_is_respelled_so_it_cannot_be_read_as_has(self):
        lex = prep.Lexicon.load()
        self.assertEqual(lex.apply("Blessed Lord, who hast caused"), "Blessed Lord, who hassed caused")

    def test_choirmaster_is_read_as_two_words(self):
        self.assertEqual(prep.Lexicon.load().apply("For the choirmaster."), "For the choir master.")


if __name__ == "__main__":
    unittest.main()
