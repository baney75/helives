"""Ingest CCEL ThML volumes (ANF, NPNF 1 and 2) into library work TOMLs.

Usage: python3 -I pipeline/ccel/ingest.py [volume ...]     (default: every volume in volumes.py)
       python3 -I pipeline/ccel/ingest.py --plan anf01      (print the work plan only)
Writes library/<collection>/... and pipeline/cache/ccel/used-<vol>.txt (div ids consumed, for audit.py).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from libtoml import LIBRARY, sha256_file, write_work
from libtoml import slugify as _slugify  # noqa: E402
from build import Builder  # noqa: E402
from plan import INTRO_RX, POST_RX, SKIP_RX, G, SKIP, W  # noqa: E402
from thml import CACHE, Volume, div_title, is_div, load  # noqa: E402
import volumes  # noqa: E402

TRANS_RX = re.compile(
    r"\b(?i:translated)(?: into English)?(?: from the [A-Z][a-z]+)?(?: with [^.\]]{0,60}?)? by\s+"
    r"((?:the\s+)?(?:Rev\.\s+|Very Rev\.\s+|Professor\s+|Prof\.\s+|Dr\.\s+|Mr\.\s+)?"
    r"[A-Z][^\[\]]{2,120}?)(?:\.\]|\]|\.\s*$|\)|\.\s+(?=[A-Z][a-z]+ [a-z])|;)",
)


def slugify(s: str) -> str:
    return _slugify(re.sub(r"['’]", "", s))


def text_of(el, limit=6000) -> str:
    return " ".join("".join(el.itertext()).split())[:limit]


def resolve(v: Volume, ids: list) -> list:
    out = []
    for i in ids:
        if ".." in i:
            a, b = i.split("..")
            ea, eb = v.by_id[a], v.by_id[b]
            par = v.parent[ea]
            sib = [c for c in par if is_div(c)]
            ia, ib = sib.index(ea), sib.index(eb)
            out.extend(sib[ia : ib + 1])
        else:
            if i not in v.by_id:
                raise KeyError(f"{v.name}: no div {i}")
            out.append(v.by_id[i])
    return out


def classify(el) -> str:
    t = (el.get("title") or el.get("shorttitle") or "").strip()
    if SKIP_RX.match(t):
        return "skip"
    if POST_RX.match(t):
        return "post"
    if INTRO_RX.match(t):
        return "intro"
    return "work"


def clean_title(t: str) -> str:
    t = " ".join(t.split()).strip()
    t = re.sub(r"\s*\.$", "", t)
    if t.isupper() and len(t) > 3:
        t = t.title()
    return t


def expand(v: Volume, vs, spec) -> list:
    """Expand a G spec into W specs."""
    cont = v.by_id[spec.container]
    kids = [c for c in cont if is_div(c)]
    works: list = []
    pending: list = [v.by_id[i] for i in spec.pre]
    for k in kids:
        kid = k.get("id")
        if kid in spec.skip:
            continue
        name = spec.names.get(kid)
        kind = "work" if name else classify(k)
        if kind == "skip":
            if len(text_of(k).split()) > 60:
                kind = "intro"
            else:
                continue
        if kind == "intro":
            pending.append(k)
            continue
        if kind == "post" and works:
            works[-1].divs.append(k.get("id"))
            continue
        if kind == "post":
            pending.append(k)
            continue
        if isinstance(name, tuple):
            slug, title = name
        elif kid in spec.titles:
            title = spec.titles[kid]
            slug = name or slugify(title)
        else:
            title = clean_title(div_title(k) if not k.get("title") else k.get("title"))
            slug = name or slugify(title)
        w = W(
            divs=[d.get("id") for d in pending + [k]],
            author=spec.authors.get(kid, spec.author),
            slug=slug,
            title=title,
            coll=spec.coll,
            lang=spec.langs.get(kid, spec.lang),
            unwrap=[kid],
            translator=spec.translator,
        )
        pending = []
        works.append(w)
    if pending and works:
        works[-1].divs.extend(d.get("id") for d in pending)
    if spec.post and works:
        works[-1].divs.extend(spec.post)
    return works


DEGREE = re.compile(r",?\s*\b(M\.\s?A|D\.\s?D|Ph\.\s?D|B\.\s?A|LL\.\s?D|A\.\s?M|F\.R\.A\.S|B\.\s?D|D\.\s?C\.\s?L|Hon|Litt\.\s?D)\b\.?", re.I)
TAIL = re.compile(r",\s*(late|one of|vicar|trinity|oxon|esq|etc|fellow|rector|professor|canon|of|sometime|formerly|minister|head|principal|chaplain|lecturer|tutor|scholar)\b.*$", re.I)


def norm_translator(name: str) -> str:
    n = re.sub(r"(?<=[a-z]{4})\.\s.*$", "", name)
    n = re.sub(r"(,\s*(M\.\s?A|D\.\s?D|B\.\s?D|Ph\.\s?D|LL\.\s?D|B\.\s?A)\b\.?)(?!,?\s*and\b).*$", "", n)
    n = re.sub(r"\s+[IVX]+\.\s.*$", "", n)
    n = DEGREE.sub("", n)
    n = re.sub(r"\s+(of|Of)\s+[A-Z].*$", "", n)
    n = TAIL.sub("", n)
    n = re.sub(r"\s*\([^)]*$", "", n)  # unbalanced trailing parenthesis
    n = re.sub(r"\s+,", ",", n).replace(", and ", " and ")
    n = re.sub(r"\s+", " ", n).strip(" ,.;")
    n = re.sub(r",\s*[A-Z][a-z]+$", "", n)
    n = re.sub(r"^Rev\.\s+Professor\s+", "Professor ", n)
    if n.count("(") != n.count(")"):
        n = n.replace("(", "").replace(")", "")
    return n


TRANS_CI = re.compile(
    r"\b(?:translated|translation)\b(?:,? (?:with|and)[^.]{0,60}?)?(?: revised)?(?:,? with [^.]{0,60}?)? by\s+"
    r"((?:the\s+)?(?:rev\.\s+|very rev\.\s+|professor\s+|prof\.\s+|dr\.\s+|sir\s+)*[a-z][a-z.]*(?:\s+[a-z][a-z.\-]*){1,5}?)"
    r"(?=,|\.\s|\.$|;|\s+(?:and|with)\b)",
    re.I,
)
OXFORD = re.compile(r"\bthe oxford translations?\b[^.]{0,40}?\bby\s+((?:rev\.\s+)?[a-z][a-z.]*(?:\s+[a-z][a-z.\-]*){1,4}?)(?=,|\.\s|\.$)", re.I)


def smart_title(s: str) -> str:
    return " ".join(w[:1].upper() + w[1:].lower() for w in s.split())


def title_page_translator(v: Volume, divs: list) -> str | None:
    pages = []
    for d in divs:
        for c in d.iter():
            if is_div(c) and re.match(r"^\s*(title page|series title)", c.get("title") or "", re.I):
                pages.append(text_of(c, 1500))
                break
    for t in pages:
        m = OXFORD.search(t)
        if m:
            return "The Oxford translation, revised by " + smart_title(m.group(1)).replace("Rev. ", "")
        m = TRANS_CI.search(t)
        if m:
            name = re.sub(r"^the\s+", "", m.group(1).strip(), flags=re.I)
            return smart_title(name)
    return None


def contents_text(v: Volume) -> str:
    if not hasattr(v, "_contents"):
        parts = []
        for d in v.body:
            if is_div(d) and re.match(r"^\s*(table of )?contents", d.get("title") or "", re.I):
                parts.append(text_of(d, 200000))
        v._contents = " ".join(parts)
    return v._contents


def title_key(title: str) -> list:
    t = re.sub(r"[“”\"'’.,:;()]", " ", title.lower())
    stop = {"a", "the", "of", "on", "and", "st", "s", "to", "treatise", "against", "concerning", "in"}
    return [x for x in t.split() if x not in stop][:4]


def from_contents(v: Volume, title: str) -> str | None:
    c = contents_text(v)
    if not c:
        return None
    key = title_key(title)
    if not key:
        return None
    rx = re.compile(r"\W+(?:\w+\W+){0,3}?".join(re.escape(k) for k in key[:3]), re.I)
    for m in rx.finditer(c):
        seg = c[m.start(): m.start() + 350]
        t = TRANS_RX.search(seg)
        nxt = re.search(r"\b(?i:translated)", seg)
        if t and nxt and nxt.start() < 220:
            return t.group(1)
    return None


def find_translator(v: Volume, w: W, divs: list) -> str | None:
    if w.translator is False or w.lang == "English":
        return None
    if w.translator:
        return w.translator
    c = from_contents(v, w.title)
    if c:
        return norm_translator(re.sub(r"^the\s+", "", c.strip()))
    tp = title_page_translator(v, divs)
    if tp:
        return norm_translator(tp)
    texts = [text_of(d, 4000) for d in divs]
    par = v.parent.get(divs[0])
    if par is not None and is_div(par):
        lead = [c for c in par if not is_div(c)]
        texts.append(" ".join(text_of(c, 800) for c in lead))
        for c in par:
            if is_div(c) and re.match(r"title page", c.get("title") or "", re.I):
                texts.append(text_of(c, 800))
    for t in texts:
        m = TRANS_RX.search(t)
        if m:
            name = m.group(1).strip().rstrip(",.")
            name = re.sub(r"^the\s+", "", name)
            if len(name.split()) <= 14:
                return norm_translator(name)
    return None


def plan_volume(v: Volume, vs) -> tuple[list, list]:
    works: list = []
    skips: list = []
    for spec in vs.specs:
        if isinstance(spec, G):
            for w in expand(v, vs, spec):
                works.append(w)
        elif isinstance(spec, W):
            works.append(spec)
        elif isinstance(spec, SKIP):
            skips.append(spec)
    for w in works:
        w.vol = vs.name
        w.coll = w.coll or vs.coll
        w.lang = w.lang or vs.lang
    return works, skips


def work_path(w: W) -> Path:
    if w.coll == "apostolic":
        return LIBRARY / "apostolic" / f"{w.slug}.toml"
    return LIBRARY / w.coll / w.author / f"{w.slug}.toml"


def work_id(w: W) -> str:
    if w.coll == "apostolic":
        return w.slug
    return f"{w.author}-{w.slug}"


def meta(name: str) -> dict:
    m = {}
    p = CACHE / f"{name}.meta"
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line:
                k, val = line.split("=", 1)
                m[k] = val
    return m


ORDERS: dict[str, int] = {}


def run_volume(vs, plan_only=False) -> dict:
    v = load(vs.name)
    works, skips = plan_volume(v, vs)
    src = CACHE / f"{vs.name}.xml"
    m = meta(vs.name)
    sha = sha256_file(src)
    b = Builder(v)
    report = {"volume": vs.name, "works": [], "skips": [], "unsplit": []}
    for w in works:
        divs = []
        for d in resolve(v, w.divs):
            divs.append(d)
        unwrap = set(w.unwrap or [])
        if w.unwrap is None:
            body = [d for d in divs if classify(d) == "work"]
            if len(body) == 1:
                unwrap = {body[0].get("id")}
        if not w.title:
            w.title = clean_title(divs[0].get("title") or "")
        tr = find_translator(v, w, divs)
        if plan_only:
            print(f"{work_path(w).relative_to(LIBRARY)} | {w.title} | {w.lang} | tr={tr} | divs={[d.get('id') for d in divs]} unwrap={sorted(unwrap)}")
            continue
        b.work_title = w.title
        if not w.title:
            w.title = clean_title(divs[[classify(d) for d in divs].index("work")].get("title") if "work" in [classify(d) for d in divs] else divs[0].get("title"))
        secs = b.work_sections(divs, unwrap, w.label, w.label_from)
        ORDERS[w.coll] = ORDERS.get(w.coll, 0) + 10
        work = {
            "id": work_id(w),
            "title": w.title,
            "short_title": w.short_title,
            "author": w.author,
            "collection": w.coll,
            "order": w.order or ORDERS[w.coll],
            "date": w.date,
            "language": w.lang,
            "translator": tr,
            "edition": vs.edition,
            "source_url": m.get("url", ""),
            "source_sha256": sha,
            "retrieved": m.get("retrieved", date.today().isoformat()),
            "license": "Public domain",
            "license_basis": vs.basis,
        }
        sections = [{k: s[k] for k in ("id", "title", "level", "blocks")} for s in secs]
        path = write_work(work_path(w), work, sections)
        report["works"].append({"path": str(path.relative_to(LIBRARY)), "divs": [d.get("id") for d in divs]})
    for s in skips:
        for d in resolve(v, s.divs):
            report["skips"].append({"div": d.get("id"), "title": d.get("title"), "reason": s.reason})
    report["unsplit"] = b.unsplit
    report["stats"] = v.stats
    if not plan_only:
        (CACHE / f"used-{vs.name}.json").write_text(json.dumps({"used": sorted(b.used), **report}, indent=1))
    return report


def main(argv: list[str]) -> int:
    plan_only = "--plan" in argv
    names = [a for a in argv if not a.startswith("--")]
    specs = volumes.VOLUMES
    if names:
        specs = [s for s in specs if s.name in names]
    # orders are global per collection across the series: compute from full plan order
    for vs in volumes.VOLUMES:
        if vs in specs:
            r = run_volume(vs, plan_only)
            if not plan_only:
                print(f"{vs.name}: {len(r['works'])} works, unsplit>{8000}: {r['unsplit']}, stats {r['stats']}", flush=True)
        else:
            # keep order counters stable when running a subset
            v = load(vs.name)
            works, _ = plan_volume(v, vs)
            for w in works:
                ORDERS[w.coll or vs.coll] = ORDERS.get(w.coll or vs.coll, 0) + 10
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
