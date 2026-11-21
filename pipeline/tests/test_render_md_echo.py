"""A Book section that only repeats its title as a heading prints the title once in Markdown."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import render_md  # noqa: E402


class TitleEcho(unittest.TestCase):
    def test_book_title_once(self):
        doc = {"work": {"id": "w", "title": "W", "collection": "medieval", "author": "a", "license": "Public domain"},
               "section": [{"id": "book-1", "title": "Book I", "level": 1, "blocks": [{"t": "h", "text": "Book I"}]},
                           {"id": "c1", "title": "Chapter 1", "level": 2, "blocks": [{"t": "p", "text": "Text."}]}]}
        md = render_md.render(doc)
        self.assertEqual(md.count("Book I"), 1, md)
        self.assertIn("Text.", md)

    def test_other_headings_stay(self):
        s = {"id": "c", "title": "Chapter 2", "blocks": [{"t": "h", "text": "A subheading"}, {"t": "p", "text": "x"}]}
        self.assertEqual(render_md.title_echo(s), -1)


if __name__ == "__main__":
    unittest.main()
