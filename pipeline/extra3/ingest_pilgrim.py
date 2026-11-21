"""Ingest John Bunyan, The Pilgrim's Progress, Part One, from Project Gutenberg EBook #131 (plain text).

Usage: python3 -I pipeline/extra3/ingest_pilgrim.py
Reads pipeline/cache/extra3/pg131.txt (fetch.py pg131.txt https://gutenberg.pglaf.org/1/3/131/131-0.txt);
writes library/reformation/bunyan-pilgrims-progress.toml.

The transcription numbers its paragraphs "{1}", "{2}" for reference ("chosen arbitrarily", says its
note); those numbers are stripped, as are the transcriber's notes and the one footnote it marks as
"from one edition". Bunyan's marginal notes (standalone short lines) and his bracketed Scripture
references stay as plain text. Indented lines are verse. Section breaks fall at the episodes named in
EPISODES; the names are section titles only and add nothing to the text.
Downloads are untrusted data: run with python3 -I.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from common import fix_chars, section_words  # noqa: E402
from fetch import meta  # noqa: E402
from gutenberg import read_text  # noqa: E402
from libtoml import LIBRARY, slugify, write_work  # noqa: E402

NAME = "pg131.txt"
OUT = LIBRARY / "reformation" / "bunyan-pilgrims-progress.toml"

# (opening words of the paragraph that starts the episode, section title)
EPISODES = [
    ("When at the first I took my pen in hand", "The Author's Apology for His Book"),
    ("As I walked through the wilderness of this world", "The City of Destruction"),
    ("Now, I saw in my dream, that just as they had ended this talk", "The Slough of Despond"),
    ("Now, as Christian was walking solitarily by himself", "Mr. Worldly Wiseman"),
    ("So, in process of time, Christian got up to the gate", "The Wicket Gate"),
    ("Then he went on till he came to the house of the Interpreter", "The House of the Interpreter"),
    ("Now I saw in my dream, that the highway up which Christian was to go", "The Cross"),
    ("I beheld, then, that they all went on till they came to the foot of the Hill Difficulty", "The Hill Difficulty"),
    ("So I saw in my dream that he made haste and went forward", "The Palace Beautiful"),
    ("But now, in this Valley of Humiliation", "Apollyon"),
    ("Now, at the end of this valley was another, called the Valley of the Shadow of Death",
     "The Valley of the Shadow of Death"),
    ("Now, as Christian went on his way, he came to a little ascent", "Faithful"),
    ("Moreover, I saw in my dream, that as they went on", "Talkative"),
    ("Then I saw in my dream, that when they were got out of the wilderness", "Vanity Fair"),
    ("Now I saw in my dream, that Christian went not forth alone", "Hopeful and By-ends"),
    ("Now there was, not far from the place where they lay, a castle called Doubting Castle", "Doubting Castle"),
    ("They went then till they came to the Delectable Mountains", "The Delectable Mountains"),
    ("And I slept, and dreamed again", "Ignorance and Little-Faith"),
    ("I saw then in my dream, that they went till they came into a certain country", "The Enchanted Ground"),
    ("Now I saw in my dream, that by this time the pilgrims were got over the Enchanted Ground", "Beulah and the River"),
    ("Now, Reader, I have told my dream to thee", "The Conclusion"),
]

EDITION = ("John Bunyan, The Pilgrim's Progress from This World to That Which Is to Come, Part One (first "
           "published London: Nathaniel Ponder, 1678); Project Gutenberg EBook #131")
BASIS = ("First published in London in 1678; the text has been in the public domain for centuries and Project "
         "Gutenberg distributes this transcription as a public domain work in the United States. The "
         "transcriber's paragraph numbers, notes and one editorial footnote are not included.")


def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


def paragraphs(text: str) -> list[dict]:
    body = text[text.find("***", text.find("START OF")) + 3:text.find("*** END")]
    # skip the transcriber's notes and the title lines: start at the Apology heading
    body = body[body.find("The Author's Apology for his Book") + len("The Author's Apology for his Book"):]
    blocks: list[dict] = []
    for raw in re.split(r"\n\s*\n", body):
        if not raw.strip():
            continue
        lines = raw.split("\n")
        first = lines[0]
        txt = " ".join(raw.split())
        if txt in ("THE PILGRIM'S PROGRESS", "In the Similitude of a Dream", "JOHN BUNYAN.",
                   "{404} The Conclusion."):
            continue
        if "{footnote from one edition}" in txt:
            continue
        if any(ln.startswith(" ") for ln in lines if ln.strip()) and len(lines) > 1 or first.startswith(" "):
            for ln in lines:
                ln = re.sub(r"^\s*\{\d+\}\s*", "", ln).rstrip()
                if ln.strip():
                    blocks.append({"t": "q", "text": ln.strip()})
            continue
        txt = re.sub(r"^\{\d+\}\s*", "", txt)
        txt = re.sub(r"\s*\{\d+\}\s*", " ", txt).strip()
        blocks.append({"t": "p", "text": txt})
    for b in blocks:
        t = b["text"].replace("--", "—")
        t = re.sub(r"\*\s*$", "", t) if t.endswith("*") else t  # the dropped footnote's marker
        b["text"] = fix_chars(t)
    return blocks


def main() -> int:
    m = meta(NAME)
    blocks = paragraphs(read_text(HERE.parent / "cache" / "extra3" / NAME))
    starts = {}
    for key, title in EPISODES:
        hits = [i for i, b in enumerate(blocks) if norm(b["text"]).startswith(norm(key))]
        if not hits:  # the episode opens mid-paragraph: break before that paragraph
            hits = [i for i, b in enumerate(blocks) if norm(key) in norm(b["text"])]
        assert len(hits) == 1, (key, len(hits))
        starts[hits[0]] = title
    assert 0 in starts, "the first block must open the Apology"
    secs = []
    for i, b in enumerate(blocks):
        if i in starts:
            secs.append({"title": starts[i], "level": 1, "blocks": []})
        secs[-1]["blocks"].append(b)
    for s in secs:
        s["id"] = slugify(re.sub(r"['’]", "", s["title"]))
    assert not any("{" in b["text"] for s in secs for b in s["blocks"])
    work = {
        "id": "bunyan-pilgrims-progress", "title": "The Pilgrim's Progress", "short_title": "Pilgrim's Progress",
        "author": "bunyan", "collection": "reformation", "order": 30, "date": "1678",
        "language": "English", "edition": EDITION, "source_url": m["url"], "source_sha256": m["sha256"],
        "retrieved": m["retrieved"], "license": "Public domain", "license_basis": BASIS,
        "summary": "Bunyan's allegory of the Christian life, told as a dream of the pilgrim Christian's journey "
                   "from the City of Destruction to the Celestial City. This is Part One; Part Two, on the "
                   "journey of his wife Christiana, is not included.",
    }
    write_work(OUT, work, secs)
    for s in secs:
        print(f"  {s['id']:40} {section_words(s['blocks']):6}")
    print(f"wrote {OUT.relative_to(LIBRARY.parent)}: {len(secs)} sections")
    return 0


if __name__ == "__main__":
    sys.exit(main())
