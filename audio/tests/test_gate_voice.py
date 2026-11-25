"""Timing Donovan's gate recordings (gate_voice.py): one start per line, and a wrong reading is refused."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import gate_voice  # noqa: E402

LINES = ["Give us this day our daily bread.", "And lead us not into temptation, but deliver us from evil."]


def heard(text, step=0.5):
    return [{"word": w, "start": 1 + k * step, "end": 1 + k * step + 0.4} for k, w in enumerate(text.split())]


class GateVoice(unittest.TestCase):
    def test_each_line_starts_where_it_is_spoken(self):
        t = gate_voice.timing("lords-prayer", LINES, heard(" ".join(LINES)), 12.0)
        self.assertEqual([(i["id"], i["start"]) for i in t["items"]], [("b0", 0.85), ("b1", 4.35)])

    def test_a_different_reading_is_refused(self):
        with self.assertRaises(ValueError):
            gate_voice.timing("lords-prayer", LINES, heard("I believe in God the Father Almighty"), 12.0)

    def test_a_skipped_short_line_is_refused(self):
        long = [" ".join(f"{w}{k}" for w in ("alpha", "beta", "gamma", "delta") * 5) for k in "abc"]
        lines = long[:2] + ["he descended into hell."] + long[2:]
        self.assertEqual(len(gate_voice.timing("apostles-creed", lines, heard(" ".join(lines)), 60.0)["items"]), 4)
        with self.assertRaisesRegex(ValueError, "he descended into hell"):
            gate_voice.timing("apostles-creed", lines, heard(" ".join(long)), 60.0)


if __name__ == "__main__":
    unittest.main()
