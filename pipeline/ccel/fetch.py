"""Download CCEL ThML volumes into pipeline/cache/ccel/, sequentially, never re-downloading.

Usage: python3 -I pipeline/ccel/fetch.py [names...]   (default: all 38 Schaff volumes + summa)
Writes pipeline/cache/ccel/<name>.xml and <name>.meta (url, retrieved date).
"""
from __future__ import annotations

import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE = ROOT / "pipeline" / "cache" / "ccel"
UA = "helives-library/1.0 (public-domain library ingest; sequential, cached)"

VOLUMES = (
    [f"anf{i:02d}" for i in range(1, 11)]
    + [f"npnf1{i:02d}" for i in range(1, 15)]
    + [f"npnf2{i:02d}" for i in range(1, 15)]
    + ["summa"]
)


def url_for(name: str) -> str:
    if name == "summa":
        return "https://www.ccel.org/ccel/aquinas/summa.xml"
    return f"https://www.ccel.org/ccel/schaff/{name}.xml"


def fetch(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"{name}.xml"
    if out.exists() and out.stat().st_size > 0:
        return out
    url = url_for(name)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    tmp = out.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(out)
    (CACHE / f"{name}.meta").write_text(f"url={url}\nretrieved={date.today().isoformat()}\n")
    print(f"fetched {name} {len(data)} bytes", flush=True)
    time.sleep(3)
    return out


def main(argv: list[str]) -> int:
    for n in argv or VOLUMES:
        try:
            fetch(n)
        except Exception as e:  # noqa: BLE001
            print(f"FAILED {n}: {e}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
