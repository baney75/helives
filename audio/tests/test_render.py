"""Guard, lock, state machine and assembly, with a simulated guard and a fake TTS/ASR engine.

Needs numpy, soundfile and ffmpeg (run on Parish1 with the voice venv's python). No GPU use:
the fake engine writes synthetic audio and scripted transcripts.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402

import guard as guard_mod  # noqa: E402
import prep  # noqa: E402
import render  # noqa: E402
import takecheck  # noqa: E402
from state import State  # noqa: E402

FIX = HERE / "fixtures" / "library"
SR = 24000


class FakePM:
    """Stands in for parish_media: same function names and the same not_ready() rule."""
    RESIDENT = {"voxtype"}

    def __init__(self, state_dir):
        self.STATE = Path(state_dir)
        self.ac = True
        self.compute = []          # ["pid (name)"]
        self.used_mib = 400
        self.util = 0

    def on_ac(self):
        return self.ac

    def gpu(self):
        return {"used_mib": self.used_mib, "utilization_percent": self.util}

    def foreign_compute(self):
        return list(self.compute)

    def not_ready(self, gpu_check=True):
        if not self.ac:
            return "Connect Parish1 to AC power before generation."
        if not gpu_check:
            return None
        if self.compute or self.used_mib > 1500 or self.util > 15:
            return f"GPU is in use; finish the existing work first: {self.gpu()}, compute={self.compute}"
        return None


class FakeGuard(guard_mod.Guard):
    def __init__(self, tmp, procs=None):
        self.fake_procs = procs if procs is not None else {}
        super().__init__(pm=FakePM(tmp), procs=lambda: dict(self.fake_procs), lock_dir=Path(tmp))


def word_audio(n_words, seed=0, gap_at=None, cut_end=False, wps=2.5):
    """Synthetic speech-like audio: one tone burst per word, short gaps, quiet lead and tail."""
    rng = np.random.default_rng(seed)
    word_s = 1 / wps - 0.1
    parts = [np.zeros(int(0.2 * SR), np.float32)]
    for i in range(n_words):
        t = np.arange(int(word_s * SR)) / SR
        env = np.hanning(len(t)) if not (cut_end and i == n_words - 1) else np.ones(len(t))
        parts.append((0.3 * env * np.sin(2 * np.pi * (180 + 40 * rng.random()) * t)).astype(np.float32))
        parts.append(np.zeros(int((2.0 if gap_at == i else 0.1) * SR), np.float32))
    if cut_end:
        parts.pop()
    else:
        parts.append(np.zeros(int(0.3 * SR), np.float32))
    return np.concatenate(parts)


class FakeEngine:
    """speak() returns synthetic audio; transcribe() returns the reference text with word times,
    damaged for chunks listed in `bad` (text -> number of bad attempts, or 'always')."""
    load_seconds = 0.01
    model_info = {"repo_id": "fake/tts", "revision": "0"}

    def __init__(self, bad=None, explode_on=None, on_speak=None):
        self.bad = dict(bad or {})
        self.explode_on = explode_on
        self.on_speak = on_speak
        self.calls = []
        self.current = None

    def speak(self, text, speaker, seed, words, temperature):
        if self.explode_on and self.explode_on in text:
            raise RuntimeError("simulated crash")
        self.calls.append((text, speaker, seed, temperature))
        self.current = text
        if self.on_speak:
            self.on_speak(len(self.calls))
        return word_audio(words, seed), SR, 0.5

    def transcribe(self, audio, sr):
        words = self.current.split()
        left = self.bad.get(self.current, 0)
        if left == "always" or left > 0:
            if left != "always":
                self.bad[self.current] = left - 1
            words = words[: len(words) // 2]
        step = (len(audio) / sr) / max(1, len(words))
        return " ".join(words), [{"word": w, "start": i * step, "end": (i + 1) * step} for i, w in enumerate(words)], 0.1


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        for name, val in (("DATA", root), ("DB", root / "state.db"), ("TAKES", root / "takes"),
                          ("OUT", root / "out"), ("REVIEW", root / "review.tsv")):
            setattr(render, name, val)
        render.LIBRARY = FIX
        render.MIN_FREE_GB = 0
        self.st = State(render.DB)
        render.sync_queue(self.st, FIX, quiet=True)
        self.st.set("voice", {"speaker": "Ryan", "instruct": render.INSTRUCT})
        self.guard = FakeGuard(root)
        self.args = SimpleNamespace(minutes=30, only=["bsb-psalms/23"])

    def tearDown(self):
        self.guard.release()
        self.st.close()
        self.tmp.cleanup()

    def chunk_rows(self, wid="bsb-psalms", sid="23"):
        return self.st.section_chunks(wid, sid)


class GuardRules(Base):
    def test_start_rule_is_parish_media_not_ready(self):
        self.assertIsNone(self.guard.not_ready())
        self.guard.pm.compute = ["123 (python)"]
        self.assertIn("GPU is in use", self.guard.not_ready())
        self.guard.pm.compute = []
        self.guard.pm.used_mib = 1772
        self.assertIn("GPU is in use", self.guard.not_ready())
        self.guard.pm.used_mib = 400
        self.guard.pm.ac = False
        self.assertIn("AC power", self.guard.not_ready())

    def test_lock_is_exclusive_and_released(self):
        other = FakeGuard(self.tmp.name)
        self.assertTrue(self.guard.acquire())
        self.assertFalse(other.acquire())          # a parish-media job would fail the same way
        self.guard.release()
        self.assertTrue(other.acquire())
        other.release()

    def test_stop_rules_during_batch(self):
        me = os.getpid()
        self.guard.fake_procs = {111: {"type": "G", "mib": 3, "name": "kwin"}}
        base = self.guard.baseline({me})
        self.guard.fake_procs[me] = {"type": "C", "mib": 6000, "name": "python"}
        self.guard.pm.used_mib = 6400
        self.assertIsNone(self.guard.stop_reason(base, {me}))       # our own memory does not count
        self.guard.fake_procs[222] = {"type": "G", "mib": 5, "name": "firefox"}
        self.assertIsNone(self.guard.stop_reason(base, {me}))       # a small new window is fine
        self.guard.pm.ac = False
        self.assertIn("AC power", self.guard.stop_reason(base, {me}))
        self.guard.pm.ac = True
        self.guard.pm.compute = [f"{me} (python)"]
        self.assertIsNone(self.guard.stop_reason(base, {me}))       # ourselves in the compute list
        self.guard.pm.compute = [f"{me} (python)", "333 (python)"]
        self.assertIn("compute process", self.guard.stop_reason(base, {me}))
        self.guard.pm.compute = []
        self.guard.fake_procs[444] = {"type": "G", "mib": 900, "name": "game.exe"}
        self.assertIn("game", self.guard.stop_reason(base, {me}))
        del self.guard.fake_procs[444]
        self.guard.pm.used_mib = 6400 + 1500
        self.assertIn("grew", self.guard.stop_reason(base, {me}))


class StateMachine(Base):
    def test_all_good_chunks_done_on_first_take(self):
        rc = render.batch(self.args, FakeEngine, self.guard, self.st)
        self.assertEqual(rc, 0)
        rows = self.chunk_rows()
        self.assertTrue(all(r["status"] == "done" and r["attempts"] == 1 for r in rows))
        for r in rows:
            self.assertTrue(Path(self.st.take(r["best_take"])["path"]).exists())
        self.assertEqual(self.chunk_rows("bsb-genesis", "1")[0]["status"], "pending")   # --only respected

    def test_retry_with_new_seed_then_accept(self):
        text = self.chunk_rows()[1]["text"]
        eng = FakeEngine(bad={text: 2})
        render.batch(self.args, lambda: eng, self.guard, self.st)
        r = self.chunk_rows()[1]
        self.assertEqual((r["status"], r["attempts"]), ("done", 3))
        seeds = [c[2] for c in eng.calls if c[0] == text]
        self.assertEqual(len(set(seeds)), 3)
        takes = self.st.takes_for(r)
        self.assertEqual([t["accepted"] for t in takes], [0, 0, 1])
        self.assertIn("wer", json.loads(takes[0]["problems"]))
        self.assertFalse(Path(takes[0]["path"]).exists())             # rejected audio removed
        self.assertTrue(Path(takes[2]["path"]).exists())

    def test_stutter_under_wer_threshold_is_rejected(self):
        text = self.chunk_rows()[1]["text"]
        eng = FakeEngine()
        real = eng.transcribe

        def stutter(audio, sr):
            t, words, s = real(audio, sr)
            if eng.current == text and len([c for c in eng.calls if c[0] == text]) == 1:
                words.insert(5, dict(words[5]))          # one doubled word in ~70: WER 1.4%
            return t, words, s
        eng.transcribe = stutter
        render.batch(self.args, lambda: eng, self.guard, self.st)
        takes = self.st.takes_for(self.chunk_rows()[1])
        self.assertLess(takes[0]["wer"], render.WER_MAX)
        self.assertEqual(json.loads(takes[0]["problems"]), ["repeat"])
        self.assertEqual([t["accepted"] for t in takes], [0, 1])

    def test_flagged_after_four_attempts_goes_to_review(self):
        text = self.chunk_rows()[2]["text"]
        render.batch(self.args, lambda: FakeEngine(bad={text: "always"}), self.guard, self.st)
        r = self.chunk_rows()[2]
        self.assertEqual((r["status"], r["attempts"]), ("flagged", 4))
        self.assertIsNotNone(r["best_take"])
        self.assertTrue(Path(self.st.take(r["best_take"])["path"]).exists())
        review = render.REVIEW.read_text().splitlines()
        self.assertEqual(len(review), 2)
        self.assertIn("bsb-psalms\t23\t2\t4", review[1])

    def test_ac_drop_stops_before_next_chunk_and_resumes(self):
        g = self.guard

        def drop(n):
            if n == 1:
                g.pm.ac = False                       # AC lost while chunk 0 renders
        rc = render.batch(self.args, lambda: FakeEngine(on_speak=drop), g, self.st)
        self.assertEqual(rc, 3)
        rows = self.chunk_rows()
        self.assertEqual([r["status"] for r in rows], ["done", "pending", "pending"])   # current chunk finished
        g.pm.ac = True                                # "reboot": a new batch resumes exactly
        eng = FakeEngine()
        self.assertEqual(render.batch(self.args, lambda: eng, g, self.st), 0)
        self.assertEqual([r["status"] for r in self.chunk_rows()], ["done"] * 3)
        self.assertEqual(len(eng.calls), 2)          # chunk 0 not rendered again

    def test_crash_mid_chunk_resumes_at_same_chunk(self):
        text = self.chunk_rows()[1]["text"]
        with self.assertRaises(RuntimeError):
            render.batch(self.args, lambda: FakeEngine(explode_on=text), self.guard, self.st)
        rows = self.chunk_rows()
        self.assertEqual([(r["status"], r["attempts"]) for r in rows], [("done", 1), ("pending", 0), ("pending", 0)])
        st2 = State(render.DB)                       # new process, same database
        eng = FakeEngine()
        render.batch(self.args, lambda: eng, self.guard, st2)
        st2.close()
        self.assertEqual([c[0] for c in eng.calls], [rows[1]["text"], rows[2]["text"]])

    def test_new_gpu_process_stops_batch(self):
        g = self.guard

        def game(n):
            g.fake_procs[999] = {"type": "G", "mib": 2048, "name": "steam game"}
        rc = render.batch(SimpleNamespace(minutes=30, only=None), lambda: FakeEngine(on_speak=game), g, self.st)
        self.assertEqual(rc, 3)
        self.assertEqual(sum(1 for r in self.st.db.execute("SELECT status FROM chunks") if r[0] == "done"), 1)

    def test_time_budget(self):
        rc = render.batch(SimpleNamespace(minutes=0, only=None), FakeEngine, self.guard, self.st)
        self.assertEqual(rc, 0)
        last = self.st.db.execute("SELECT end_reason FROM batches ORDER BY id DESC").fetchone()[0]
        self.assertEqual(last, "time budget reached")

    def test_text_change_rerenders_only_changed_chunk(self):
        render.batch(self.args, FakeEngine, self.guard, self.st)
        work = prep.load_work(FIX / "bible/bsb/19-psalms.toml")
        sec = work["sections"][0]
        for b in sec["blocks"]:
            if b.get("n") == 6:
                b["text"] = b["text"].replace("forever", "for all time")
        plans = [prep.plan_section(work, sec, prep.Lexicon.load())]
        self.st.sync_work(work, 0, "changed", plans, {})
        self.assertEqual([r["status"] for r in self.chunk_rows()], ["done", "done", "pending"])

    def test_audition_picks_ryan_unless_aiden_clearly_better(self):
        self.st.set("voice", None)
        self.st.db.execute("DELETE FROM meta WHERE key='voice'")
        eng = FakeEngine(bad={render.AUDITION_NAMES: 1})   # Ryan's first names take is poor
        render.batch(self.args, lambda: eng, self.guard, self.st)
        voice = self.st.get("voice")
        self.assertEqual(voice["speaker"], "Aiden")
        report = json.loads((render.DATA / "audition" / "report.json").read_text())
        self.assertEqual(len(report["takes"]), 12)
        self.st.db.execute("DELETE FROM meta WHERE key='voice'")
        render.batch(self.args, FakeEngine, self.guard, self.st)
        self.assertEqual(self.st.get("voice")["speaker"], "Ryan")


class Supervisor(Base):
    def make(self, ready=True):
        sup = render.Supervisor(once=True, only=["bsb-psalms/23"])
        sup.st, sup.guard = self.st, self.guard
        if not ready:
            self.guard.pm.compute = ["4174991 (ggml-rpc-server)"]
        return sup

    def test_waits_when_not_ready_and_never_starts_a_batch(self):
        sup = self.make(ready=False)
        sup.run_child = lambda: self.fail("batch started while the guard was failing")
        self.assertEqual(sup.loop(), 2)
        self.assertEqual(self.st.get("supervisor")["state"], "waiting")
        self.assertIn("GPU is in use", self.st.get("supervisor")["why"])

    def test_waits_when_parish_media_lock_held(self):
        other = FakeGuard(self.tmp.name)
        other.acquire()
        sup = self.make()
        sup.run_child = lambda: self.fail("batch started without the lock")
        self.assertEqual(sup.loop(), 2)
        self.assertIn("lock", self.st.get("supervisor")["why"])
        other.release()

    def test_holds_lock_only_during_batch(self):
        sup = self.make()
        seen = {}

        def child():
            probe = FakeGuard(self.tmp.name)
            seen["locked_during"] = not probe.acquire()
            return 0
        sup.run_child = child
        self.assertEqual(sup.loop(), 0)
        self.assertTrue(seen["locked_during"])
        probe = FakeGuard(self.tmp.name)
        self.assertTrue(probe.acquire())             # released after the batch
        probe.release()


class TakeChecks(unittest.TestCase):
    def test_clean_take(self):
        info = takecheck.analyze(word_audio(20), SR, 20)
        self.assertEqual(info["problems"], [])
        self.assertAlmostEqual(info["wps"], 2.5, delta=0.3)

    def test_long_silence(self):
        self.assertIn("long-silence", takecheck.analyze(word_audio(20, gap_at=10), SR, 20)["problems"])

    def test_clipped_end(self):
        self.assertIn("clipped-end", takecheck.analyze(word_audio(20, cut_end=True), SR, 20)["problems"])

    def test_pace(self):
        self.assertIn("pace-fast", takecheck.analyze(word_audio(20), SR, 40)["problems"])
        self.assertIn("pace-slow", takecheck.analyze(word_audio(20), SR, 8)["problems"])

    def test_empty(self):
        self.assertEqual(takecheck.analyze(np.zeros(SR), SR, 5)["problems"], ["empty"])

    def test_finish_trims_and_levels(self):
        a = word_audio(10) * 0.2
        info = takecheck.analyze(a, SR, 10)
        out = takecheck.finish(a, SR, info)
        self.assertLess(len(out), len(a))
        self.assertLessEqual(float(np.max(np.abs(out))), 0.951)


class Assembly(Base):
    def test_section_m4a_and_timing_manifest(self):
        render.batch(self.args, FakeEngine, self.guard, self.st)
        self.assertEqual(render.assemble_ready(self.st), 1)
        out = render.OUT / "bsb-psalms" / "23.m4a"
        man = json.loads((render.OUT / "bsb-psalms" / "23.json").read_text())
        probe = json.loads(subprocess.run(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(out)],
            capture_output=True, text=True, check=True).stdout)
        s = probe["streams"][0]
        self.assertEqual((s["codec_name"], s["profile"], s["channels"]), ("aac", "LC", 1))
        # ffmpeg's native AAC encoder targets an average: 48.2 kbps on steady signals, up to ~56 on
        # these synthetic tone bursts (dense transients). Real speech lands near the target.
        self.assertAlmostEqual(int(s["bit_rate"]) / 1000, 48, delta=10, msg=f"stream {s['bit_rate']} format {probe['format']['bit_rate']} dur {probe['format']['duration']}")
        self.assertAlmostEqual(float(probe["format"]["duration"]), man["duration"], delta=0.15)
        loud = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", str(out), "-af", "ebur128", "-f", "null", "-"],
                              capture_output=True, text=True).stderr
        integrated = float(loud.rsplit("I:", 1)[1].split("LUFS")[0])
        self.assertAlmostEqual(integrated, -18.0, delta=1.0)
        verses = [i for i in man["items"] if i["kind"] == "verse"]
        self.assertEqual([v["verse"] for v in verses], [1, 2, 3, 4, 5, 6])
        starts = [v["start"] for v in verses]
        self.assertEqual(starts, sorted(starts))
        # Verse 1 starts after the lead-in, the title and the 1 s title pause.
        title_end = man["chunks"][0]["end"]
        self.assertAlmostEqual(verses[0]["start"], title_end + 1.0, delta=0.05)
        self.assertAlmostEqual(man["chunks"][0]["start"], 0.3, delta=0.01)
        gaps = [round(b["start"] - a["end"], 2) for a, b in zip(man["chunks"], man["chunks"][1:])]
        self.assertEqual(gaps, [1.0, 0.25])        # title pause, then a sentence pause (fixture v5 has no p)
        sec = self.st.db.execute("SELECT status FROM sections WHERE work_id='bsb-psalms'").fetchone()[0]
        self.assertEqual(sec, "assembled")
        self.assertEqual(render.assemble_ready(self.st), 0)          # nothing to redo


if __name__ == "__main__":
    unittest.main()
