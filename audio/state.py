"""Renderer work state in SQLite: one row per chunk, one row per take, per-section assembly.

Standard library only. Every take is written to disk first, then recorded in one transaction,
so a crash, reboot or power loss resumes at the exact chunk and attempt.
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS works (
  work_id TEXT PRIMARY KEY, path TEXT NOT NULL, prio INTEGER NOT NULL, title TEXT,
  file_sha TEXT NOT NULL, prepped_at REAL);
CREATE TABLE IF NOT EXISTS sections (
  work_id TEXT NOT NULL, section_id TEXT NOT NULL, ord INTEGER NOT NULL, prio INTEGER NOT NULL,
  title TEXT, spoken_title TEXT, words INTEGER NOT NULL, plan_sha TEXT NOT NULL,
  skipped TEXT,                                   -- reason, when the section is not read
  status TEXT NOT NULL DEFAULT 'pending',         -- pending | assembled
  out_path TEXT, duration REAL, assembled_at REAL, assembled_sha TEXT,
  PRIMARY KEY (work_id, section_id));
CREATE TABLE IF NOT EXISTS chunks (
  work_id TEXT NOT NULL, section_id TEXT NOT NULL, idx INTEGER NOT NULL,
  text TEXT NOT NULL, ref_text TEXT NOT NULL, kind TEXT NOT NULL, pause_before_ms INTEGER NOT NULL,
  anchors TEXT NOT NULL, flags TEXT NOT NULL, words INTEGER NOT NULL, sha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',         -- pending | done | flagged
  attempts INTEGER NOT NULL DEFAULT 0, best_take INTEGER, updated REAL,
  PRIMARY KEY (work_id, section_id, idx));
CREATE INDEX IF NOT EXISTS chunks_status ON chunks(status);
CREATE INDEX IF NOT EXISTS chunks_section_status ON chunks(work_id, section_id, status, idx);
CREATE INDEX IF NOT EXISTS sections_order ON sections(prio, ord);
CREATE TABLE IF NOT EXISTS takes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL, section_id TEXT NOT NULL, idx INTEGER NOT NULL, chunk_sha TEXT NOT NULL,
  attempt INTEGER NOT NULL, seed INTEGER NOT NULL, speaker TEXT NOT NULL, path TEXT,
  duration REAL, speech_seconds REAL, wer REAL, asr_text TEXT, asr_words TEXT,
  problems TEXT NOT NULL, accepted INTEGER NOT NULL, gen_seconds REAL, asr_seconds REAL,
  created REAL NOT NULL);
CREATE INDEX IF NOT EXISTS takes_chunk ON takes(work_id, section_id, idx);
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT, started REAL NOT NULL, ended REAL, end_reason TEXT,
  chunks_done INTEGER DEFAULT 0, takes INTEGER DEFAULT 0, audio_seconds REAL DEFAULT 0,
  gpu_seconds REAL DEFAULT 0, load_seconds REAL DEFAULT 0);
"""


class State:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), timeout=30, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.executescript(SCHEMA)

    def close(self) -> None:
        self.db.close()

    # -------------------------------------------------------------- meta
    def get(self, key: str, default=None):
        row = self.db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def set(self, key: str, value) -> None:
        self.db.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                        (key, json.dumps(value)))

    # -------------------------------------------------------------- queue sync
    def work_sha(self, work_id: str) -> str | None:
        row = self.db.execute("SELECT file_sha FROM works WHERE work_id=?", (work_id,)).fetchone()
        return row[0] if row else None

    def sync_work(self, work: dict, prio: int, file_sha: str, plans: list, skipped: dict[str, str]) -> dict:
        """Upsert a work's sections and chunks. A chunk whose text changed goes back to pending,
        and its section must be assembled again. Returns counts."""
        counts = {"new": 0, "changed": 0, "same": 0, "removed": 0}
        with self.tx():
            self.db.execute(
                "INSERT INTO works(work_id,path,prio,title,file_sha,prepped_at) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(work_id) DO UPDATE SET path=excluded.path, prio=excluded.prio, "
                "title=excluded.title, file_sha=excluded.file_sha, prepped_at=excluded.prepped_at",
                (work["id"], work["path"], prio, work.get("title"), file_sha, time.time()))
            keep = set()
            for ord_, plan in enumerate(plans):
                keep.add(plan.section_id)
                plan_sha = _plan_sha(plan)
                row = self.db.execute("SELECT plan_sha FROM sections WHERE work_id=? AND section_id=?",
                                      (plan.work_id, plan.section_id)).fetchone()
                skip = skipped.get(plan.section_id)
                if row is None:
                    self.db.execute(
                        "INSERT INTO sections(work_id,section_id,ord,prio,title,spoken_title,words,plan_sha,skipped) "
                        "VALUES(?,?,?,?,?,?,?,?,?)",
                        (plan.work_id, plan.section_id, ord_, prio, plan.title, plan.spoken_title,
                         plan.words, plan_sha, skip))
                else:
                    self.db.execute(
                        "UPDATE sections SET ord=?, prio=?, title=?, spoken_title=?, words=?, plan_sha=?, skipped=?, "
                        "status=CASE WHEN plan_sha=? THEN status ELSE 'pending' END "
                        "WHERE work_id=? AND section_id=?",
                        (ord_, prio, plan.title, plan.spoken_title, plan.words, plan_sha, skip, plan_sha,
                         plan.work_id, plan.section_id))
                existing = {r["idx"]: r["sha"] for r in self.db.execute(
                    "SELECT idx, sha FROM chunks WHERE work_id=? AND section_id=?", (plan.work_id, plan.section_id))}
                for c in plan.chunks:
                    args = (c.text, c.ref_text, c.kind, c.pause_before_ms, json.dumps(c.anchors),
                            json.dumps(c.flags), c.words, c.sha)
                    if c.idx not in existing:
                        self.db.execute(
                            "INSERT INTO chunks(work_id,section_id,idx,text,ref_text,kind,pause_before_ms,anchors,flags,words,sha) "
                            "VALUES(?,?,?,?,?,?,?,?,?,?,?)", (plan.work_id, plan.section_id, c.idx) + args)
                        counts["new"] += 1
                    elif existing[c.idx] != c.sha:
                        self.db.execute(
                            "UPDATE chunks SET text=?,ref_text=?,kind=?,pause_before_ms=?,anchors=?,flags=?,words=?,sha=?,"
                            "status='pending',attempts=0,best_take=NULL,updated=? WHERE work_id=? AND section_id=? AND idx=?",
                            args + (time.time(), plan.work_id, plan.section_id, c.idx))
                        counts["changed"] += 1
                    else:
                        # Pause and anchor changes do not need new audio.
                        self.db.execute(
                            "UPDATE chunks SET pause_before_ms=?, anchors=?, flags=? WHERE work_id=? AND section_id=? AND idx=?",
                            (c.pause_before_ms, json.dumps(c.anchors), json.dumps(c.flags),
                             plan.work_id, plan.section_id, c.idx))
                        counts["same"] += 1
                gone = self.db.execute("DELETE FROM chunks WHERE work_id=? AND section_id=? AND idx>=?",
                                       (plan.work_id, plan.section_id, len(plan.chunks))).rowcount
                counts["removed"] += gone
            for (sid,) in self.db.execute("SELECT section_id FROM sections WHERE work_id=?", (work["id"],)).fetchall():
                if sid not in keep:
                    self.db.execute("DELETE FROM sections WHERE work_id=? AND section_id=?", (work["id"], sid))
                    counts["removed"] += self.db.execute("DELETE FROM chunks WHERE work_id=? AND section_id=?",
                                                         (work["id"], sid)).rowcount
        return counts

    # -------------------------------------------------------------- render loop
    def next_pending(self, limit: int = 1, only: list[tuple[str, str]] | None = None) -> list[sqlite3.Row]:
        """Pending chunks in queue order; `only` restricts to (work_id, section_id) pairs."""
        where, args = "", []
        if only:
            where = " AND (" + " OR ".join("(c.work_id=? AND c.section_id=?)" for _ in only) + ")"
            args = [x for pair in only for x in pair]
        return self.db.execute(
            "SELECT c.* FROM chunks c JOIN sections s USING(work_id, section_id) "
            "WHERE c.status='pending' AND s.skipped IS NULL" + where +
            " ORDER BY s.prio, s.ord, c.idx LIMIT ?", (*args, limit)).fetchall()

    def pending_count(self) -> int:
        return self.db.execute(
            "SELECT count(*) FROM chunks c JOIN sections s USING(work_id, section_id) "
            "WHERE c.status='pending' AND s.skipped IS NULL").fetchone()[0]

    def record_take(self, chunk: sqlite3.Row, take: dict, final_status: str | None) -> int:
        """Store one take. final_status: 'done' (accepted), 'flagged' (out of attempts; best take
        kept), or None (rejected, will retry)."""
        with self.tx():
            cur = self.db.execute(
                "INSERT INTO takes(work_id,section_id,idx,chunk_sha,attempt,seed,speaker,path,duration,speech_seconds,"
                "wer,asr_text,asr_words,problems,accepted,gen_seconds,asr_seconds,created) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (chunk["work_id"], chunk["section_id"], chunk["idx"], chunk["sha"], take["attempt"], take["seed"],
                 take["speaker"], take.get("path"), take.get("duration"), take.get("speech_seconds"),
                 take.get("wer"), take.get("asr_text"), json.dumps(take.get("asr_words", [])),
                 json.dumps(take.get("problems", [])), int(final_status == "done"),
                 take.get("gen_seconds"), take.get("asr_seconds"), time.time()))
            take_id = cur.lastrowid
            if final_status == "done":
                best = take_id
            elif final_status == "flagged":
                best = self.best_take_id(chunk)
            else:
                best = None
            self.db.execute(
                "UPDATE chunks SET attempts=?, status=?, best_take=?, updated=? WHERE work_id=? AND section_id=? AND idx=?",
                (take["attempt"], final_status or "pending", best, time.time(),
                 chunk["work_id"], chunk["section_id"], chunk["idx"]))
        return take_id

    def takes_for(self, chunk) -> list[sqlite3.Row]:
        return self.db.execute(
            "SELECT * FROM takes WHERE work_id=? AND section_id=? AND idx=? AND chunk_sha=? ORDER BY attempt",
            (chunk["work_id"], chunk["section_id"], chunk["idx"], chunk["sha"])).fetchall()

    def best_take_id(self, chunk) -> int | None:
        """Fewest problems, then lowest WER, then the earliest attempt."""
        takes = [t for t in self.takes_for(chunk) if t["path"]]
        if not takes:
            return None
        takes.sort(key=lambda t: (len(json.loads(t["problems"])), t["wer"] if t["wer"] is not None else 9, t["attempt"]))
        return takes[0]["id"]

    def take(self, take_id: int) -> sqlite3.Row:
        return self.db.execute("SELECT * FROM takes WHERE id=?", (take_id,)).fetchone()

    # -------------------------------------------------------------- assembly
    def sections_ready(self) -> list[sqlite3.Row]:
        """Sections whose chunks are all done or flagged and that are not assembled at this plan."""
        return self.db.execute(
            "SELECT s.* FROM sections s JOIN (SELECT work_id, section_id, sum(status='pending') AS p "
            "FROM chunks GROUP BY work_id, section_id) c USING(work_id, section_id) "
            "WHERE c.p = 0 AND s.skipped IS NULL AND "
            "(s.status != 'assembled' OR s.assembled_sha IS NOT s.plan_sha) ORDER BY s.prio, s.ord").fetchall()

    def section_chunks(self, work_id: str, section_id: str) -> list[sqlite3.Row]:
        return self.db.execute("SELECT * FROM chunks WHERE work_id=? AND section_id=? ORDER BY idx",
                               (work_id, section_id)).fetchall()

    def mark_assembled(self, work_id: str, section_id: str, out_path: str, duration: float) -> None:
        self.db.execute(
            "UPDATE sections SET status='assembled', out_path=?, duration=?, assembled_at=?, assembled_sha=plan_sha "
            "WHERE work_id=? AND section_id=?", (out_path, duration, time.time(), work_id, section_id))

    # -------------------------------------------------------------- batches
    def batch_start(self) -> int:
        return self.db.execute("INSERT INTO batches(started) VALUES(?)", (time.time(),)).lastrowid

    def batch_update(self, batch_id: int, **fields) -> None:
        sets = ", ".join(f"{k}=?" for k in fields)
        self.db.execute(f"UPDATE batches SET {sets} WHERE id=?", tuple(fields.values()) + (batch_id,))

    def flagged(self) -> list[sqlite3.Row]:
        return self.db.execute(
            "SELECT c.*, t.wer AS best_wer, t.problems AS best_problems, t.path AS best_path, t.asr_text AS best_asr "
            "FROM chunks c LEFT JOIN takes t ON t.id=c.best_take WHERE c.status='flagged' "
            "ORDER BY c.work_id, c.section_id, c.idx").fetchall()

    # -------------------------------------------------------------- helpers
    def tx(self):
        db = self.db

        class _Tx:
            def __enter__(self_):
                db.execute("BEGIN IMMEDIATE")

            def __exit__(self_, et, ev, tb):
                db.execute("ROLLBACK" if et else "COMMIT")
                return False
        return _Tx()


def _plan_sha(plan) -> str:
    import hashlib
    h = hashlib.sha256()
    for c in plan.chunks:
        h.update(f"{c.sha}|{c.pause_before_ms}|{json.dumps(c.anchors)}\n".encode())
    return h.hexdigest()[:16]
