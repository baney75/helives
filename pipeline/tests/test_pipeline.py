"""Pipeline checks: the TOML writer round-trips any text, and the validator catches what it claims to."""
from __future__ import annotations

import sys
import tempfile
import tomllib
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from libtoml import count_words, dump_work, slugify, write_work  # noqa: E402
from validate import check_file  # noqa: E402

WORK = {
    "id": "test-work", "title": "Test Work", "author": "test", "collection": "nicene", "order": 1,
    "edition": "test", "source_url": "https://example.org", "retrieved": "2026-11-21",
    "license": "Public domain", "license_basis": "test fixture",
}


def sections(*texts: str) -> list[dict]:
    return [{"id": "s1", "title": "One", "level": 1, "blocks": [{"t": "p", "text": t} for t in texts]}]


class LibTomlTest(unittest.TestCase):
    def test_round_trip_keeps_hard_text_exact(self):
        hard = 'Quote "this" and a back\\slash, a tab\there, Greek ὁμοούσιος, Hebrew יהוה, and \x01 control'
        doc = tomllib.loads(dump_work(WORK, sections(hard, "line one\nline two")))
        self.assertEqual(doc["section"][0]["blocks"][0]["text"], hard)
        self.assertEqual(doc["section"][0]["blocks"][1]["text"], "line one\nline two")

    def test_words_are_recounted_and_footnote_marks_ignored(self):
        secs = sections("In the beginning[^1] was the *Word*.")
        self.assertEqual(count_words(secs), 6)
        self.assertEqual(tomllib.loads(dump_work({**WORK, "words": 999}, secs))["work"]["words"], 6)

    def test_slugify(self):
        self.assertEqual(slugify("On the Holy Spirit — Book I"), "on-the-holy-spirit-book-i")
        self.assertEqual(slugify("Ægidius' Écrits"), "gidius-ecrits")


class ValidateTest(unittest.TestCase):
    def check(self, secs, work=WORK):
        with tempfile.TemporaryDirectory() as d:
            p = write_work(Path(d) / "w.toml", work, secs)
            return check_file(p, {})

    def test_clean_work_passes(self):
        self.assertEqual(self.check(sections("A clean paragraph.")), [])

    def test_catches_leftover_markup_and_entities(self):
        self.assertTrue(any("angle bracket" in e for e in self.check(sections("a <i>tag</i>"))))
        self.assertTrue(any("HTML entity" in e for e in self.check(sections("an &amp; entity"))))
        self.assertTrue(any("page marker" in e for e in self.check(sections("text [Pg 12] more"))))

    def test_catches_control_characters(self):
        # A footnote marker left in a heading put NUL bytes in the search load (2026-11-21).
        secs = sections("clean text")
        secs[0]["title"] = "Song IX. \x00Footnote_I_9\x00 Invocation"
        self.assertTrue(any("control character" in e for e in self.check(secs)))
        self.assertTrue(any("control character" in e for e in self.check(sections("a\x07bell"))))

    def test_catches_orphan_footnotes(self):
        errs = self.check(sections("a mark[^9] with no note"))
        self.assertTrue(any("[^9] has no note" in e for e in errs))

    def test_requires_public_domain(self):
        errs = self.check(sections("text"), {**WORK, "license": "CC BY"})
        self.assertTrue(any("Public domain" in e for e in errs))

    def test_whole_library_validates(self):
        import subprocess
        r = subprocess.run([sys.executable, str(Path(__file__).resolve().parent.parent / "validate.py")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:])


class TitleEcho(unittest.TestCase):
    """A Book section that only repeats its title as a heading prints the title once in Markdown."""

    def test_book_title_once(self):
        import render_md

        doc = {"work": {"id": "w", "title": "W", "collection": "medieval", "author": "a", "license": "Public domain"},
               "section": [{"id": "book-1", "title": "Book I", "level": 1, "blocks": [{"t": "h", "text": "Book I"}]},
                           {"id": "c1", "title": "Chapter 1", "level": 2, "blocks": [{"t": "p", "text": "Text."}]}]}
        md = render_md.render(doc)
        self.assertEqual(md.count("Book I"), 1, md)
        self.assertIn("Text.", md)

    def test_other_headings_stay(self):
        import render_md

        s = {"id": "c", "title": "Chapter 2", "blocks": [{"t": "h", "text": "A subheading"}, {"t": "p", "text": "x"}]}
        self.assertEqual(render_md.title_echo(s), -1)


if __name__ == "__main__":
    unittest.main()
