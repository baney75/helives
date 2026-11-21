"""GPU readiness and the parish-media job lock, reused from parish-media itself.

Start rule: parish_media.not_ready() returns None (AC power, model volume mounted, no foreign
compute process, GPU memory <= 1500 MiB and utilization <= 15%), and the parish-media GPU lock
(~/.local/state/parish-media/gpu.lock, flock LOCK_EX|LOCK_NB) is free. The lock is taken first
and readiness checked again under it, the same order parish-media's own worker uses.

During a batch our own process holds GPU memory, so not_ready() would always refuse; the batch
instead stops when any of these is true (checked before every chunk and every few seconds):
  - not_ready(gpu_check=False) fails (AC power gone, model volume missing);
  - a compute process other than ours (and parish-media's RESIDENT daemons) appears;
  - a graphics process holding >= 256 MiB appears that was not there at batch start (a game);
  - GPU memory used by others grows more than 1024 MiB over the batch-start baseline.
"""
from __future__ import annotations

import fcntl
import importlib.util
import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

PM_DIR = Path(os.environ.get("PARISH_MEDIA_DIR", str(Path.home() / ".local/share/parish-media")))
NEW_GRAPHICS_MIB = 256
OTHERS_GROWTH_MIB = 1024


def load_parish_media():
    spec = importlib.util.spec_from_file_location("parish_media", PM_DIR / "parish_media.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def gpu_processes() -> dict[int, dict]:
    """pid -> {type, mib, name} from nvidia-smi's XML (lists graphics and compute processes)."""
    try:
        xml = subprocess.run(["nvidia-smi", "-q", "-x"], capture_output=True, text=True, timeout=15).stdout
    except (OSError, subprocess.TimeoutExpired):
        return {}
    out = {}
    for block in re.findall(r"<process_info>(.*?)</process_info>", xml, re.S):
        pid = re.search(r"<pid>(\d+)</pid>", block)
        typ = re.search(r"<type>([^<]*)</type>", block)
        mem = re.search(r"<used_memory>(\d+) MiB</used_memory>", block)
        name = re.search(r"<process_name>([^<]*)</process_name>", block)
        if pid:
            out[int(pid.group(1))] = {"type": typ.group(1) if typ else "?", "mib": int(mem.group(1)) if mem else 0,
                                      "name": name.group(1) if name else "?"}
    return out


@dataclass
class Baseline:
    procs: dict[int, dict] = field(default_factory=dict)
    others_mib: int = 0


class Guard:
    def __init__(self, pm=None, procs=gpu_processes, lock_dir: Path | None = None):
        self.pm = pm or load_parish_media()
        self.procs = procs
        self.lock_path = (lock_dir or self.pm.STATE) / "gpu.lock"
        self._lock = None

    # ------------------------------------------------------------ start rule
    def not_ready(self) -> str | None:
        return self.pm.not_ready()

    def acquire(self) -> bool:
        """Take the parish-media GPU lock without waiting. False when another job holds it."""
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        fh = self.lock_path.open("w")
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            fh.close()
            return False
        self._lock = fh
        return True

    def release(self) -> None:
        if self._lock is not None:
            fcntl.flock(self._lock, fcntl.LOCK_UN)
            self._lock.close()
            self._lock = None

    @property
    def locked(self) -> bool:
        return self._lock is not None

    def lock_fd(self) -> int | None:
        return self._lock.fileno() if self._lock else None

    # ------------------------------------------------------------ batch rule
    def baseline(self, mine: set[int]) -> Baseline:
        procs = self.procs()
        used = self.pm.gpu()["used_mib"]
        mine_mib = sum(p["mib"] for pid, p in procs.items() if pid in mine)
        return Baseline(procs, used - mine_mib)

    def stop_reason(self, base: Baseline, mine: set[int]) -> str | None:
        reason = self.pm.not_ready(gpu_check=False)
        if reason:
            return reason
        foreign = []
        for entry in self.pm.foreign_compute():
            m = re.match(r"(\d+)", entry)
            if m and int(m.group(1)) not in mine:
                foreign.append(entry)
        if foreign:
            return f"another GPU compute process appeared: {foreign}"
        procs = self.procs()
        for pid, p in procs.items():
            if pid in mine or pid in base.procs:
                continue
            if p["mib"] >= NEW_GRAPHICS_MIB:
                return f"a new GPU process appeared (game or GPU app): {pid} {p['name']} {p['mib']} MiB"
        used = self.pm.gpu()["used_mib"]
        mine_mib = sum(p["mib"] for pid, p in procs.items() if pid in mine)
        others = used - mine_mib
        if others > base.others_mib + OTHERS_GROWTH_MIB:
            return f"GPU memory used by others grew from {base.others_mib} to {others} MiB"
        return None
