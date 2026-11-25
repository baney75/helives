"""WER normalizer, alignment and verse timing. Standard library only."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import hear  # noqa: E402
import prep  # noqa: E402

LEX = prep.Lexicon.load()


def wer(ref, hyp):
    return hear.score(ref, hyp.split(), LEX)


class Normalizer(unittest.TestCase):
    def test_case_and_punctuation(self):
        r = wer("And God said, “Let there be light,” and there was light.",
                "and God said let there be light and there was light")
        self.assertEqual(r["errors"], 0)

    def test_digits_in_transcript(self):
        self.assertEqual(wer("Psalm twenty-three.", "Psalm 23.")["errors"], 0)
        self.assertEqual(wer("Methuselah lived nine hundred sixty-nine years.", "Methuselah lived 969 years.")["errors"], 0)
        self.assertEqual(wer("Psalm twenty-three, verse one", "Psalm 23:1")["errors"], 1)  # "verse" not heard
        self.assertEqual(wer("the third day", "the 3rd day")["errors"], 0)
        self.assertEqual(wer("one thousand men", "1,000 men")["errors"], 0)

    def test_year_form(self):
        self.assertEqual(wer("in eighteen eighty-six he", "in 1886 he")["errors"], 0)
        self.assertEqual(wer("A D three ninety-seven", "AD 397")["errors"], 0)

    def test_name_variants_and_spelling(self):
        self.assertEqual(wer("Melchizedek king of Salem", "Melchisedec king of Salem")["errors"], 0)
        self.assertEqual(wer("the honour of the Saviour", "the honor of the Savior")["errors"], 0)
        self.assertEqual(wer("O Lord, my God", "Oh Lord my God")["errors"], 0)

    def test_compound_words(self):
        self.assertEqual(wer("seed-bearing plants", "seedbearing plants")["errors"], 0)
        self.assertEqual(wer("for ever and ever", "forever and ever")["errors"], 0)
        self.assertEqual(wer("the everlasting God", "the ever lasting God")["errors"], 0)

    def test_real_errors_count(self):
        r = wer("The Lord is my shepherd; I shall not want.", "The Lord is my shepherd I shall want")
        self.assertEqual((r["errors"], r["dels"]), (1, 1))
        r = wer("He restores my soul.", "He restores my whole soul today")
        self.assertEqual((r["errors"], r["ins"]), (2, 2))
        r = wer("Nebuchadnezzar the king", "Nebuchadnezzar the thing")
        self.assertEqual((r["errors"], r["subs"]), (1, 1))
        self.assertAlmostEqual(r["wer"], 1 / 3, places=3)

    def test_stutter_and_doubled_words_are_repeats(self):
        # From parish-media's own Ryan sample: Whisper heard "The to-tools wake".
        r = wer("The tools wake when we need them.", "The to-tools wake when we need them.")
        self.assertEqual((r["errors"], r["repeats"]), (1, ["to"]))
        self.assertEqual(wer("in the beginning", "in the the beginning")["repeats"], ["the"])
        self.assertEqual(wer("He restores my soul.", "He restores my whole soul")["repeats"], [])
        self.assertEqual(wer("The Lord is my shepherd", "The Lord is my shepherd")["repeats"], [])

    def test_threshold_example(self):
        ref = " ".join(["word"] * 70)
        hyp = " ".join(["word"] * 68 + ["bird", "bird"])
        self.assertLessEqual(wer(ref, hyp)["wer"], 0.03)
        hyp = " ".join(["word"] * 67 + ["bird"] * 3)
        self.assertGreater(wer(ref, hyp)["wer"], 0.03)


class Timing(unittest.TestCase):
    def test_anchor_times_follow_alignment(self):
        ref = "In the beginning God created. Now the earth was void."
        hyp = [{"word": w, "start": i * 0.5, "end": i * 0.5 + 0.4} for i, w in enumerate(
            "In the beginning, God created. Now the earth was void.".split())]
        t = hear.anchor_times(ref, [["v1", 0], ["v2", 5]], hyp, 5.0, LEX)
        self.assertEqual(t, {"v1": 0.0, "v2": 2.5})

    def test_anchor_when_first_word_missed(self):
        ref = "In the beginning. And God said."
        hyp = [{"word": w, "start": i * 0.5, "end": 0} for i, w in enumerate("In the beginning. God said.".split())]
        t = hear.anchor_times(ref, [["v2", 3]], hyp, 3.0, LEX)
        self.assertEqual(t["v2"], 1.5)          # falls forward to "God"

    def test_anchor_fallback_proportional(self):
        t = hear.anchor_times("a b c d", [["v2", 2]], [], 4.0, LEX)
        self.assertEqual(t["v2"], 2.0)

    def test_hassed_counts_as_hast_but_has_does_not(self):
        ref = "Blessed Lord, who hast caused all holy Scriptures to be written for our learning:"
        self.assertEqual(wer(ref, "Blessed Lord who hassed caused all holy scriptures to be written for our learning")["wer"], 0.0)
        self.assertGreater(wer(ref, "Blessed Lord who has caused all holy scriptures to be written for our learning")["wer"], 0.0)

    def test_names_spelled_by_ear_pass_and_misreadings_do_not(self):
        ok = [("A Miktam of David.", "A Mictum of David."), ("A Maskil of Asaph.", "A Mascal of Asaph."),
              ("The cords of Sheol", "The chords of Sheol"), ("my days as handbreadths", "my days as hand-breaths"),
              ("For the choirmaster.", "For the Choir Master.")]
        for ref, heard in ok:
            self.assertEqual((wer(ref, heard)["wer"], wer(ref, heard)["repeats"]), (0.0, []), heard)
        for ref, heard in [("For the choirmaster.", "For the Tri-Master."), ("According to Gittith.", "According to Gethsemane."),
                           ("the waters saw You", "the water saw you")]:
            self.assertGreater(wer(ref, heard)["wer"], 0.0, heard)


if __name__ == "__main__":
    unittest.main()
