#!/usr/bin/env python3
"""Opportunistic, resumable audiobook renderer for the He Lives library (Parish1).

    render.py run                 supervisor loop for helives-audio.service
    render.py once [--only W/S]   one guarded batch now (for tests and first renders), then exit
    render.py sync                prep the library queue into state.db (CPU only)
    render.py assemble            assemble finished sections (CPU only)
    render.py set-voice NAME      change the narrator (re-renders everything; asks for --yes)

The supervisor never imports torch. When parish-media's own readiness check passes and its GPU
lock is free, it holds that lock and starts one child batch process (`render.py batch`) that
loads Qwen3-TTS and Whisper once, renders chunks for up to BATCH_MINUTES, checks every take by
transcribing it, and exits so the GPU is fully released. The child stops before the next chunk
when the guard fails (AC lost, another GPU process, a game). See guard.py for the exact rules.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import signal
import subprocess
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import prep  # noqa: E402
from state import State  # noqa: E402

DATA = Path(os.environ.get("HELIVES_AUDIO_DATA", "/srv/magnus-data/media/helives-audio"))
LIBRARY = Path(os.environ.get("HELIVES_LIBRARY", str(Path.home() / ".local/share/helives-audio/library")))
VOICE_DIR = Path(os.environ.get("PARISH_MEDIA_VOICE", str(Path.home() / ".local/share/parish-media/voice")))
WHISPER = Path(os.environ.get("HELIVES_WHISPER", "/srv/magnus-data/models/asr/whisper-large-v3"))
DB = DATA / "state.db"
TAKES = DATA / "takes"
OUT = DATA / "out"
REVIEW = DATA / "review.tsv"

BATCH_MINUTES = float(os.environ.get("HELIVES_BATCH_MINUTES", "30"))
WAIT_MIN_S, WAIT_MAX_S = 120, 300
MAX_ATTEMPTS = 4                     # first take plus 3 re-renders with new seeds
WER_MAX = float(os.environ.get("HELIVES_WER_MAX", "0.03"))
MIN_FREE_GB = 30
SPEAKERS = ("Ryan", "Aiden")
INSTRUCT = ("Read aloud like a reverent audiobook narrator reading Scripture: a warm, steady, unhurried "
            "voice, clear diction, calm even pace, natural pauses at commas and at the end of sentences.")
LANGUAGE = "English"
SEED_BASE = 1177


def log(msg: str, who: str = "supervisor") -> None:
    print(f"[{who}] {msg}", flush=True)


# ====================================================================== queue sync (CPU)

def _work_key(path: Path, lex_bytes: bytes) -> str:
    h = hashlib.sha256(path.read_bytes())
    h.update(lex_bytes)
    h.update(f"prep-v{prep.PREP_VERSION}".encode())
    return h.hexdigest()[:20]


def sync_queue(st: State, library: Path | None = None, quiet: bool = False) -> dict:
    library = library or LIBRARY
    lex_path = HERE / "lexicon.toml"
    lex_bytes = lex_path.read_bytes() if lex_path.exists() else b""
    lexicon = prep.Lexicon.load(lex_path)
    totals = {"works": 0, "updated": 0, "new": 0, "changed": 0, "removed": 0, "errors": 0, "retired": 0}
    seen: set[str] = set()
    retired: list[str] = []
    for prio, path in prep.queue(library):
        totals["works"] += 1
        try:
            key = _work_key(path, lex_bytes)
            work = prep.load_work(path)
            seen.add(work["id"])
            if st.work_sha(work["id"]) == key:
                continue
            plans = [prep.plan_section(work, s, lexicon) for s in work["sections"]]
            skipped = {}
            for p in plans:
                if not p.chunks:
                    skipped[p.section_id] = "no readable text"
                elif not prep.is_english(p):
                    skipped[p.section_id] = f"original-language text (English ratio {prep.english_ratio(p):.2f})"
            counts = st.sync_work(work, prio, key, plans, skipped)
            retired += counts.pop("retired_paths", [])
            totals["updated"] += 1
            for k in ("new", "changed", "removed"):
                totals[k] += counts[k]
        except Exception as exc:          # one bad file must not stop the queue
            totals["errors"] += 1
            log(f"prep failed for {path}: {exc}")
    # A work that left the library or the queue is withdrawn: its rows and its audio go. Only after a
    # clean pass, so a file that failed to load is never mistaken for a removed one.
    if not totals["errors"]:
        retired += st.retire(seen)
    for p in retired:
        for f in (Path(p), Path(p).with_suffix(".json")):
            f.unlink(missing_ok=True)
        totals["retired"] += 1
    if not quiet and (totals["updated"] or totals["errors"]):
        log(f"queue sync: {totals}")
    return totals


# ====================================================================== assembly (CPU)

def chunk_for_assembly(st: State, c) -> dict:
    import hear
    take = st.take(c["best_take"])
    words = json.loads(take["asr_words"] or "[]")
    anchors = json.loads(c["anchors"])
    times = hear.anchor_times(c["ref_text"], anchors, words, take["duration"] or 0.0, prep.Lexicon.load())
    return {"idx": c["idx"], "audio_path": take["path"], "pause_before_ms": c["pause_before_ms"],
            "anchors": anchors, "ref_text": c["ref_text"], "kind": c["kind"],
            "flagged": c["status"] == "flagged", "wer": take["wer"], "anchor_times": times}


def assemble_ready(st: State) -> int:
    import assemble
    done = 0
    for s in st.sections_ready():
        rows = st.section_chunks(s["work_id"], s["section_id"])
        try:
            chunks = [chunk_for_assembly(st, c) for c in rows]
            m = assemble.assemble_section(dict(s), chunks, OUT / s["work_id"])
            st.mark_assembled(s["work_id"], s["section_id"], str(OUT / s["work_id"] / m["audio"]), m["duration"])
            log(f"assembled {s['work_id']}/{s['section_id']}: {m['duration']:.1f}s, "
                f"{m['flagged_chunks']} flagged chunk(s), {m['loudness']['output_lufs']} LUFS")
            done += 1
        except Exception as exc:
            log(f"assembly failed for {s['work_id']}/{s['section_id']}: {exc}")
    return done


def write_review(st: State) -> int:
    rows = st.flagged()
    tmp = REVIEW.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        f.write("work\tsection\tchunk\tattempts\tbest_wer\tproblems\ttake\ttext\theard\n")
        for r in rows:
            f.write("\t".join(str(x).replace("\t", " ").replace("\n", " ") for x in (
                r["work_id"], r["section_id"], r["idx"], r["attempts"], r["best_wer"], r["best_problems"],
                r["best_path"], r["ref_text"], r["best_asr"])) + "\n")
    os.replace(tmp, REVIEW)
    return len(rows)


# ====================================================================== GPU batch (child process)

class Engine:
    """Qwen3-TTS CustomVoice + Whisper large-v3, loaded once per batch."""

    def __init__(self):
        os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                          DO_NOT_TRACK="1", TOKENIZERS_PARALLELISM="false")
        import importlib.util
        spec = importlib.util.spec_from_file_location("parish_voice_generate", VOICE_DIR / "generate.py")
        gen = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gen)
        import numpy as np
        import torch
        from qwen_tts import Qwen3TTSModel
        from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU is required for this voice model")
        self.np, self.torch = np, torch
        # Same pinned-snapshot check and loading call as parish-media's voice/generate.py.
        self.model_info, snapshot = gen.model_record("custom", gen.MODELS["custom"])
        t0 = time.monotonic()
        self.tts = Qwen3TTSModel.from_pretrained(str(snapshot), device_map="cuda:0", dtype=torch.bfloat16,
                                                 attn_implementation="sdpa")
        asr_model = AutoModelForSpeechSeq2Seq.from_pretrained(str(WHISPER), dtype=torch.float16,
                                                              low_cpu_mem_usage=True, use_safetensors=True).to("cuda:0")
        proc = AutoProcessor.from_pretrained(str(WHISPER))
        self.asr = pipeline("automatic-speech-recognition", model=asr_model, tokenizer=proc.tokenizer,
                            feature_extractor=proc.feature_extractor, dtype=torch.float16, device="cuda:0")
        self.load_seconds = time.monotonic() - t0

    def speak(self, text: str, speaker: str, seed: int, words: int, temperature: float):
        np, torch = self.np, self.torch
        random.seed(seed)
        np.random.seed(seed % (2**32))
        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        expected = words / 2.3
        max_tokens = int((expected * 2.5 + 3) * 12)          # 12 codec frames per second
        t0 = time.monotonic()
        wavs, sr = self.tts.generate_custom_voice(text=text, language=LANGUAGE, speaker=speaker,
                                                  instruct=INSTRUCT, max_new_tokens=max_tokens,
                                                  temperature=temperature, subtalker_temperature=temperature)
        torch.cuda.synchronize()
        audio = np.asarray(wavs[0], dtype=np.float32).reshape(-1)
        del wavs
        torch.cuda.empty_cache()
        if not len(audio) or not np.isfinite(audio).all():
            raise RuntimeError("model returned empty or non-finite audio")
        return audio, sr, time.monotonic() - t0

    def transcribe(self, audio, sr: int):
        import librosa
        t0 = time.monotonic()
        a16 = librosa.resample(audio, orig_sr=sr, target_sr=16000) if sr != 16000 else audio
        # The GPU holds the voice model too (11.6 GiB in all on Parish1): free its cache first and decode
        # greedily, as Whisper's beam search ran the card out of memory on the first real batch.
        self.torch.cuda.empty_cache()
        out = self.asr({"raw": a16, "sampling_rate": 16000}, return_timestamps="word", chunk_length_s=30,
                       generate_kwargs={"language": "english", "task": "transcribe", "num_beams": 1})
        words = []
        for ch in out.get("chunks", []):
            s, e = ch.get("timestamp") or (None, None)
            w = ch.get("text", "").strip()
            if w:
                words.append({"word": w, "start": float(s or 0.0), "end": float(e if e is not None else (s or 0.0))})
        return out.get("text", "").strip(), words, time.monotonic() - t0


def render_take(eng: Engine, text: str, ref_text: str, words: int, speaker: str, seed: int, attempt: int,
                lexicon, path: Path | None) -> dict:
    import soundfile as sf
    import hear
    import takecheck
    temperature = 0.9 if attempt <= 2 else 0.7
    raw, sr, gen_s = eng.speak(text, speaker, seed, words, temperature)
    info = takecheck.analyze(raw, sr, words)
    audio = takecheck.finish(raw, sr, info) if "empty" not in info["problems"] else raw
    asr_text, asr_words, asr_s = eng.transcribe(audio, sr)
    sc = hear.score(ref_text, [w["word"] for w in asr_words] or asr_text.split(), lexicon)
    problems = list(info["problems"])
    if sc["wer"] > WER_MAX:
        problems.append("wer")
    if sc["repeats"]:
        problems.append("repeat")          # stutter or doubled word, rejected even under WER_MAX
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp.flac")
        sf.write(str(tmp), audio, sr, format="FLAC", subtype="PCM_16")
        os.replace(tmp, path)
    return {"attempt": attempt, "seed": seed, "speaker": speaker, "path": str(path) if path else None,
            "duration": round(len(audio) / sr, 3), "speech_seconds": info["speech_seconds"], "wps": info["wps"],
            "max_gap": info["max_gap"], "wer": sc["wer"], "asr_text": asr_text, "asr_words": asr_words,
            "problems": problems, "gen_seconds": round(gen_s, 3), "asr_seconds": round(asr_s, 3),
            "sample_rate": sr, "audio": audio}


AUDITION_NAMES = ("Melchizedek, Habakkuk, and Nebuchadnezzar appear in the Scriptures; Ignatius of Antioch, "
                  "John Chrysostom, and Gregory of Nazianzus are among the fathers of the Church.")


def audition(eng: Engine, st: State, lexicon, stop) -> dict | None:
    """Pick the narrator once: Ryan and Aiden read the same passages with two seeds each; the
    lower mean WER wins, Ryan unless Aiden is better by at least one point. Samples are kept."""
    import soundfile as sf
    texts = []
    for wid, sid, n in (("bsb-psalms", "23", 1), ("bsb-genesis", "1", 1)):
        rows = [c for c in st.section_chunks(wid, sid) if c["idx"] == n]
        if rows:
            texts.append((f"{wid}-{sid}", rows[0]["text"], rows[0]["ref_text"]))
    texts.append(("names", AUDITION_NAMES, AUDITION_NAMES))
    adir = DATA / "audition"
    adir.mkdir(parents=True, exist_ok=True)
    report = {"instruct": INSTRUCT, "takes": []}
    for speaker in SPEAKERS:
        for label, text, ref in texts:
            for seed in (SEED_BASE, SEED_BASE + 1):
                reason = stop()
                if reason:
                    log(f"audition interrupted: {reason}", "batch")
                    return None
                t = render_take(eng, text, ref, len(ref.split()), speaker, seed, 1, lexicon, None)
                wav = adir / f"{speaker.lower()}-{label}-s{seed}.wav"
                sf.write(str(wav), t["audio"], t["sample_rate"], subtype="PCM_16")
                report["takes"].append({k: t[k] for k in ("speaker", "seed", "wer", "wps", "max_gap", "problems",
                                                          "asr_text", "gen_seconds", "duration")} | {"label": label, "wav": str(wav)})
                log(f"audition {speaker} {label} seed {seed}: WER {t['wer']:.3f} wps {t['wps']} "
                    f"problems {t['problems']} gen {t['gen_seconds']}s for {t['duration']}s", "batch")
    mean = {s: sum(t["wer"] for t in report["takes"] if t["speaker"] == s) /
            max(1, sum(1 for t in report["takes"] if t["speaker"] == s)) for s in SPEAKERS}
    pick = "Aiden" if mean["Aiden"] + 0.01 <= mean["Ryan"] else "Ryan"
    report.update(mean_wer=mean, pick=pick, decided=time.strftime("%Y-%m-%dT%H:%M:%S%z"))
    (adir / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    voice = {"speaker": pick, "instruct": INSTRUCT, "language": LANGUAGE, "model": eng.model_info["repo_id"],
             "revision": eng.model_info["revision"], "mean_wer": mean, "decided": report["decided"]}
    st.set("voice", voice)
    log(f"narrator chosen: {pick} (mean WER {mean}); samples in {adir}", "batch")
    return voice


def take_path(c, attempt: int, speaker: str) -> Path:
    return TAKES / c["work_id"] / c["section_id"] / f"{c['idx']:04d}-{c['sha'][:8]}-{speaker.lower()}-a{attempt}.flac"


def render_chunk(eng: Engine, st: State, c, voice: dict, lexicon, stop) -> str:
    """Render one chunk until accepted or out of attempts. Returns 'done', 'flagged' or 'stopped'."""
    attempt = c["attempts"] + 1
    while attempt <= MAX_ATTEMPTS:
        seed = SEED_BASE + int(hashlib.sha256(f"{c['work_id']}/{c['section_id']}/{c['idx']}".encode())
                               .hexdigest()[:6], 16) + attempt * 7919
        t = render_take(eng, c["text"], c["ref_text"], c["words"], voice["speaker"], seed, attempt, lexicon,
                        take_path(c, attempt, voice["speaker"]))
        accepted = not t["problems"]
        final = "done" if accepted else ("flagged" if attempt == MAX_ATTEMPTS else None)
        st.record_take(c, t, final)
        if st.speaker() != voice["speaker"]:
            return "stopped"              # the narrator changed mid-chunk; record_take sent it back to pending
        rtf = t["gen_seconds"] / max(t["duration"], 1e-3)
        log(f"{c['work_id']}/{c['section_id']}#{c['idx']} a{attempt}: WER {t['wer']:.3f} wps {t['wps']} "
            f"{'ok' if accepted else 'rejected ' + ','.join(t['problems'])} ({t['duration']:.1f}s audio, RTF {rtf:.2f})",
            "batch")
        if final == "done":
            for old in st.takes_for(c):
                if old["path"] and old["path"] != t["path"]:
                    Path(old["path"]).unlink(missing_ok=True)
            return "done"
        if final == "flagged":
            write_review(st)
            return "flagged"
        c = st.db.execute("SELECT * FROM chunks WHERE work_id=? AND section_id=? AND idx=?",
                          (c["work_id"], c["section_id"], c["idx"])).fetchone()
        attempt += 1
        if stop():
            return "stopped"
    return "flagged"


def batch(args, engine_factory=None, guard=None, st=None) -> int:
    """One GPU batch. engine_factory, guard and st are injectable for tests."""
    if guard is None:
        from guard import Guard
        guard = Guard()
    st = st or State(DB)
    mine = {os.getpid()}
    base = guard.baseline(mine)
    batch_id = st.batch_start()
    started = time.monotonic()
    budget = args.minutes * 60
    stop_reason = {"why": None}

    def stop():
        r = guard.stop_reason(base, mine)
        if r:
            stop_reason["why"] = "guard: " + r
        return r

    if stop():
        log(f"not starting: {stop_reason['why']}", "batch")
        st.batch_update(batch_id, ended=time.time(), end_reason=stop_reason["why"])
        return 3
    eng = (engine_factory or Engine)()
    log(f"models loaded in {eng.load_seconds:.1f}s", "batch")
    st.batch_update(batch_id, load_seconds=eng.load_seconds)
    lexicon = prep.Lexicon.load()
    voice = st.get("voice")
    if not voice:
        voice = audition(eng, st, lexicon, stop)
        if not voice:
            st.batch_update(batch_id, ended=time.time(), end_reason=stop_reason["why"])
            return 3
    only = [tuple(o.split("/", 1)) for o in (args.only or [])]
    chunks_done = takes = 0
    audio_s = gpu_s = 0.0
    end = "time budget reached"
    while True:
        if time.monotonic() - started > budget:
            break
        if stop():
            end = stop_reason["why"]
            break
        if st.speaker() != voice["speaker"]:
            end = "narrator changed"      # set-voice ran during this batch; the next batch loads the new one
            break
        rows = st.next_pending(1, only or None)
        if not rows:
            end = "queue empty" if not only else "requested sections finished"
            break
        c = rows[0]
        before = len(st.takes_for(c, any_speaker=True))
        result = render_chunk(eng, st, c, voice, lexicon, stop)
        new = st.takes_for(c, any_speaker=True)[before:]
        takes += len(new)
        audio_s += sum(t["duration"] or 0 for t in new)
        gpu_s += sum((t["gen_seconds"] or 0) + (t["asr_seconds"] or 0) for t in new)
        if result in ("done", "flagged"):
            chunks_done += 1
        st.batch_update(batch_id, chunks_done=chunks_done, takes=takes, audio_seconds=audio_s, gpu_seconds=gpu_s)
        if result == "stopped":
            end = stop_reason["why"] or ("narrator changed" if st.speaker() != voice["speaker"] else "stopped")
            break
    st.batch_update(batch_id, ended=time.time(), end_reason=end)
    log(f"batch ended ({end}): {chunks_done} chunks, {takes} takes, {audio_s/60:.1f} min audio in "
        f"{(time.monotonic()-started)/60:.1f} min", "batch")
    return 3 if end.startswith("guard") else 0


# ====================================================================== supervisor

class Supervisor:
    def __init__(self, once: bool = False, only: list[str] | None = None):
        from guard import Guard
        self.st = State(DB)
        self.guard = Guard()
        self.once, self.only = once, only
        self.child: subprocess.Popen | None = None
        self.stopping = False
        self.last_wait = (None, 0.0)

    def mark(self, state: str, why: str) -> None:
        cur = self.st.get("supervisor") or {}
        if cur.get("state") != state or cur.get("why") != why:
            self.st.set("supervisor", {"state": state, "why": why, "since": time.strftime("%Y-%m-%dT%H:%M:%S%z")})

    def say_waiting(self, why: str) -> None:
        prev, at = self.last_wait
        key = why.split(":")[0]           # GPU numbers in the reason change every check
        if key != prev or time.time() - at > 3600:
            log(f"waiting: {why}")
            self.last_wait = (key, time.time())
        self.mark("waiting", re.sub(r" \(\d+ chunks pending\)$", "", why))

    def sleep(self, seconds: float) -> None:
        end = time.time() + seconds
        while not self.stopping and time.time() < end:
            time.sleep(min(5, end - time.time()))

    def on_signal(self, signum, frame):
        self.stopping = True
        if self.child and self.child.poll() is None:
            self.child.terminate()

    def free_gb(self) -> float:
        import shutil
        return shutil.disk_usage(DATA).free / 2**30

    def run_child(self) -> int:
        cmd = [sys.executable, str(Path(__file__).resolve()), "batch", "--minutes", str(BATCH_MINUTES)]
        for o in self.only or []:
            cmd += ["--only", o]
        fd = self.guard.lock_fd()
        # The child inherits the parish-media lock descriptor, so the lock stays held while it
        # runs even if this supervisor dies; it is released when both have exited.
        self.child = subprocess.Popen(cmd, pass_fds=(fd,) if fd is not None else ())
        hard_limit = time.monotonic() + BATCH_MINUTES * 60 + 900
        while self.child.poll() is None:
            if time.monotonic() > hard_limit:
                log("batch exceeded its hard limit; stopping our own batch process")
                self.child.terminate()
                try:
                    self.child.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    self.child.kill()
            time.sleep(2)
        rc = self.child.returncode
        self.child = None
        return rc

    def loop(self) -> int:
        signal.signal(signal.SIGTERM, self.on_signal)
        signal.signal(signal.SIGINT, self.on_signal)
        DATA.mkdir(parents=True, exist_ok=True)
        linger = subprocess.run(["loginctl", "show-user", os.environ.get("USER", ""), "-p", "Linger"],
                                capture_output=True, text=True).stdout.strip()
        log(f"start: data {DATA}, library {LIBRARY}, batch {BATCH_MINUTES:.0f} min, WER max {WER_MAX}, {linger}")
        while not self.stopping:
            try:
                sync_queue(self.st)
                assemble_ready(self.st)
                pending = self.st.pending_count()
                if pending == 0 and not self.only:
                    self.say_waiting("queue empty; checking the library again in 30 minutes")
                    if self.once:
                        return 0
                    self.sleep(1800)
                    continue
                if self.free_gb() < MIN_FREE_GB:
                    self.say_waiting(f"less than {MIN_FREE_GB} GB free on {DATA}")
                    if self.once:
                        return 2
                    self.sleep(1800)
                    continue
                why = self.guard.not_ready()
                if not why and not self.guard.acquire():
                    why = "the parish-media GPU lock is held by another job"
                elif not why:
                    why = self.guard.not_ready()           # re-check under the lock
                    if why:
                        self.guard.release()
                if why:
                    self.say_waiting(f"{why} ({pending} chunks pending)")
                    if self.once:
                        return 2
                    self.sleep(random.uniform(WAIT_MIN_S, WAIT_MAX_S))
                    continue
                self.last_wait = (None, 0.0)
                log(f"GPU ready; starting a batch ({pending} chunks pending)")
                self.mark("rendering", f"batch started with {pending} chunks pending")
                try:
                    rc = self.run_child()
                finally:
                    self.guard.release()
                log(f"batch exited {rc}; GPU lock released")
                assemble_ready(self.st)
                if self.once:
                    return rc
                self.sleep(random.uniform(WAIT_MIN_S, WAIT_MAX_S))
            except Exception:
                log("loop error:\n" + traceback.format_exc())
                if self.once:
                    return 1
                self.sleep(300)
        log("stopping")
        self.mark("stopped", "service stopped")
        return 0


# ====================================================================== CLI

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run")
    o = sub.add_parser("once")
    o.add_argument("--only", action="append", help="work/section, e.g. bsb-psalms/23")
    b = sub.add_parser("batch")
    b.add_argument("--minutes", type=float, default=BATCH_MINUTES)
    b.add_argument("--only", action="append")
    sub.add_parser("sync")
    sub.add_parser("assemble")
    v = sub.add_parser("set-voice")
    v.add_argument("speaker", choices=SPEAKERS)
    v.add_argument("--yes", action="store_true")
    args = ap.parse_args(argv)
    if args.cmd == "run":
        return Supervisor().loop()
    if args.cmd == "once":
        return Supervisor(once=True, only=args.only).loop()
    if args.cmd == "batch":
        return batch(args)
    st = State(DB)
    if args.cmd == "sync":
        print(json.dumps(sync_queue(st, quiet=True)))
        return 0
    if args.cmd == "assemble":
        print(assemble_ready(st), "sections assembled")
        return 0
    if args.cmd == "set-voice":
        if not args.yes:
            print("Changing the narrator re-renders every chunk so the library keeps one voice. Add --yes.")
            return 1
        voice = st.get("voice") or {}
        voice.update(speaker=args.speaker, decided=time.strftime("%Y-%m-%dT%H:%M:%S%z") + " (manual)")
        st.set("voice", voice)
        st.db.execute("UPDATE chunks SET status='pending', attempts=0, best_take=NULL")
        st.db.execute("UPDATE sections SET status='pending'")
        print("voice set to", args.speaker)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
