"""Philo: only Yonge's 1854 Bohn text is hosted. Ten treatises failed the first scan check because the
CCEL text carries 1993 Hendrickson wording; the ingest corrects every treatise word by word against two
Bohn scans, so each of those ten must now show the Bohn reading and none of the 1993 ones."""
from __future__ import annotations

import csv
import sys
import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "extra3"))
import ingest_philo  # noqa: E402

PHILO = ROOT / "library" / "jewish" / "philo"


def body(slug: str) -> str:
    data = tomllib.loads((PHILO / f"{slug}.toml").read_text(encoding="utf-8"))
    return " ".join(b["text"] for s in data["section"] for b in s["blocks"])


class PhiloScopeTest(unittest.TestCase):
    def test_failed_check_treatises_carry_the_bohn_readings(self) -> None:
        for did, pairs in ingest_philo.FAILED_CHECK.items():
            self.assertIn(did, ingest_philo.TREATISES, did)
            slug = ingest_philo.TREATISES[did][0]
            text = body(slug)
            for old, new in pairs:
                self.assertNotIn(old, text, f"{slug} still has the 1993 reading {old!r}")
                self.assertIn(new, text, f"{slug} lacks the Bohn reading {new!r}")

    def test_dropped_treatises_are_not_written(self) -> None:
        self.assertEqual(set(ingest_philo.DROPPED) & set(ingest_philo.TREATISES), set())
        titles = {tomllib.loads(p.read_text(encoding="utf-8"))["work"]["title"] for p in PHILO.glob("*.toml")}
        dropped = {note.split(":")[0] for note in ingest_philo.DROPPED.values()}
        self.assertEqual(titles & dropped, set())

    @unittest.skipUnless(ingest_philo.CORRECTIONS.exists(), "corrections log is in the local cache only")
    def test_every_treatise_went_through_the_correction(self) -> None:
        with ingest_philo.CORRECTIONS.open(encoding="utf-8") as f:
            logged = {row["treatise"] for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)}
        for did in ingest_philo.FAILED_CHECK:
            self.assertIn(did, logged, f"{did} has no entry in the corrections log")


if __name__ == "__main__":
    unittest.main()
