"""Philo: only Yonge's 1854 Bohn text is hosted. The CCEL text is the 1993 Hendrickson revision; the ingest
corrects every treatise word by word against two Bohn scans, compares the result with both scans again,
and holds any treatise with a difference left that is not OCR noise (pipeline/extra3/philo-gate.tsv)."""
from __future__ import annotations

import csv
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path

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

    # Synthetic Bohn text for the residual tests: sentences long enough to anchor, with unique 6-word runs.
    S1 = "Now these things being so, we must consider the nature of the soul with great care."
    S2 = "And those who love wisdom will follow the argument to its end and rejoice in it."
    S3 = "For the lawgiver teaches that the mind which is devoted to virtue is never alone."
    S4 = "Therefore let every man who desires instruction listen with attention to these words."

    def residual_of(self, ccel: str, scan_a: str, scan_b: str | None = None):
        """residual() of a one-block treatise against two synthetic scans; returns (counts, unexplained rows)."""
        with tempfile.TemporaryDirectory() as tmp:
            pa, pb = Path(tmp, "a.txt"), Path(tmp, "b.txt")
            pa.write_text(scan_a)
            pb.write_text(scan_a if scan_b is None else scan_b)
            a, b = scancheck.Scan([pa]), scancheck.Scan([pb])
            vocab = {t[0] for t in scancheck.tokens(" ".join((self.S1, self.S2, self.S3, self.S4)))}
            vocab |= {"them", "thus", "indeed", "said"}
            secs = [{"id": "text", "blocks": [{"t": "p", "text": ccel}]}]
            st, rows = ingest_philo.residual(secs, a, b, vocab)
        return st, [r for r in rows if not r[4]]

    def test_a_treatise_with_an_unexplained_residual_is_held(self) -> None:
        bohn = " ".join((self.S1, self.S2, self.S3))
        st, rows = self.residual_of(bohn, bohn)
        self.assertEqual((st["unexplained"], rows), (0, []))
        self.assertEqual(ingest_philo.gate(st), "")
        # the 1993 reading "them who" where both scans read "those who": held
        changed = bohn.replace("those who love", "them who love")
        st, rows = self.residual_of(changed, bohn)
        self.assertEqual(st["unexplained"], 1, rows)
        self.assertEqual(rows[0][1:3], ("them", "those"))
        self.assertIn("unexplained", ingest_philo.gate(st))

    def test_scans_that_disagree_explain_nothing_unless_one_reads_the_ccel_word(self) -> None:
        bohn = " ".join((self.S1, self.S2, self.S3))
        changed = bohn.replace("those who love", "them who love")
        # A reads "those", B misreads it "thoso": neither supports the CCEL "them", so it is held
        st, rows = self.residual_of(changed, bohn, bohn.replace("those who love", "thoso who love"))
        self.assertEqual(st["unexplained"], 1, rows)
        self.assertTrue(ingest_philo.gate(st))
        # B reads the CCEL word: one scan supports it, so it is OCR noise in A
        st, rows = self.residual_of(changed, bohn, changed)
        self.assertEqual((st["unexplained"], st["one scan agrees"]), (0, 1), rows)

    def test_a_sentence_in_neither_scan_is_held(self) -> None:
        bohn = " ".join((self.S1, self.S2, self.S3))
        # a short sentence (under 8 words, so never anchored) the 1993 edition added
        added = " ".join((self.S1, "This verse was added later.", self.S2, self.S3))
        st, rows = self.residual_of(added, bohn)
        self.assertEqual(len(rows), 1, rows)
        self.assertEqual(rows[0][2], "(not found)")
        self.assertTrue(ingest_philo.gate(st))
        # a short sentence that is in both scans, with one word changed, is compared word by word
        short = "Thus indeed Moses said."
        bohn2 = " ".join((self.S1, short, self.S2, self.S3))
        st, rows = self.residual_of(bohn2, bohn2)
        self.assertEqual(st["unexplained"], 0, rows)
        st, rows = self.residual_of(bohn2.replace("Thus indeed Moses said", "Thus indeed Moses spoke"), bohn2)
        self.assertEqual([r[1:3] for r in rows], [("spoke", "said")])

    def test_a_word_dropped_between_sentences_is_held(self) -> None:
        bohn = " ".join((self.S1, self.S2, self.S3))
        ccel = bohn.replace("in it. For the", "in it. The")  # CCEL drops the opening "For"
        st, rows = self.residual_of(ccel, bohn)
        self.assertEqual(st["unexplained"], 1, rows)
        self.assertTrue(any(r[2] == "for" for r in rows), rows)

    def test_a_word_dropped_at_a_running_head_is_held(self) -> None:
        head = " PHILO JUDAEUS. 7 "
        bohn = " ".join((self.S1, self.S2, self.S3)).replace("argument to its", "argument" + head + "to its")
        # the running head alone is page furniture
        st, rows = self.residual_of(" ".join((self.S1, self.S2, self.S3)), bohn)
        self.assertEqual(st["unexplained"], 0, rows)
        # the same page break where CCEL also lacks Bohn's "to" is an omission, not furniture
        st, rows = self.residual_of(" ".join((self.S1, self.S2, self.S3)).replace("argument to its", "argument its"), bohn)
        self.assertEqual(st["unexplained"], 1, rows)

    def test_a_closed_compound_takes_the_bohn_spacing(self) -> None:
        self.assertEqual(ingest_philo.printed(["for", "ever"], ["forever"], ["", " "]), "for ever")
        self.assertEqual(ingest_philo.printed(["all", "accomplished"], ["allaccomplished"], ["", "-"]),
                         "all-accomplished")
        bohn = " ".join((self.S1, self.S2.replace("will follow", "will for ever follow"), self.S3))
        with tempfile.TemporaryDirectory() as tmp:
            pa = Path(tmp, "a.txt")
            pa.write_text(bohn)
            a, b = scancheck.Scan([pa]), scancheck.Scan([pa])
            vocab = {t[0] for t in scancheck.tokens(bohn)} | {"forever"}
            secs = [{"id": "text", "blocks": [{"t": "p", "text": bohn.replace("for ever", "forever")}]}]
            ingest_philo.correct(secs, "test", a, b, vocab, [])
        self.assertIn("will for ever follow", secs[0]["blocks"][0]["text"])

    def test_gate_too_much_uncompared_text_is_held(self) -> None:
        import collections
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
