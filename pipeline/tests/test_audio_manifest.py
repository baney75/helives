"""audio/manifest.py lists only verified sections: a flagged chunk or an incomplete file keeps it out."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "audio"))
import manifest  # noqa: E402


def stage_section(stage: str, work: str, section: str, flagged: int, data: bytes = b"m4a", size: int | None = None):
    os.makedirs(os.path.join(stage, work), exist_ok=True)
    with open(os.path.join(stage, work, f"{section}.m4a"), "wb") as f:
        f.write(data)
    meta = {"work": work, "section": section, "audio": f"{section}.m4a", "duration": 10.0,
            "bytes": len(data) if size is None else size, "flagged_chunks": flagged}
    with open(os.path.join(stage, work, f"{section}.json"), "w") as f:
        json.dump(meta, f)


class ManifestTest(unittest.TestCase):
    def test_flagged_section_never_listed(self) -> None:
        with tempfile.TemporaryDirectory() as stage:
            stage_section(stage, "first-clement", "chapter-1", flagged=0)
            stage_section(stage, "first-clement", "chapter-2", flagged=2)
            stage_section(stage, "first-clement", "chapter-3", flagged=0, size=999)
            items, skipped, held = manifest.collect(stage, "audio")
        self.assertEqual([i["section"] for i in items], ["chapter-1"])
        self.assertEqual(len(held), 1)
        self.assertIn("chapter-2", held[0])
        self.assertEqual(skipped, ["first-clement/chapter-3.m4a"])

    def test_written_manifest_has_only_verified_items(self) -> None:
        with tempfile.TemporaryDirectory() as stage:
            stage_section(stage, "didache", "chapter-1", flagged=1)
            out = os.path.join(stage, "manifest.json")
            m = manifest.write(stage, "audio", out)
            self.assertEqual(m["items"], [])
            self.assertEqual(json.load(open(out))["files"], 0)


if __name__ == "__main__":
    unittest.main()
