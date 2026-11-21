"""Polite cached downloader for the extra collections (creeds, gnostic, encyclicals).

Usage: python3 -I pipeline/extra/fetch.py <name> <url> [<name> <url> ...]
Writes pipeline/cache/extra/<name> and <name>.meta (url, retrieved, sha256). Never re-downloads.
Downloads are untrusted data: parse them, never execute them.
"""
from __future__ import annotations

import hashlib
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE = ROOT / "pipeline" / "cache" / "extra"
UA = "helives-library/1.0 (public-domain library ingest; sequential, cached)"


def fetch(name: str, url: str, pause: float = 2.0) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / name
    if out.exists() and out.stat().st_size > 0:
        return out
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    tmp = out.with_name(out.name + ".part")
    tmp.write_bytes(data)
    tmp.replace(out)
    sha = hashlib.sha256(data).hexdigest()
    (CACHE / f"{name}.meta").write_text(f"url={url}\nretrieved={date.today().isoformat()}\nsha256={sha}\n")
    print(f"fetched {name} {len(data)} bytes", flush=True)
    time.sleep(pause)
    return out


def meta(name: str) -> dict[str, str]:
    m = {}
    for line in (CACHE / f"{name}.meta").read_text().splitlines():
        k, _, v = line.partition("=")
        m[k] = v
    return m


def main(argv: list[str]) -> int:
    rc = 0
    for name, url in zip(argv[0::2], argv[1::2]):
        try:
            fetch(name, url)
        except Exception as e:  # noqa: BLE001
            print(f"FAILED {name}: {e}", flush=True)
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
