"""The daily gate's prayers (audio/gate.toml) render first and carry one timing anchor per gate line."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "audio"))
import prep  # noqa: E402

GATE = ROOT / "audio" / "gate.toml"


class GateAudioTest(unittest.TestCase):
    def test_gate_is_first_in_the_render_queue(self):
        q = prep.queue(ROOT / "library")
        self.assertEqual(q[0], (-1, GATE))
        self.assertTrue(all(prio >= 0 for prio, _ in q[1:]))

    def test_every_line_gets_its_own_anchor_and_is_read_in_full(self):
        work = prep.load_work(GATE)
        self.assertEqual(work["id"], "gate")
        for section, plan in zip(work["sections"], prep.plan_work(GATE)):
            lines = [b["text"] for b in section["blocks"]]
            self.assertEqual(plan.chunks[0].kind, "title")
            body = plan.chunks[1:]
            anchors = [a for c in body for a, _ in c.anchors]
            self.assertEqual(anchors, [f"b{j}" for j in range(len(lines))], section["id"])
            # One chunk per line, except a run_on line, which shares its chunk with the next line.
            # Every line is read in full, and every chunk starts at an anchor.
            runs = sum(1 for b in section["blocks"] if b.get("run_on"))
            self.assertEqual(len(body), len(lines) - runs, section["id"])
            spoken = " ".join(c.ref_text for c in body)
            for line in lines:
                self.assertIn(line.rstrip(".,:"), spoken)
            for c in body:
                self.assertEqual(c.anchors[0][1], 0)
            self.assertTrue(prep.is_english(plan), section["id"])

    def test_ghost_stays_ghost(self):
        text = " ".join(c.text for p in prep.plan_work(GATE) for c in p.chunks)
        self.assertEqual(text.count("Holy Ghost"), 2)


class RunOnTest(unittest.TestCase):
    def test_collect_lines_ending_in_commas_are_one_spoken_sentence(self):
        work = prep.load_work(GATE)
        i = [s["id"] for s in work["sections"]].index("illumination")
        plan = prep.plan_work(GATE)[i]
        texts = [c.text for c in plan.chunks]
        self.assertFalse(any(",." in t for t in texts), texts)
        merged = next(c for c in plan.chunks if "inwardly digest them, that by patience" in c.ref_text)
        self.assertEqual([a for a, _ in merged.anchors], ["b2", "b3", "b4"])


if __name__ == "__main__":
    unittest.main()
