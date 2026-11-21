"""Stage 2 of the encyclicals catalog: GET every vatican.va URL once (polite, cached) and record status.

Usage: python3 -I pipeline/extra/encyclicals_check.py
Writes pipeline/cache/extra/vat/docs/<sha1>.html and pipeline/cache/extra/vat/status.json {url: status}.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch import CACHE, UA  # noqa: E402

VAT = CACHE / "vat"
DOCS = VAT / "docs"


def main() -> int:
    DOCS.mkdir(parents=True, exist_ok=True)
    entries = json.loads((VAT / "entries.json").read_text(encoding="utf-8"))
    sf = VAT / "status.json"
    status = json.loads(sf.read_text()) if sf.exists() else {}
    for e in entries:
        url = e["url"]
        if status.get(url) == 200 and (DOCS / (hashlib.sha1(url.encode()).hexdigest() + ".html")).exists():
            continue
        code = 0
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=90) as r:
                    code = r.status
                    (DOCS / (hashlib.sha1(url.encode()).hexdigest() + ".html")).write_bytes(r.read())
                break
            except urllib.error.HTTPError as err:
                code = err.code
                if code == 404:
                    break
            except Exception as err:  # noqa: BLE001
                code = -1
                print("error", url, err, flush=True)
            time.sleep(5)
        status[url] = code
        sf.write_text(json.dumps(status, indent=1))
        print(code, url, flush=True)
        time.sleep(1.0)
    bad = {u: c for u, c in status.items() if c != 200}
    print(f"checked {len(status)}; not 200: {len(bad)}")
    for u, c in bad.items():
        print("  ", c, u)
    return 0


if __name__ == "__main__":
    sys.exit(main())
