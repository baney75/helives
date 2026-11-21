"""Re-check every media catalog against the live sources and the files on disk.

  images.toml, maps.toml: the file exists under public/, its real dimensions match the
      catalog, it fits the size limits, every required field is filled, tags are well formed,
      and the Commons source file is still public domain (fresh API query, no cache).
  videos.toml: every video passes YouTube oEmbed and the catalog title and channel still
      match what oEmbed returns.
  articles.toml: every URL returns HTTP 200 on its own host and the page title still contains
      the `expect` text.

Prints a summary and exits 1 on any failure.
Run: python3 pipeline/media/verify.py [--offline]   (--offline skips the network checks)
"""
from __future__ import annotations

import re
import sys
import tomllib
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_articles import match_text  # noqa: E402
from common import MEDIA, PUBLIC, fetch, ia_public_domain, imageinfo, is_public_domain, webp_size  # noqa: E402
from yt import oembed  # noqa: E402

LIMITS = {"image": (1600, 350_000), "map": (2400, 900_000)}
ART_FIELDS = ["id", "title", "artist", "year", "file", "width", "height", "alt", "source_page",
              "license", "credit", "tags"]
MAP_FIELDS = ART_FIELDS + ["region", "period"]
VIDEO_FIELDS = ["id", "title", "channel", "url", "duration", "tags", "description"]
ARTICLE_FIELDS = ["title", "publisher", "author", "url", "expect", "tags", "description"]
TAG_RE = re.compile(r"^(bible:[a-z0-9-]+(:\d+)?|deuterocanon:[a-z0-9-]+(:\d+)?|work:[a-z0-9-]+|"
                    r"author:[a-z0-9-]+|topic:[a-z0-9-]+|collection:[a-z0-9-]+)$")


class Report:
    def __init__(self) -> None:
        self.fail: dict[str, list[str]] = defaultdict(list)
        self.count: dict[str, int] = {}

    def bad(self, cat: str, msg: str) -> None:
        self.fail[cat].append(msg)


def load(name: str, table: str) -> list[dict]:
    p = MEDIA / name
    if not p.exists():
        return []
    return tomllib.loads(p.read_text()).get(table, [])


def check_fields(rep: Report, cat: str, rows: list[dict], fields: list[str], key: str) -> None:
    seen = set()
    for r in rows:
        k = r.get(key, "?")
        if k in seen:
            rep.bad(cat, f"{k}: duplicate {key}")
        seen.add(k)
        for f in fields:
            if r.get(f) in (None, "", []):
                rep.bad(cat, f"{k}: missing {f}")
        for t in r.get("tags", []):
            if not TAG_RE.match(t):
                rep.bad(cat, f"{k}: malformed tag {t!r}")


def check_files(rep: Report, cat: str, rows: list[dict], kind: str) -> int:
    max_side, max_bytes = LIMITS[kind]
    total = 0
    for r in rows:
        f = r.get("file", "")
        path = PUBLIC / f.lstrip("/")
        if not f.startswith("/media/") or not path.exists():
            rep.bad(cat, f"{r.get('id')}: file missing {f}")
            continue
        size = path.stat().st_size
        total += size
        w, h = webp_size(path)
        if (w, h) != (r.get("width"), r.get("height")):
            rep.bad(cat, f"{r['id']}: catalog says {r.get('width')}x{r.get('height')}, file is {w}x{h}")
        if max(w, h) > max_side:
            rep.bad(cat, f"{r['id']}: long side {max(w, h)} > {max_side}")
        if size > max_bytes:
            rep.bad(cat, f"{r['id']}: {size} bytes > {max_bytes}")
        if r.get("license") != "Public domain":
            rep.bad(cat, f"{r['id']}: license is {r.get('license')!r}")
    return total


def commons_title(source_page: str) -> str:
    path = urlparse(source_page).path
    return unquote(path.split("/wiki/", 1)[-1]).replace("_", " ")


def check_commons(rep: Report, cat: str, rows: list[dict]) -> None:
    titles = {}
    for r in rows:
        sp = r.get("source_page", "")
        ia = re.match(r"https://archive\.org/details/([^/]+)/page/n\d+", sp)
        if ia:
            ok, why = ia_public_domain(ia.group(1), cache=False)
            if not ok:
                rep.bad(cat, f"{r.get('id')}: Internet Archive source not public domain ({why})")
            continue
        if "commons.wikimedia.org/wiki/File:" not in sp:
            rep.bad(cat, f"{r.get('id')}: source_page is not a Commons file page")
            continue
        titles[commons_title(sp)] = r["id"]
    infos = imageinfo(list(titles), 320, cache=False)
    for t, rid in titles.items():
        ii = infos.get(t)
        if ii is None:
            rep.bad(cat, f"{rid}: Commons file not found: {t}")
            continue
        ok, why = is_public_domain(ii)
        if not ok:
            rep.bad(cat, f"{rid}: no longer public domain on Commons ({why})")


def check_video(r: dict) -> str | None:
    m = re.search(r"[?&]v=([\w-]{11})", r.get("url", ""))
    if not m:
        return f"{r.get('id')}: bad url {r.get('url')}"
    status, meta = oembed(m.group(1), cache=False)
    if status != 200:
        return f"{r['id']}: oEmbed HTTP {status}"
    if meta.get("title") != r.get("title"):
        return f"{r['id']}: title now {meta.get('title')!r}"
    if meta.get("author_name", "").strip() != r.get("channel"):
        return f"{r['id']}: channel now {meta.get('author_name')!r}"
    return None


def check_article(r: dict) -> str | None:
    url = r.get("url", "")
    status, body, final = fetch(url, cache=False, gap=1.0)
    if status != 200:
        return f"{url}: HTTP {status}"
    if urlparse(final).netloc not in (urlparse(url).netloc, ""):
        return f"{url}: redirected to {final}"
    text = body.decode("utf-8", "replace")
    if "newadvent" in url and "�" in text:
        text = body.decode("latin-1")
    if r.get("expect", "").lower() not in match_text(url, text).lower():
        return f"{url}: title no longer contains {r.get('expect')!r}"
    return None


def run_by_host(fn, rows: list[dict]) -> list[str]:
    """Run checks one host at a time in order (each host keeps its 1 req/s limit), hosts in parallel."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        groups[urlparse(r.get("url", "")).netloc].append(r)

    def worker(items: list[dict]) -> list[str]:
        return [e for e in (fn(r) for r in items) if e]

    with ThreadPoolExecutor(max_workers=max(1, len(groups))) as ex:
        return [e for errs in ex.map(worker, groups.values()) for e in errs]


def human(n: int) -> str:
    return f"{n / 1_000_000:.1f} MB"


def main() -> int:
    offline = "--offline" in sys.argv
    rep = Report()
    images = load("images.toml", "image")
    maps = load("maps.toml", "map")
    videos = load("videos.toml", "video")
    articles = load("articles.toml", "article")
    rep.count = {"images": len(images), "maps": len(maps), "videos": len(videos), "articles": len(articles)}
    for cat, rows in rep.count.items():
        if rows == 0:
            rep.bad(cat, "catalog missing or empty")

    check_fields(rep, "images", images, ART_FIELDS, "id")
    check_fields(rep, "maps", maps, MAP_FIELDS, "id")
    check_fields(rep, "videos", videos, VIDEO_FIELDS, "id")
    check_fields(rep, "articles", articles, ARTICLE_FIELDS, "url")
    img_bytes = check_files(rep, "images", images, "image")
    map_bytes = check_files(rep, "maps", maps, "map")

    if not offline:
        with ThreadPoolExecutor(max_workers=3) as ex:
            f_commons = ex.submit(lambda: (check_commons(rep, "images", images), check_commons(rep, "maps", maps)))
            f_videos = ex.submit(run_by_host, check_video, videos)
            f_articles = ex.submit(run_by_host, check_article, articles)
            f_commons.result()
            for e in f_videos.result():
                rep.bad("videos", e)
            for e in f_articles.result():
                rep.bad("articles", e)

    all_media = sum(p.stat().st_size for p in (PUBLIC / "media").rglob("*") if p.is_file()) \
        if (PUBLIC / "media").exists() else 0
    print("He Lives media catalog check" + (" (offline: network checks skipped)" if offline else ""))
    print(f"  images.toml    {len(images):4} entries  {human(img_bytes)}  (limit {LIMITS['image'][0]} px, "
          f"{LIMITS['image'][1] // 1000} KB each)")
    print(f"  maps.toml      {len(maps):4} entries  {human(map_bytes)}  (limit {LIMITS['map'][0]} px, "
          f"{LIMITS['map'][1] // 1000} KB each)")
    print(f"  videos.toml    {len(videos):4} entries  (oEmbed {'skipped' if offline else 'checked'})")
    print(f"  articles.toml  {len(articles):4} entries  (HTTP 200 and title {'skipped' if offline else 'checked'})")
    print(f"  public/media total: {human(all_media)}")
    n_fail = sum(len(v) for v in rep.fail.values())
    for cat in ("images", "maps", "videos", "articles"):
        errs = rep.fail.get(cat, [])
        print(f"  {cat:9} failures: {len(errs)}")
        for e in errs[:40]:
            print(f"    - {e}")
        if len(errs) > 40:
            print(f"    ... and {len(errs) - 40} more")
    print("RESULT: " + ("PASS" if n_fail == 0 else f"FAIL ({n_fail} problems)"))
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
