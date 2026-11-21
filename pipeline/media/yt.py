"""YouTube helpers: parse search-result pages for real video ids, verify with oEmbed."""
from __future__ import annotations

import json
import re
import urllib.parse

from common import BROWSER_UA, fetch


def _initial_data(html: str) -> dict:
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        m = re.search(r'window\["ytInitialData"\] = (\{.*?\});', html, re.S)
    return json.loads(m.group(1)) if m else {}


def _walk(o, key):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == key:
                yield v
            yield from _walk(v, key)
    elif isinstance(o, list):
        for x in o:
            yield from _walk(x, key)


def _text(o) -> str:
    if not o:
        return ""
    if "simpleText" in o:
        return o["simpleText"]
    return "".join(r.get("text", "") for r in o.get("runs", []))


def search(query: str) -> list[dict]:
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query, "hl": "en", "gl": "US"})
    status, body, _ = fetch(url, ua=BROWSER_UA, gap=1.5)
    if status != 200:
        return []
    data = _initial_data(body.decode("utf-8", "replace"))
    out = []
    for vr in _walk(data, "videoRenderer"):
        vid = vr.get("videoId")
        if not vid:
            continue
        out.append({
            "id": vid,
            "title": _text(vr.get("title")),
            "channel": _text(vr.get("ownerText")) or _text(vr.get("longBylineText")),
            "duration": _text(vr.get("lengthText")),
            "views": _text(vr.get("viewCountText")),
        })
    return out


def channel_videos(handle: str) -> list[dict]:
    """First page of a channel's /videos tab (handle like '@bibleproject')."""
    url = f"https://www.youtube.com/{handle}/videos?hl=en&gl=US"
    status, body, _ = fetch(url, ua=BROWSER_UA, gap=1.5)
    if status != 200:
        return []
    data = _initial_data(body.decode("utf-8", "replace"))
    out = []
    for vr in _walk(data, "videoRenderer"):
        if vr.get("videoId"):
            out.append({"id": vr["videoId"], "title": _text(vr.get("title")),
                        "duration": _text(vr.get("lengthText")), "channel": handle})
    return out


def oembed(video_id: str, cache: bool = True) -> tuple[int, dict]:
    u = "https://www.youtube.com/oembed?" + urllib.parse.urlencode(
        {"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"})
    status, body, _ = fetch(u, cache=cache, gap=1.0)
    try:
        return status, json.loads(body) if status == 200 else {}
    except json.JSONDecodeError:
        return status, {}
