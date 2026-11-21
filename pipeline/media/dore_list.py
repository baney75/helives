"""Parse the Commons gallery "Doré's Bible Illustrations" into (file, caption, section) rows."""
from __future__ import annotations
import json
import re
from common import commons, CACHE

def gallery() -> list[dict]:
    d = commons({"action": "parse", "page": "Doré's Bible Illustrations", "prop": "wikitext"})
    rows, section = [], ""
    for line in d["parse"]["wikitext"].splitlines():
        m = re.match(r"=+\s*(.*?)\s*=+\s*$", line.strip())
        if m:
            section = m.group(1)
            continue
        if "|" in line and re.search(r"\.(jpe?g|png|gif|tiff?)\|", line, re.I):
            f, cap = line.split("|", 1)
            f = "File:" + f.strip().replace("_", " ")
            cap = re.sub(r"\[\[[^\]]*\]\]", "", cap).strip()
            title, _, ref = cap.partition("<br>")
            rows.append({"file": f, "title": title.strip(), "ref": ref.strip(), "section": section})
    return rows

if __name__ == "__main__":
    rows = gallery()
    (CACHE / "dore_gallery.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    print(len(rows))
