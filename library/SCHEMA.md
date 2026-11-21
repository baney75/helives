# Library data contract

Every text in the library is one TOML file (canonical) plus one Markdown file generated from it.
The site, search index, downloads and audiobooks all read the TOML. Ingest scripts write TOML only;
`pipeline/render_md.py` writes the Markdown next to it.

## Layout

```
library/
  catalog/<collection>.toml        that collection's [collection] entry and its [authors.*]; one writer each
  bible/bsb/01-genesis.toml        one file per book, 66 files
  creeds/<slug>.toml
  apostolic/<slug>.toml            Apostolic Fathers
  ante-nicene/<author>/<slug>.toml
  nicene/<author>/<slug>.toml      NPNF series 1 and 2 (Augustine, Chrysostom, Athanasius, ...)
  aquinas/summa-<part>.toml        Summa Theologica, one file per part
  gnostic/<slug>.toml              Gnostic texts (historical; labeled as rejected by the church)
  encyclicals/<pope>/<slug>.toml   full text only when the English translation is public domain
```

Slugs: lowercase ASCII, words joined by `-`, stable forever (URLs and audio files depend on them).

## Work file

```toml
[work]
id = "augustine-confessions"           # globally unique, equals the file slug path joined by "-"
title = "The Confessions"
short_title = "Confessions"            # optional
author = "augustine"                   # key into catalog.toml [authors]; "bible" for Scripture
collection = "nicene"                  # bible | creeds | apostolic | ante-nicene | nicene | aquinas | gnostic | encyclicals
order = 10                             # sort order inside the collection
date = "397-400"                       # composition date, free text, sourced
language = "Latin"                     # original language
translator = "J. G. Pilkington"
edition = "Nicene and Post-Nicene Fathers, Series 1, Vol. 1 (1886), ed. Philip Schaff"
source_url = "https://www.ccel.org/ccel/schaff/npnf101.xml"
source_sha256 = "..."                  # of the downloaded source file
retrieved = "2026-11-21"
license = "Public domain"              # must be "Public domain"; anything else is not ingested
license_basis = "Published 1886 in the United States"
words = 82413                          # count of words in all text blocks, computed
summary = "..."                        # one or two neutral sentences; optional at ingest

[[section]]
id = "book-1"                          # unique inside the work, URL-safe
title = "Book I"
level = 1                              # 1 = top division (Bible chapter, Book), 2 = chapter, 3 = article
blocks = [
  { t = "h", text = "Chapter 1. He proclaims the greatness of God" },
  { t = "p", text = "Great art Thou, O Lord, and greatly to be praised.[^1]" },
  { t = "note", id = "1", text = "Ps. 145:3." },
]
```

Sections are flat and in reading order; `level` gives the outline. A section holds the text from its
heading to the next section. Keep sections between ~300 and ~6,000 words where the source allows;
split long ones at the source's own subdivisions, never mid-paragraph.

### Block types

| t | Fields | Meaning |
|---|---|---|
| `h` | `text`, optional `level` (2 to 4) | heading inside a section |
| `p` | `text`, optional `run_on = true` | prose paragraph; `run_on = true` means the line runs on into the next block, so the narrator reads them as one sentence (used for line-by-line prayers) |
| `q` | `text`, optional `indent` (1 to 3) | poetry or indented line |
| `v` | `n`, `text`, optional `p = true`, optional `indent`, optional `cont = true` | Bible verse; `p = true` starts a new paragraph; `cont = true` continues verse `n` after a heading that falls inside it (no number shown) |
| `bq` | `text` | block quotation |
| `note` | `id`, `text` | footnote; referenced inline as `[^id]` |
| `ref` | `text` | cross-reference line (Bible) |

Inline markup inside `text` is limited to: `*italic*`, `**bold**`, `[^id]` footnote markers.
No HTML, no links, no other Markdown. Greek, Hebrew and Latin stay as Unicode. Straight ASCII
quotes are fine; keep the source's curly quotes when it has them. Strip page numbers, running
heads, editorial page markers and scan artifacts.

### Bible files

`collection = "bible"`, `author = "bible"`, `id = "bsb-<book-slug>"`. One `[[section]]` per chapter,
`id = "<chapter number>"`, `level = 1`, `title = "<Book> <n>"`. BSB section headings become `h` blocks
before the verse they precede. Every verse is a `v` block. Extra work fields: `testament = "OT" | "NT"`,
`book_number` (1 to 66), `chapters`, `verses`.

## catalog/<collection>.toml

Each ingest owns the catalog file for its collections. Author keys are global; if two files define the
same author key, the definitions must be identical.

```toml
[[collection]]
id = "nicene"
title = "Nicene and Post-Nicene Fathers"
order = 5
summary = "..."

[authors.augustine]
name = "Augustine of Hippo"
dates = "354-430"
role = "Bishop of Hippo"
summary = "..."                        # neutral, factual, from the source's own introduction or a cited reference
portrait = ""                          # media id, filled by the media step
source = "https://..."                 # where the dates and summary come from
```

## Checks every ingest must pass (`pipeline/validate.py`)

- Parses as TOML; required `[work]` fields present; `license == "Public domain"`.
- Section ids unique; levels never jump down by more than one.
- Every `[^id]` has a `note` with that id in the same section, and every note is referenced.
- No leftover markup: no `<`, `>`, `&amp;`, `{`, `\`, page-number lines, or `[Pg` style artifacts in text.
- Bible: 66 books, chapter and verse counts equal the BSB source; every verse text equals `bsb.txt`
  after whitespace and footnote-marker normalization.
- Word count recomputed and stored.
