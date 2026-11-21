#!/usr/bin/env python3
"""Audiobook progress from state.db: works done, hours rendered, WER, review list, GPU hours left.

    python3 audio/status.py [--db PATH] [--json]

Standard library only. Remaining GPU hours use the measured GPU seconds per word from finished
batches (TTS, retries and ASR, plus model loading); before any batch has run they use the
assumptions below and are labelled as an estimate.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import statistics
import sys
import time
from pathlib import Path

DEFAULT_DB = Path(os.environ.get("HELIVES_AUDIO_DATA", "/srv/magnus-data/media/helives-audio")) / "state.db"

# Used only until a real batch has been measured.
ASSUMED_WPS = 2.4            # spoken words per second of finished audio
ASSUMED_TTS_RTF = 1.0        # GPU seconds per audio second for Qwen3-TTS 1.7B, batch 1, no flash-attn
ASSUMED_ASR_RTF = 0.08       # Whisper large-v3 fp16
ASSUMED_RETRY = 1.15         # extra takes for rejected chunks


def collect(db_path: Path) -> dict:
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    q = lambda sql, *a: db.execute(sql, a).fetchall()  # noqa: E731
    one = lambda sql, *a: db.execute(sql, a).fetchone()[0]  # noqa: E731

    meta = {r["key"]: json.loads(r["value"]) for r in q("SELECT key, value FROM meta")}
    chunk = {r["status"]: (r["n"], r["w"] or 0) for r in q(
        "SELECT c.status, count(*) n, sum(c.words) w FROM chunks c JOIN sections s USING(work_id, section_id) "
        "WHERE s.skipped IS NULL GROUP BY c.status")}
    pending_n, pending_w = chunk.get("pending", (0, 0))
    done_n, done_w = chunk.get("done", (0, 0))
    flag_n, flag_w = chunk.get("flagged", (0, 0))

    works = q("SELECT w.work_id, w.prio, "
              "(SELECT count(*) FROM sections s WHERE s.work_id=w.work_id AND s.skipped IS NULL) total, "
              "(SELECT count(*) FROM sections s WHERE s.work_id=w.work_id AND s.skipped IS NULL "
              " AND s.status='assembled' AND s.assembled_sha=s.plan_sha) assembled "
              "FROM works w ORDER BY w.prio")
    works_done = [w["work_id"] for w in works if w["total"] and w["assembled"] == w["total"]]
    in_progress = [f"{w['work_id']} {w['assembled']}/{w['total']}" for w in works if 0 < w["assembled"] < w["total"]]

    wers = [r[0] for r in q("SELECT t.wer FROM chunks c JOIN takes t ON t.id=c.best_take WHERE c.status='done'")]
    first_try = one("SELECT count(*) FROM chunks WHERE status='done' AND attempts=1")
    rendered_s = one("SELECT coalesce(sum(t.duration),0) FROM chunks c JOIN takes t ON t.id=c.best_take "
                     "WHERE c.status IN ('done','flagged')")
    assembled_s = one("SELECT coalesce(sum(duration),0) FROM sections WHERE status='assembled'")
    b = db.execute("SELECT count(*) n, coalesce(sum(gpu_seconds),0) gpu, coalesce(sum(load_seconds),0) load, "
                   "coalesce(sum(audio_seconds),0) audio, coalesce(sum(coalesce(ended,started)-started),0) wall "
                   "FROM batches WHERE gpu_seconds > 0").fetchone()
    last = db.execute("SELECT * FROM batches ORDER BY id DESC LIMIT 1").fetchone()
    words_finished = done_w + flag_w
    if b["n"] and words_finished:
        gpu_per_word = (b["gpu"] + b["load"]) / words_finished
        basis = (f"measured over {b['n']} batch(es): {b['gpu'] / max(b['audio'], 1e-9):.2f} GPU s per take-audio s, "
                 f"{words_finished} words finished")
        measured = True
    else:
        gpu_per_word = (ASSUMED_TTS_RTF + ASSUMED_ASR_RTF) * ASSUMED_RETRY / ASSUMED_WPS
        basis = (f"ESTIMATE, no batch measured yet: TTS RTF {ASSUMED_TTS_RTF}, ASR RTF {ASSUMED_ASR_RTF}, "
                 f"x{ASSUMED_RETRY} retries, {ASSUMED_WPS} words/s")
        measured = False
    skipped = q("SELECT work_id, section_id, skipped FROM sections WHERE skipped IS NOT NULL")
    return {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "voice": meta.get("voice"),
        "supervisor": meta.get("supervisor"),
        "works": {"queued": len(works), "complete": len(works_done), "complete_ids": works_done,
                  "in_progress": in_progress},
        "sections": {"total": one("SELECT count(*) FROM sections WHERE skipped IS NULL"),
                     "assembled": one("SELECT count(*) FROM sections WHERE status='assembled' AND skipped IS NULL"),
                     "skipped": [f"{r['work_id']}/{r['section_id']}: {r['skipped']}" for r in skipped]},
        "chunks": {"pending": pending_n, "done": done_n, "flagged": flag_n,
                   "first_try_rate": round(first_try / done_n, 3) if done_n else None},
        "words": {"pending": pending_w, "finished": words_finished, "total": pending_w + words_finished},
        "hours": {"rendered": round(rendered_s / 3600, 2), "assembled": round(assembled_s / 3600, 2),
                  "remaining_audio_estimate": round(pending_w / ASSUMED_WPS / 3600, 1)},
        "wer": {"accepted_mean": round(statistics.mean(wers), 4) if wers else None,
                "accepted_median": round(statistics.median(wers), 4) if wers else None,
                "accepted_max": round(max(wers), 4) if wers else None,
                "accepted_takes": len(wers)},
        "review_list": flag_n,
        "gpu": {"remaining_hours": round(pending_w * gpu_per_word / 3600, 1), "measured": measured,
                "basis": basis, "batches": b["n"], "gpu_hours_used": round((b["gpu"] + b["load"]) / 3600, 2)},
        "last_batch": dict(last) if last else None,
    }


def text(s: dict) -> str:
    v = s["voice"] or {}
    sup = s["supervisor"] or {}
    lines = [
        f"He Lives audiobooks, {s['generated']}",
        f"  narrator     {v.get('speaker', 'not chosen yet (first batch runs the audition)')}",
        f"  supervisor   {sup.get('state', '?')}: {sup.get('why', '')} (since {sup.get('since', '?')})",
        f"  works        {s['works']['complete']} complete of {s['works']['queued']} queued"
        + (f"; in progress: {', '.join(s['works']['in_progress'][:5])}" if s['works']['in_progress'] else ""),
        f"  sections     {s['sections']['assembled']} assembled of {s['sections']['total']}"
        f" ({len(s['sections']['skipped'])} skipped as not English)",
        f"  chunks       {s['chunks']['done']} done, {s['chunks']['flagged']} flagged, {s['chunks']['pending']} pending"
        + (f"; first-try pass {s['chunks']['first_try_rate']:.0%}" if s['chunks']['first_try_rate'] is not None else ""),
        f"  words        {s['words']['finished']:,} finished of {s['words']['total']:,}",
        f"  hours        {s['hours']['rendered']} rendered, {s['hours']['assembled']} assembled, "
        f"about {s['hours']['remaining_audio_estimate']} audio hours to go",
        f"  WER          mean {s['wer']['accepted_mean']}, median {s['wer']['accepted_median']}, "
        f"max {s['wer']['accepted_max']} over {s['wer']['accepted_takes']} accepted takes",
        f"  review list  {s['review_list']} chunk(s) in review.tsv",
        f"  GPU          {s['gpu']['remaining_hours']} GPU hours remaining ({s['gpu']['basis']}); "
        f"{s['gpu']['gpu_hours_used']} used",
    ]
    if s["last_batch"]:
        lb = s["last_batch"]
        lines.append(f"  last batch   #{lb['id']} {time.strftime('%Y-%m-%d %H:%M', time.localtime(lb['started']))}, "
                     f"{lb['chunks_done']} chunks, ended: {lb['end_reason']}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    if not args.db.exists():
        print(f"no state database at {args.db}", file=sys.stderr)
        return 1
    s = collect(args.db)
    print(json.dumps(s, indent=2, default=str) if args.json else text(s))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
