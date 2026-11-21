# He Lives

[helives.dev](https://helives.dev) is a free library of Holy Scripture and the writings of the church, made to be easy to read, hear, print and keep. Every text on it is in the public domain.

## What is in it

- **Holy Scripture**: the Berean Standard Bible, all 66 books, with its headings, footnotes and cross-references.
- **The Apostolic Fathers**: Clement, Ignatius, Polycarp, the Didache, the Shepherd of Hermas and more.
- **Ante-Nicene Fathers** and **Nicene and Post-Nicene Fathers**: the Schaff editions, including Irenaeus, Tertullian, Athanasius, Chrysostom and Augustine (the Confessions, the City of God and more).
- **Thomas Aquinas**: the Summa Theologica.
- **The Creeds**: the Apostles', Nicene, Niceno-Constantinopolitan and Athanasian creeds and the Chalcedonian Definition.
- **Gnostic texts**: historical documents the early church examined and rejected, labeled as such and never presented as Scripture.
- **Papal encyclicals**: a searchable index linked to vatican.va, with full text hosted only where the English translation is public domain.
- **Art, maps and video**: public domain art and maps, and curated YouTube videos that load only when you press play.
- **Search** across everything, and Bible references like `John 3:16` or `ps 23` that open the passage.

## Made for readers who need it calm

The reading settings are built for people with ADHD, OCD, dyslexia, visual snow (VSS) or light sensitivity. They stay on your device and nothing is sent anywhere.

- **Focus bold** bolds the start of each word so the eye lands on it. On, Light, Strong or Off.
- **Calm themes**: Night, Dusk (low contrast, no pure black or white), Paper, Sepia, High contrast, or match your device.
- **No motion**: nothing animates, and smooth scrolling is off when your device asks for reduced motion.
- **Reading ruler**: a soft band that follows your pointer or tap, or dims everything else.
- **Fonts**: a serif, Atkinson Hyperlegible Next, or OpenDyslexic.
- Text size, line spacing, letter and word spacing, line length, verse numbers, footnotes, and one verse per line.
- **Background sound**: brown, pink or white noise, rain, a stream, a fireplace or wind, with a stop timer. Sounds are made in your browser; nothing is downloaded.
- **Listen**: audiobook narration on sections that have it, with the verse or paragraph being read highlighted.
- Keyboard: left and right arrows change pages, `/` searches, `R` opens reading settings.
- Pages work without JavaScript, and the site remembers where you stopped reading.

## Download the texts

Every work can be downloaded from its page or from [helives.dev/downloads](https://helives.dev/downloads/):

- `https://helives.dev/dl/<work-id>.md`: Markdown, for any text editor or notes app.
- `https://helives.dev/dl/<work-id>.toml`: structured data for programs (format in [library/SCHEMA.md](library/SCHEMA.md)).
- `https://helives.dev/dl/bsb-complete.md` and `bsb-complete.toml`: the whole Bible in one file.
- Every work has a print page that holds the whole text. Choose "Save as PDF" in the print dialog for a PDF.

The same files live in this repository under [`library/`](library/).

## Sources and licenses

| Texts | Edition | Digital source | Why it is public domain |
| --- | --- | --- | --- |
| Berean Standard Bible | BSB (2023) | [bereanbible.com](https://bereanbible.com) | Dedicated to the public domain by the Berean Bible Translation Committee (2023) |
| Apostolic, Ante-Nicene and Nicene and Post-Nicene Fathers | Schaff, Roberts and Donaldson editions (1885 to 1900) | [Christian Classics Ethereal Library](https://www.ccel.org) | Published in the United States, 1885 to 1900 |
| Summa Theologica | Fathers of the English Dominican Province, Benziger Bros. (1947) | [Christian Classics Ethereal Library](https://www.ccel.org/ccel/aquinas/summa.xml) | First published 1911 to 1925; the CCEL text is marked public domain |
| The Creeds | Philip Schaff, The Creeds of Christendom (1877) | [Christian Classics Ethereal Library](https://www.ccel.org) | Published 1877 in the United States |
| Pistis Sophia | G. R. S. Mead, revised edition (1921) | [gnosis.org](http://gnosis.org/library/pistis-sophia/index.htm) | Published before 1931 |
| Hymn of the Pearl | G. R. S. Mead, Echoes from the Gnosis, Vol. X (1908) | [Internet Archive](https://archive.org/details/MeadGRSEchoesFromTheGnosisVolXTheHymnOfTheRobeOfGlory1908) | Published before 1931 |
| Papal encyclicals | Index of every encyclical | [vatican.va](https://www.vatican.va) | Linked, not hosted, unless an English translation printed before 1931 exists |
| Art and maps | 19th and early 20th century works | [Wikimedia Commons](https://commons.wikimedia.org) | Public domain; each image credits its source page |
| Videos | Curated YouTube videos | [YouTube](https://www.youtube.com) | Not hosted; embedded from youtube-nocookie.com and owned by their makers |

Each work's TOML records its exact `edition`, `source_url`, `source_sha256`, `retrieved` date and `license_basis`. The site lists them all at [helives.dev/about](https://helives.dev/about/).

## Build and run locally

You need Node with pnpm, and Python 3.11 or newer for the pipeline.

```bash
pnpm install
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm exec wrangler dev --port 8841
```

Then open http://localhost:8841. Word search needs the full-text index in the local database. Build and load it once:

```bash
node site/search-index.mjs
pnpm exec wrangler d1 execute helives-library --local --file build/search.sql
```

Bible references like `John 3:16` work without it.

To check the interactive parts in a browser:

```bash
node scripts/check-ui.mjs http://localhost:8841
```

## Layout

```
library/        one TOML per work (canonical) plus generated Markdown
pipeline/       Python ingest, validate.py, render_md.py
media/          videos, art, maps and articles catalogs
data/           the encyclicals index
site/           static generator (build.mjs, lib/) and browser assets (assets/)
worker/         Cloudflare Worker: assets, /api/search, /audio/*, security headers
audio/          audiobook renderer and publishing scripts
scripts/        browser checks and screenshots
public/         fonts, icons and images copied into the build
```

## Contributing

Issues and pull requests are welcome. Before you open one:

- Every text must be in the public domain, with the reason written in `license_basis`.
- Run `pnpm validate` after any change to `library/`, then `pnpm md` to regenerate the Markdown.
- Run `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
- For visible changes, include screenshots at 390 and 1280 pixels wide (`node scripts/shots.mjs`).

The site's code is MIT licensed; see [LICENSE](LICENSE). The texts are public domain.

## Sponsors

<!-- sponsors:start -->
No sponsors yet. [Sponsor on GitHub](https://github.com/sponsors/baney75) and your name appears here automatically.
<!-- sponsors:end -->
