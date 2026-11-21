"""Checks for the CCEL ingest. Run: python3 -I -m unittest pipeline/ccel/test_ccel.py (from the repo root)."""
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
import debris  # noqa: E402
from thml import strip_embedded_heads  # noqa: E402


class EmbeddedHead(unittest.TestCase):
    def test_metadata_block_removed_and_tail_kept(self):
        body = ET.fromstring(
            "<ThML.body><div2 id='a'><p>text</p><ThML.head><electronicEdInfo><workID>autolycus_ii</workID>"
            "<DC><DC.Identifier>/ccel/schaff/anf02.iv.ii.ii.html</DC.Identifier></DC></electronicEdInfo>"
            "</ThML.head>tail<div3 id='b'><p>more</p></div3></div2></ThML.body>")
        self.assertEqual(strip_embedded_heads(body), 1)
        flat = "".join(body.itertext())
        self.assertNotIn("autolycus_ii", flat)
        self.assertNotIn("/ccel/", flat)
        self.assertIn("tail", flat)

    def test_library_has_no_ccel_debris(self):
        root = HERE.parents[1] / "library"
        hits = [f for c in ("apostolic", "ante-nicene", "nicene", "aquinas") if (root / c).is_dir()
                for f in (root / c).rglob("*.toml") if debris.scan(f)]
        self.assertEqual(hits, [])

    def test_autolycus_clean(self):
        f = HERE.parents[1] / "library/ante-nicene/theophilus-of-antioch/to-autolycus.toml"
        text = f.read_text().split("[[section]]", 1)[1]  # source_url in [work] legitimately names /ccel/
        self.assertNotIn("autolycus_ii", text)
        self.assertNotIn("/ccel/", text)


if __name__ == "__main__":
    unittest.main()
