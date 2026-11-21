// Writes build/search.sql: the D1 full-text index behind /api/search.
// One row per Bible verse, per paragraph of prose, per video, article and encyclical.
// Load it with: node scripts/load-search.mjs (chunked; see RUNBOOK.md). build/search-chunks/ holds the pieces.
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { plain } from './lib/html.mjs'
import { COLLECTION, ROOT, loadLibrary, readToml } from './lib/load.mjs'
import { bookSlug, sectionUrl, shortTitle, workUrl } from './lib/render.mjs'
import { assertClean, chunkStatements } from './lib/search-chunks.mjs'

const OUT = join(ROOT, 'build')
const MAX_STATEMENT = 90_000 // D1 caps one statement at 100 KB
const sql = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`
const clean = (t) => plain(String(t).replace(/\[\^[^\]]+\]/g, '')).replace(/\s+/g, ' ').trim()

const lib = loadLibrary()
const rows = []
const add = (title, body, url, place, scope, boost = 1) => {
  if (body) rows.push(`(${sql(title)},${sql(body)},${sql(url)},${sql(place)},${sql(scope)},${boost})`)
}

for (const w of lib.works) {
  const doc = readToml(w.path)
  if (w.collection === 'bible') {
    const slug = bookSlug(w)
    for (const s of doc.section) {
      const verses = new Map()
      for (const b of s.blocks) if (b.t === 'v') verses.set(b.n, (verses.get(b.n) ? verses.get(b.n) + ' ' : '') + clean(b.text))
      for (const [n, text] of verses) add(`${w.title} ${s.id}:${n}`, text, `/bible/${slug}/${s.id}/#v${n}`, 'Berean Standard Bible', 'bible', 1.25)
    }
    continue
  }
  const author = lib.authors[w.author]?.name
  const place = [w.short_title || w.title, author && w.author !== 'church' ? author : null].filter(Boolean).join(' · ')
  const boost = w.collection === 'creeds' ? 1.2 : 1
  for (const s of doc.section) {
    const url = sectionUrl(w, String(s.id))
    const title = s.title && s.title !== w.title ? `${w.short_title || w.title}: ${shortTitle(s.title)}` : w.title
    let buf = ''
    for (const b of s.blocks) {
      if (b.t !== 'p' && b.t !== 'q' && b.t !== 'bq' && b.t !== 'v') continue
      buf = buf ? `${buf} ${clean(b.text)}` : clean(b.text)
      // join short lines (poetry, creeds) so each row is a readable passage
      if (buf.split(' ').length >= 25) {
        add(title, buf, url, place, w.collection, boost)
        buf = ''
      }
    }
    add(title, buf, url, place, w.collection, boost)
  }
}

for (const v of lib.media.videos) add(v.title, [v.description, v.channel, ...(v.tags || [])].filter(Boolean).join(' · '), v.url, `Video · ${v.channel || 'YouTube'}`, 'media', 0.9)
for (const a of lib.media.articles) add(a.title, [a.description, a.author, a.publisher].filter(Boolean).join(' · '), a.url, `Article · ${a.publisher || ''}`, 'media', 0.9)
const hosted = new Map(lib.works.filter((w) => w.collection === 'encyclicals').map((w) => [w.id, w]))
for (const e of lib.encyclicals) {
  const local = e.full_text && hosted.get(e.full_text)
  add(e.title, [e.english_title, e.subject, e.pope, String(e.date).slice(0, 4)].filter(Boolean).join(' · '), local ? workUrl(local) : e.url, `Encyclical · ${e.pope}, ${String(e.date).slice(0, 4)}`, 'encyclicals', 1.1)
}

assertClean(rows)
const head = [
  'DROP TABLE IF EXISTS doc;',
  "CREATE VIRTUAL TABLE doc USING fts5(title, body, url UNINDEXED, place UNINDEXED, scope UNINDEXED, boost UNINDEXED, tokenize = 'porter unicode61 remove_diacritics 2');",
]
const stmts = []
let batch = []
let size = 0
for (const r of rows) {
  if (size + r.length > MAX_STATEMENT && batch.length) {
    stmts.push(`INSERT INTO doc (title, body, url, place, scope, boost) VALUES ${batch.join(',')};`)
    batch = []
    size = 0
  }
  batch.push(r)
  size += r.length + 1
}
if (batch.length) stmts.push(`INSERT INTO doc (title, body, url, place, scope, boost) VALUES ${batch.join(',')};`)
const body = [...head, ...stmts, "INSERT INTO doc(doc) VALUES('optimize');", ''].join('\n')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'search.sql'), body)
const hash = createHash('sha256').update(body).digest('hex').slice(0, 16)
writeFileSync(join(OUT, 'search.hash'), hash + '\n')
writeFileSync(join(OUT, 'search.count'), rows.length + '\n')
const CHUNKS = join(OUT, 'search-chunks')
rmSync(CHUNKS, { recursive: true, force: true })
mkdirSync(CHUNKS, { recursive: true })
chunkStatements(head, stmts, ["INSERT INTO doc(doc) VALUES('optimize');"]).forEach((c, i) =>
  writeFileSync(join(CHUNKS, `${String(i).padStart(3, '0')}.sql`), c),
)
const byScope = {}
for (const r of rows) {
  const scope = r.match(/,'([a-z-]+)',[\d.]+\)$/)?.[1]
  byScope[scope] = (byScope[scope] || 0) + 1
}
console.log(`search-index: ${rows.length} rows, ${stmts.length} statements, ${(body.length / 1e6).toFixed(1)} MB, hash ${hash}`)
console.log(Object.entries(byScope).map(([k, v]) => `${COLLECTION[k]?.short || k} ${v}`).join(', '))
