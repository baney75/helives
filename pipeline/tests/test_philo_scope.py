"""Philo is withdrawn: CCEL's text is the 1993 Hendrickson revision, and a stricter check against the
1854 Bohn scans found 1993 wording in every treatise. Nothing of Philo is hosted until a hand review clears it."""
from __future__ import annotations

import subprocess
import sys
import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INGEST = ROOT / "pipeline" / "extra3" / "ingest_philo.py"


class PhiloWithdrawnTest(unittest.TestCase):
    def test_no_philo_text_is_hosted(self) -> None:
        self.assertEqual(sorted((ROOT / "library" / "jewish").glob("philo/*")), [])
        hosted = [p for p in (ROOT / "library").rglob("*.toml") if "philo" in tomllib.loads(p.read_text()).get("author", "")]
        self.assertEqual(hosted, [])

    def test_catalog_lists_no_philo(self) -> None:
        cat = tomllib.loads((ROOT / "library" / "catalog" / "jewish.toml").read_text())
        self.assertNotIn("philo", cat.get("authors", {}))
        self.assertNotIn("Philo", cat["collection"][0]["title"] + cat["collection"][0]["summary"])

    def test_ingest_refuses_to_write(self) -> None:
        r = subprocess.run([sys.executable, str(INGEST)], capture_output=True, text=True, timeout=60)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("withdrawn", r.stderr)
        self.assertEqual(sorted((ROOT / "library" / "jewish").glob("philo/*")), [])


if __name__ == "__main__":
    unittest.main()
