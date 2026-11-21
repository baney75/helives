"""Philo: only Yonge's 1854 Bohn text is hosted. A treatise whose CCEL wording failed the scan check
carries 1993 Hendrickson changes, so the ingest must not write it."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "extra3"))
import ingest_philo  # noqa: E402


class PhiloScopeTest(unittest.TestCase):
    def test_failed_check_treatises_are_not_written(self) -> None:
        held = set(ingest_philo.FAILED_CHECK) & set(ingest_philo.TREATISES)
        self.assertEqual(held, set(), f"treatises with 1993 wording would be written: {sorted(held)}")

    def test_dropped_treatises_are_not_written(self) -> None:
        self.assertEqual(set(ingest_philo.DROPPED) & set(ingest_philo.TREATISES), set())

    def test_library_holds_no_held_out_treatise(self) -> None:
        on_disk = {p.stem for p in (ROOT / "library" / "jewish" / "philo").glob("*.toml")}
        slugs = {info[0] for info in ingest_philo.HELD.values()}
        self.assertEqual(len(slugs), len(ingest_philo.FAILED_CHECK))
        self.assertEqual(on_disk & slugs, set())


if __name__ == "__main__":
    unittest.main()
