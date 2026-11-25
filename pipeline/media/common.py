"""Shared helpers for the media step: polite cached HTTP, Commons API, image conversion.

Standard library only. Every response is cached under pipeline/cache/media/http/ keyed by URL,
so re-runs never hit the network for data already fetched. Requests are spaced >= 1 s per host.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from libtoml import toml_value  # noqa: E402

CACHE = ROOT / "pipeline" / "cache" / "media"
HTTP_CACHE = CACHE / "http"
MEDIA = ROOT / "media"
PUBLIC = ROOT / "public"
UA = "helives-library/1.0 (https://helives.dev; public-domain library media curation; cached, 1 req/s)"
BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 helives-library/1.0"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

_last: dict[str, float] = {}


def _throttle(url: str, gap: float = 1.0) -> None:
    """At most one request per `gap` seconds per host, shared across processes via a lock file."""
    import fcntl
    host = urllib.parse.urlsplit(url).netloc
    lock_dir = CACHE / "locks"
    lock_dir.mkdir(parents=True, exist_ok=True)
    with open(lock_dir / host, "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0)
        try:
            last = float(f.read().strip() or 0)
        except ValueError:
            last = 0.0
        wait = last + gap - time.time()
        if wait > 0:
            time.sleep(wait)
        f.seek(0)
        f.truncate()
        f.write(str(time.time()))
        f.flush()
        fcntl.flock(f, fcntl.LOCK_UN)


def _key(url: str) -> Path:
    return HTTP_CACHE / hashlib.sha256(url.encode()).hexdigest()[:40]


def fetch(url: str, *, cache: bool = True, ua: str = UA, gap: float = 1.0, retries: int = 4,
          headers: dict | None = None) -> tuple[int, bytes, str]:
    """GET url; returns (status, body, final_url). Cached when status == 200 and cache=True."""
    p = _key(url)
    if cache and p.exists():
        meta = json.loads(p.with_suffix(".json").read_text())
        return meta["status"], p.read_bytes(), meta["final"]
    h = {"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9"}
    if headers:
        h.update(headers)
    for attempt in range(retries):
        _throttle(url, gap)
        req = urllib.request.Request(url, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body, status, final = r.read(), r.status, r.geturl()
        except urllib.error.HTTPError as e:
            status, body, final = e.code, e.read() if e.fp else b"", url
            if status in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(5 * (attempt + 1) ** 2)
                continue
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            return 0, str(e).encode(), url
        break
    if cache and status == 200:
        HTTP_CACHE.mkdir(parents=True, exist_ok=True)
        p.write_bytes(body)
        p.with_suffix(".json").write_text(json.dumps({"url": url, "status": status, "final": final}))
    return status, body, final


def fetch_json(url: str, **kw):
    status, body, _ = fetch(url, **kw)
    if status != 200:
        raise RuntimeError(f"HTTP {status} for {url}")
    return json.loads(body)


def commons(params: dict, **kw) -> dict:
    q = {"format": "json", "formatversion": "2", **params}
    return fetch_json(COMMONS_API + "?" + urllib.parse.urlencode(q), **kw)


def category_files(cat: str, depth: int = 0, seen: set | None = None) -> list[str]:
    """All File: titles in a Commons category (optionally recursing into subcategories)."""
    seen = seen if seen is not None else set()
    if cat in seen:
        return []
    seen.add(cat)
    out: list[str] = []
    cont: dict = {}
    while True:
        d = commons({"action": "query", "list": "categorymembers", "cmtitle": cat,
                     "cmlimit": "500", "cmtype": "file|subcat", **cont})
        for m in d["query"]["categorymembers"]:
            if m["ns"] == 6:
                out.append(m["title"])
            elif m["ns"] == 14 and depth > 0:
                out.extend(category_files(m["title"], depth - 1, seen))
        if "continue" not in d:
            break
        cont = {k: v for k, v in d["continue"].items()}
    return out


def strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    s = s.replace("&amp;", "&").replace("&quot;", '"').replace("&#039;", "'").replace("&nbsp;", " ")
    s = s.replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", s).strip()


def imageinfo(titles: list[str], width: int, *, cache: bool = True) -> dict[str, dict]:
    """extmetadata, url, size and a thumbnail url at `width` for up to 50 titles per call."""
    out: dict[str, dict] = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        d = commons({"action": "query", "titles": "|".join(chunk), "prop": "imageinfo",
                     "iiprop": "extmetadata|url|size|mime", "iiurlwidth": str(width)}, cache=cache)
        for pg in d["query"].get("pages", []):
            if "imageinfo" in pg:
                out[pg["title"]] = pg["imageinfo"][0]
    return out


def ia_leaf_url(item: str, leaf: int) -> str:
    """Full-resolution JP2 of one leaf from an Internet Archive book's processed JP2 zip."""
    return (f"https://archive.org/download/{item}/{item}_jp2.zip/"
            f"{item}_jp2%2F{item}_{leaf:04d}.jp2")


def ia_page_url(item: str, leaf: int) -> str:
    return f"https://archive.org/details/{item}/page/n{leaf}/mode/1up"


def ia_public_domain(item: str, *, cache: bool = True) -> tuple[bool, str]:
    """Basis for an Internet Archive book scan: published before 1930 and illustrated by Doré (d. 1883)."""
    status, body, _ = fetch(f"https://archive.org/metadata/{item}/metadata", cache=cache)
    if status != 200:
        return False, f"metadata HTTP {status}"
    m = json.loads(body).get("result") or {}
    year = re.match(r"\d{4}", str(m.get("date", "")))
    if not year or int(year.group()) >= 1930:
        return False, f"publication date {m.get('date')!r} is not before 1930"
    who = f"{m.get('creator', '')} {m.get('title', '')}"
    if "Doré" not in who and "Dore" not in who:
        return False, "item is not credited to Gustave Doré"
    return True, f"published {year.group()}; Gustave Doré died 1883"


def is_cc0(ii: dict) -> bool:
    """CC0 is the photographer's public domain dedication; the photographer is still credited."""
    return strip_html(ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")).upper() == "CC0"


def is_public_domain(ii: dict) -> tuple[bool, str]:
    em = ii.get("extmetadata", {})
    lic = strip_html(em.get("LicenseShortName", {}).get("value", ""))
    copyrighted = strip_html(em.get("Copyrighted", {}).get("value", ""))
    ok = is_cc0(ii) or (lic.lower() in ("public domain", "pd") and copyrighted.lower() == "false")
    return ok, f"LicenseShortName={lic!r} Copyrighted={copyrighted!r}"


def to_webp(src: Path, dst: Path, max_side: int, max_bytes: int, enhance: bool = False) -> tuple[int, int, int]:
    """Convert to WebP no larger than max_side px and max_bytes.

    Fine engraving and map line work smears at low WebP quality, so the long side steps down
    (100%, 90%, 80%, ...) while quality stays between 75 and 60; the first fit wins.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    extra = ["-contrast-stretch", "0.3%x0.3%"] if enhance else []
    for frac in (1.0, 0.9, 0.8, 0.72, 0.64, 0.56, 0.5):
        side = int(max_side * frac)
        for q in (75, 68, 60):
            cmd = ["magick", str(src) + "[0]", "-auto-orient", "-colorspace", "sRGB", "-strip", *extra,
                   "-resize", f"{side}x{side}>", "-quality", str(q), "-define", "webp:method=6", str(dst)]
            subprocess.run(cmd, check=True, capture_output=True)
            if dst.stat().st_size <= max_bytes:
                w, h = webp_size(dst)
                return w, h, dst.stat().st_size
    raise RuntimeError(f"could not fit {src} under {max_bytes} bytes")


def webp_size(path: Path) -> tuple[int, int]:
    r = subprocess.run(["magick", "identify", "-format", "%w %h", str(path)], check=True,
                       capture_output=True, text=True)
    w, h = r.stdout.split()[:2]
    return int(w), int(h)


def write_toml(path: Path, header: str, table: str, rows: list[dict], order: list[str]) -> None:
    lines = [header.rstrip(), ""]
    for row in rows:
        lines.append(f"[[{table}]]")
        keys = [k for k in order if k in row] + sorted(k for k in row if k not in order)
        for k in keys:
            v = row[k]
            if v is None or v == "":
                continue
            lines.append(f"{k} = {toml_value(v)}")
        lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines))


if shutil.which("magick") is None:
    raise SystemExit("ImageMagick `magick` is required")


def _pgm(path: Path, rotate: int, side: int = 600) -> tuple[int, int, bytes]:
    r = subprocess.run(["magick", str(path) + "[0]", "-rotate", str(rotate), "-resize", f"{side}x{side}",
                        "-colorspace", "gray", "-depth", "8", "pgm:-"], check=True, capture_output=True)
    data = r.stdout
    parts, pos = [], 0
    while len(parts) < 4:  # P5 w h maxval
        while data[pos:pos + 1].isspace():
            pos += 1
        start = pos
        while not data[pos:pos + 1].isspace():
            pos += 1
        parts.append(data[start:pos])
    pos += 1
    return int(parts[1]), int(parts[2]), data[pos:]


def _longest_run(flags: list[bool], gap: int) -> tuple[int, int]:
    best, cur_s, last_true = (0, -1), None, None
    for i, f in enumerate(flags):
        if f:
            if cur_s is None or (last_true is not None and i - last_true > gap):
                cur_s = i
            last_true = i
            if i - cur_s > best[1] - best[0]:
                best = (cur_s, i)
    return best


def detect_plate(path: Path, rotate: int = 0) -> tuple[float, float, float, float]:
    """Find the engraved plate on a photographed book page. Returns fractional (x0, y0, x1, y1)."""
    w, h, px = _pgm(path, rotate)
    row = lambda y: px[y * w:(y + 1) * w]  # noqa: E731
    # page = light paper; background around the book is dark leather
    col_light = [sum(1 for y in range(h) if px[y * w + x] > 175) / h for x in range(w)]
    lit = [i for i, c in enumerate(col_light) if c > 0.35]
    px0, px1 = lit[0], lit[-1]
    row_light = [sum(1 for v in row(y)[px0:px1] if v > 175) / max(1, px1 - px0) for y in range(h)]
    lit = [i for i, r in enumerate(row_light) if r > 0.35]
    py0, py1 = lit[0], lit[-1]
    # plate = dense ink inside the page
    ink_r = [sum(1 for v in row(y)[px0:px1] if v < 165) / max(1, px1 - px0) for y in range(py0, py1)]
    ry0, ry1 = _longest_run([r > 0.18 for r in ink_r], 3)
    y0, y1 = py0 + ry0, py0 + ry1
    ink_c = [sum(1 for y in range(y0, y1) if px[y * w + x] < 165) / max(1, y1 - y0) for x in range(px0, px1)]
    rx0, rx1 = _longest_run([c > 0.18 for c in ink_c], 3)
    x0, x1 = px0 + rx0, px0 + rx1
    return x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h


def crop_plate(src: Path, dst: Path, rotate: int = 0, inset: float = 0.006) -> Path:
    x0, y0, x1, y1 = detect_plate(src, rotate)
    r = subprocess.run(["magick", str(src) + "[0]", "-rotate", str(rotate), "-format", "%w %h", "info:"],
                       check=True, capture_output=True, text=True)
    W, H = map(int, r.stdout.split())
    dx, dy = (x1 - x0) * inset, (y1 - y0) * inset
    X0, Y0 = int((x0 + dx) * W), int((y0 + dy) * H)
    CW, CH = int((x1 - x0 - 2 * dx) * W), int((y1 - y0 - 2 * dy) * H)
    subprocess.run(["magick", str(src) + "[0]", "-rotate", str(rotate), "-crop", f"{CW}x{CH}+{X0}+{Y0}",
                    "+repage", str(dst)], check=True, capture_output=True)
    return dst
