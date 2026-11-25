"""Download, crop and convert catalog images to WebP; record results in a manifest.

Usage: python3 pipeline/media/build_images.py [images|maps] [--shard I/N]
       python3 pipeline/media/build_images.py merge [images|maps]
--shard runs every Nth spec (offset I) and records new results in built_<kind>.partI.json, so
several shards can run at once; `merge` folds the part files into built_<kind>.json.
Reads specs from dore.py + portraits.py (images) or maps.py (maps). Every source must be stated as
public domain by Commons extmetadata (LicenseShortName "Public domain", Copyrighted "False", or CC0);
anything else is rejected and logged. Output: public/media/<kind>/<id>.webp and
pipeline/cache/media/built_<kind>.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from common import (CACHE, PUBLIC, crop_plate, fetch, ia_leaf_url, ia_page_url, ia_public_domain, imageinfo,
                    is_cc0, is_public_domain, strip_html, to_webp)

BUCKETS = [960, 1280, 1920, 3840]
LIMITS = {"images": (1600, 350_000), "maps": (2400, 900_000)}


def pick_url(ii: dict, target_long: int, title: str) -> str:
    w, h = ii["width"], ii["height"]
    for b in BUCKETS:
        if b >= w:
            return ii["url"]
        if b * max(w, h) / w >= target_long:
            break
    else:
        return ii["url"]
    info = imageinfo([title], b)[title]
    return info.get("thumburl") or ii["url"]


def credit_for(spec: dict, ii: dict) -> str:
    if spec.get("ia"):
        return (f"{spec['artist']}, “{spec['title']}” ({spec['year']}). Public domain. Scan: Bibliothèque "
                f"nationale de France, La Sainte Bible (Tours: Mame, 1866), via the Internet Archive.")
    em = ii["extmetadata"]
    src = strip_html(em.get("Credit", {}).get("value", ""))
    inst = ""
    if "Polona" in src or "National Library of Poland" in src or "Polona" in spec["commons"] or "Pismo" in spec["commons"]:
        inst = "Scan: National Library of Poland (Polona). "
    elif "Metropolitan" in src:
        inst = "Scan: The Metropolitan Museum of Art. "
    if is_cc0(ii):
        who = strip_html(em.get("Artist", {}).get("value", ""))
        return f"“{spec['title']}” ({spec['year']}). Photograph by {who}, CC0, a public domain dedication. Via Wikimedia Commons."
    return f"{spec['artist']}, “{spec['title']}” ({spec['year']}). Public domain. {inst}Via Wikimedia Commons."


def build(kind: str, specs: list[dict], part: str = "") -> tuple[dict, list[str]]:
    max_side, max_bytes = LIMITS[kind]
    outdir = PUBLIC / "media" / kind
    srcdir = CACHE / "src"
    srcdir.mkdir(parents=True, exist_ok=True)
    manifest_p = CACHE / f"built_{kind}.json"
    manifest = json.loads(manifest_p.read_text()) if manifest_p.exists() else {}
    if part:
        manifest_p = CACHE / f"built_{kind}.{part}.json"
        if manifest_p.exists():
            manifest.update(json.loads(manifest_p.read_text()))
    infos = imageinfo([s["commons"] for s in specs if not s.get("ia")], 1920)
    rejected = []
    for n, s in enumerate(specs):
        if s.get("ia"):
            item, leaf = s["ia"]
            ok, why = ia_public_domain(item)
            if not ok:
                rejected.append(f"{s['id']}: {s['commons']} not public domain ({why})")
                continue
            ii = {"url": ia_leaf_url(item, leaf), "descriptionurl": ia_page_url(item, leaf)}
        else:
            ii = infos.get(s["commons"])
            if not ii:
                rejected.append(f"{s['id']}: {s['commons']} not found on Commons")
                continue
            ok, why = is_public_domain(ii)
            if not ok:
                rejected.append(f"{s['id']}: {s['commons']} license not stated public domain ({why})")
                continue
        dst = outdir / f"{s['id']}.webp"
        rec = manifest.get(s["id"])
        if rec and dst.exists() and rec.get("commons") == s["commons"]:
            continue
        target = 2700 if s.get("crop") else max_side
        url = ii["url"] if s.get("ia") else pick_url(ii, target, s["commons"])
        ext = Path(url.split("?")[0]).suffix.lower() or ".jpg"
        src = srcdir / f"{s['id']}{ext}"
        if not src.exists():
            status, body, _ = fetch(url, cache=False)
            if status != 200:
                rejected.append(f"{s['id']}: download failed HTTP {status}")
                continue
            src.write_bytes(body)
        work = src
        if ext == ".jp2":  # ImageMagick here has no JPEG 2000 delegate; macOS sips decodes it.
            import subprocess
            work = srcdir / f"{s['id']}.png"
            subprocess.run(["sips", "-s", "format", "png", str(src), "--out", str(work)],
                           check=True, capture_output=True)
        if s.get("crop"):
            work = crop_plate(work, srcdir / f"{s['id']}.crop.png", s.get("rotate", 0))
        elif s.get("rotate"):
            import subprocess
            work = srcdir / f"{s['id']}.rot.png"
            subprocess.run(["magick", str(src), "-rotate", str(s["rotate"]), str(work)], check=True)
        w, h, size = to_webp(work, dst, max_side, max_bytes,
                             enhance=bool(s.get("crop")))
        manifest[s["id"]] = {"commons": s["commons"], "width": w, "height": h, "bytes": size,
                             "source_page": ii["descriptionurl"], "credit": credit_for(s, ii)}
        manifest_p.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
        print(f"[{n + 1}/{len(specs)}] {s['id']} {w}x{h} {size // 1024} KB", flush=True)
    manifest_p.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    return manifest, rejected


def image_specs() -> tuple[list[dict], list[str]]:
    import dore
    import evidence
    import portraits
    d, rej = dore.specs()
    return d + portraits.specs() + evidence.specs(), rej


def merge(kind: str) -> None:
    main_p = CACHE / f"built_{kind}.json"
    manifest = json.loads(main_p.read_text()) if main_p.exists() else {}
    parts = sorted(CACHE.glob(f"built_{kind}.part*.json"))
    for p in parts:
        manifest.update(json.loads(p.read_text()))
    main_p.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    for p in parts:
        p.unlink()
    print(f"merged {len(parts)} part files; {len(manifest)} {kind} in manifest")


if __name__ == "__main__":
    if sys.argv[1:2] == ["merge"]:
        merge(sys.argv[2] if len(sys.argv) > 2 else "images")
        raise SystemExit(0)
    kind = sys.argv[1] if len(sys.argv) > 1 else "images"
    shard = sys.argv[sys.argv.index("--shard") + 1] if "--shard" in sys.argv else ""
    if kind == "images":
        specs, rej = image_specs()
    else:
        import maps
        specs, rej = maps.specs(), []
    part = ""
    if shard:
        i, n = (int(x) for x in shard.split("/"))
        specs = specs[i::n]
        part = f"part{i}"
    _, rejected = build(kind, specs, part)
    if part:
        (CACHE / f"rejected_{kind}.{part}.txt").write_text("\n".join(rejected))
        print(f"built {kind} shard {shard}; rejected {len(rejected)}")
        raise SystemExit(0)
    (CACHE / f"rejected_{kind}.json").write_text(json.dumps(rej + rejected, indent=1, ensure_ascii=False))
    print(f"built {kind}; rejected {len(rej + rejected)}")
    for r in rej + rejected:
        print("  REJECTED", r)
