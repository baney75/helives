"""Philo is withdrawn: CCEL's text is the 1993 Hendrickson revision, and a stricter check against the
1854 Bohn scans found 1993 wording in every treatise. Nothing of Philo is hosted until a hand review clears it."""
from __future__ import annotations

import sys
import tempfile
import tomllib
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "extra3"))
import ingest_philo  # noqa: E402


def is_philo(path: Path) -> bool:
    work = tomllib.loads(path.read_text()).get("work", {})
    return work.get("author") == "philo" or str(work.get("id", "")).startswith("philo-")


class PhiloWithdrawnTest(unittest.TestCase):
    def test_no_philo_text_is_hosted(self) -> None:
        self.assertEqual(sorted((ROOT / "library" / "jewish").glob("philo/*")), [])
        self.assertEqual([p for p in (ROOT / "library").rglob("*.toml") if is_philo(p)], [])

    def test_catalog_lists_no_philo(self) -> None:
        cat = tomllib.loads((ROOT / "library" / "catalog" / "jewish.toml").read_text())
        self.assertNotIn("philo", cat.get("authors", {}))
        self.assertNotIn("Philo", cat["collection"][0]["title"] + cat["collection"][0]["summary"])

    def test_the_author_check_sees_a_philo_work(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "flaccus.toml"
            p.write_text('[work]\nid = "philo-flaccus"\nauthor = "philo"\n')
            self.assertTrue(is_philo(p))
            p.write_text('[work]\nid = "josephus-antiquities"\nauthor = "josephus"\n')
            self.assertFalse(is_philo(p))

    def test_ingest_write_refuses_before_reading_anything(self) -> None:
        with mock.patch.object(ingest_philo.ccelwork, "load", side_effect=AssertionError("write() read the source")):
            with self.assertRaises(SystemExit) as cm:
                ingest_philo.write()
        self.assertIn("withdrawn", str(cm.exception.code))


if __name__ == "__main__":
    unittest.main()
