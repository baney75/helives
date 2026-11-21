"""Philo: only Yonge's 1854 Bohn text is hosted. The CCEL text is the 1993 Hendrickson revision; the ingest
corrects every treatise word by word against two Bohn scans, compares the result with both scans again,
and holds any treatise with a difference left that is not OCR noise (pipeline/extra3/philo-gate.tsv)."""
from __future__ import annotations

import collections
import csv
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "extra3"))
import ingest_philo  # noqa: E402
import scancheck  # noqa: E402

PHILO = ROOT / "library" / "jewish" / "philo"
CATALOG = ROOT / "library" / "catalog" / "jewish.toml"


def body(slug: str) -> str:
    data = tomllib.loads((PHILO / f"{slug}.toml").read_text(encoding="utf-8"))
    return " ".join(b["text"] for s in data["section"] for b in s["blocks"])


def gate_rows() -> dict:
    with ingest_philo.GATE.open(encoding="utf-8") as f:
        return {row["treatise"]: row for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)}


class PhiloScopeTest(unittest.TestCase):
    def test_failed_check_treatises_carry_the_bohn_readings(self) -> None:
        rows = gate_rows()
        for did, pairs in ingest_philo.FAILED_CHECK.items():
            self.assertIn(did, ingest_philo.TREATISES, did)
            slug = ingest_philo.TREATISES[did][0]
            if rows[did]["status"] == "held":
                self.assertFalse((PHILO / f"{slug}.toml").exists(), f"{slug} is held but still written")
                continue
            text = body(slug)
            for old, new in pairs:
                self.assertNotIn(old, text, f"{slug} still has the 1993 reading {old!r}")
                self.assertIn(new, text, f"{slug} lacks the Bohn reading {new!r}")

    def test_noah_as_planter_there_he_placed(self) -> None:
        # The automated pass refuses this one (page break), so MANUAL must carry it.
        self.assertIn(("there is placed the man", "there he placed the man"), ingest_philo.FAILED_CHECK["iii.xii"])
        fixes = [(old, new) for did, old, new in ingest_philo.MANUAL if did == "iii.xii"]
        self.assertTrue(any("there is placed the man" in old and "there he placed the man" in new
                            and "there is placed" not in new for old, new in fixes), fixes)
        slug = ingest_philo.TREATISES["iii.xii"][0]
        if (PHILO / f"{slug}.toml").exists():
            self.assertNotIn("there is placed the man", body(slug))

    def test_refuse_takes_a_look_alike_both_scans_agree_on(self) -> None:
        vocab = {"these", "those", "then", "than", "number", "numbers"}
        for old, new, why in (("these", "those", "look-alike letters"), ("then", "than", "look-alike letters"),
                              ("numbers", "number", "dropped letter")):
            self.assertEqual(ingest_philo.refuse([old], [new], [False], vocab, agreed=True), "", (old, new))
            # one scan alone, or a scan word that is not a word, is still treated as OCR noise
            self.assertEqual(ingest_philo.refuse([old], [new], [False], vocab, agreed=False), why, (old, new))
        self.assertEqual(ingest_philo.refuse(["these"], ["fhese"], [False], vocab, agreed=True), "not a word")

    @mock.patch.object(ingest_philo, "HOLD_ALL", "")  # the residual check itself, with the blanket hold off
    def test_a_treatise_with_an_unexplained_residual_is_held(self) -> None:
        bohn = ("Now these things being so, we must consider the nature of the soul with great care, "
                "and those who love wisdom will follow the argument to its end and rejoice in it. ")
        with tempfile.TemporaryDirectory() as tmp:
            pa, pb, pc = Path(tmp, "a.txt"), Path(tmp, "b.txt"), Path(tmp, "c.txt")
            pa.write_text(bohn)
            pb.write_text(bohn)
            pc.write_text(bohn.replace("those who love", "thoso who love"))  # B misreads the word
            a, b, c = scancheck.Scan([pa]), scancheck.Scan([pb]), scancheck.Scan([pc])
            vocab = {t[0] for t in scancheck.tokens(bohn)} | {"them"}

            def secs(text):
                return [{"id": "text", "blocks": [{"t": "p", "text": text}]}]
            same = secs(bohn.strip())
            st, rows = ingest_philo.residual(same, a, b, vocab)
            self.assertEqual((st["unexplained"], rows), (0, []))
            self.assertEqual(ingest_philo.gate(st), "")
            # the 1993 reading "them who" where both scans read "those who": held
            changed = secs(bohn.strip().replace("those who love", "them who love"))
            st, rows = ingest_philo.residual(changed, a, b, vocab)
            self.assertEqual(st["unexplained"], 1, rows)
            self.assertEqual(rows[0][1:3], ("them", "those"))
            self.assertIn("unexplained", ingest_philo.gate(st))
            # where the two scans disagree the difference is OCR noise, not a reason to hold
            st, rows = ingest_philo.residual(changed, a, c, vocab)
            self.assertEqual((st["unexplained"], st["scans disagree"]), (0, 1))

    @mock.patch.object(ingest_philo, "HOLD_ALL", "")  # the residual check itself, with the blanket hold off
    def test_gate_too_much_uncompared_text_is_held(self) -> None:
        st = collections.Counter(words=1000, unanchored=int(1000 * ingest_philo.UNANCHORED_MAX) + 1)
        self.assertIn("not compared", ingest_philo.gate(st))
        st["unanchored"] = int(1000 * ingest_philo.UNANCHORED_MAX)
        self.assertEqual(ingest_philo.gate(st), "")

    def test_only_treatises_that_pass_the_gate_are_published(self) -> None:
        rows = gate_rows()
        self.assertEqual(set(rows), set(ingest_philo.TREATISES))
        written = {p.stem for p in PHILO.glob("*.toml")}
        catalog = tomllib.loads(CATALOG.read_text(encoding="utf-8"))["collection"][0]["summary"]
        for did, row in rows.items():
            slug, title = ingest_philo.TREATISES[did][:2]
            self.assertEqual(row["slug"], slug)
            if row["status"] == "published":
                self.assertEqual(row["reason"], "")
                self.assertEqual(int(row["unexplained"]), 0, slug)
                self.assertLessEqual(int(row["unanchored"]), ingest_philo.UNANCHORED_MAX * int(row["words"]), slug)
                self.assertIn(slug, written)
                self.assertIn(title, catalog)
                self.assertNotIn("Gaius", body(slug))
            else:
                self.assertEqual(row["status"], "held")
                self.assertTrue(row["reason"], slug)
                self.assertNotIn(slug, written, f"{slug} is held but still written")
                self.assertNotIn(title, catalog, f"catalog summary lists held {title}")
        self.assertEqual(written, {r["slug"] for r in rows.values() if r["status"] == "published"})

    def test_hold_all_publishes_no_philo(self) -> None:
        # Until a hand review settles philo-residual.tsv, no treatise may pass the gate, even a clean one.
        self.assertTrue(ingest_philo.HOLD_ALL)
        self.assertIn(ingest_philo.HOLD_ALL, ingest_philo.gate(collections.Counter(words=1000)))
        self.assertEqual(list(PHILO.glob("*.toml")), [])
        self.assertEqual({r["status"] for r in gate_rows().values()}, {"held"})

    def test_dropped_treatises_are_not_written(self) -> None:
        self.assertEqual(set(ingest_philo.DROPPED) & set(ingest_philo.TREATISES), set())
        titles = {tomllib.loads(p.read_text(encoding="utf-8"))["work"]["title"] for p in PHILO.glob("*.toml")}
        dropped = {note.split(":")[0] for note in ingest_philo.DROPPED.values()}
        self.assertEqual(titles & dropped, set())

    @unittest.skipUnless(ingest_philo.CORRECTIONS.exists(), "corrections log is in the local cache only")
    def test_every_treatise_went_through_the_correction(self) -> None:
        with ingest_philo.CORRECTIONS.open(encoding="utf-8") as f:
            rows = list(csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
        logged = {row["treatise"] for row in rows}
        for did in ingest_philo.FAILED_CHECK:
            self.assertIn(did, logged, f"{did} has no entry in the corrections log")
        self.assertTrue(any(r["treatise"] == "iii.xii" and "there is placed the man" in r["ccel"]
                            and "there he placed the man" in r["bohn"] for r in rows))


if __name__ == "__main__":
    unittest.main()
