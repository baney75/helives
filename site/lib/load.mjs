// Reads the library: catalogs, work outlines (without text) and media catalogs.
// Full text is read again per work while rendering, so the whole corpus is never in memory at once.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from 'smol-toml'
import { plain, WORD_RE } from './html.mjs'

export const ROOT = new URL('../../', import.meta.url).pathname
export const LIB = join(ROOT, 'library')

// Collection routes and display order. The order here is the order of the library.
export const COLLECTIONS = [
  { id: 'bible', route: 'bible', title: 'Holy Scripture', short: 'Scripture' },
  { id: 'apocrypha', route: 'apocrypha', title: 'The Apocrypha', short: 'Apocrypha' },
  { id: 'pseudepigrapha', route: 'pseudepigrapha', title: 'Enoch and the Pseudepigrapha', short: 'Pseudepigrapha' },
  { id: 'jewish', route: 'josephus-and-philo', title: 'Josephus', short: 'Josephus' },
  { id: 'creeds', route: 'creeds', title: 'The Creeds', short: 'Creeds' },
  { id: 'apostolic', route: 'apostolic-fathers', title: 'The Apostolic Fathers', short: 'Apostolic Fathers' },
  { id: 'ante-nicene', route: 'ante-nicene-fathers', title: 'Ante-Nicene Fathers', short: 'Ante-Nicene' },
  { id: 'nicene', route: 'nicene-fathers', title: 'Nicene and Post-Nicene Fathers', short: 'Nicene' },
  { id: 'medieval', route: 'medieval', title: 'Medieval Writers', short: 'Medieval' },
  { id: 'aquinas', route: 'aquinas', title: 'Thomas Aquinas', short: 'Aquinas' },
  { id: 'reformation', route: 'reformation', title: 'The Reformation and After', short: 'Reformation' },
  { id: 'gnostic', route: 'gnostic-texts', title: 'Gnostic Texts', short: 'Gnostic' },
  { id: 'encyclicals', route: 'encyclicals', title: 'Papal Encyclicals', short: 'Encyclicals' },
]
export const COLLECTION = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]))

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.toml')) out.push(p)
  }
  return out
}

export function readToml(path) {
  return parse(readFileSync(path, 'utf8'))
}

export function countWords(blocks) {
  let n = 0
  for (const b of blocks) if (b.t !== 'note' && b.t !== 'ref') n += (plain(b.text).match(WORD_RE) || []).length
  return n
}

// Build the page plan for a work: which sections share a page. A work under PAGE_WORDS is one page.
// Longer works are cut into pages of about CHUNK words. A small subtree is never split; neighbouring
// small subtrees share a page; a large subtree (a book, a part) always starts and ends its own pages.
export const PAGE_WORDS = 12000
export const CHUNK = 9000
export function planPages(sections, isBible) {
  if (isBible) return sections.map((s, i) => ({ id: s.id, from: i, to: i + 1 }))
  const n = sections.length
  const end = Array.from({ length: n })
  const sub = Array.from({ length: n })
  for (let i = n - 1; i >= 0; i--) {
    let j = i + 1
    let w = sections[i].words
    while (j < n && sections[j].level > sections[i].level) {
      w += sub[j]
      j = end[j]
    }
    end[i] = j
    sub[i] = w
  }
  const total = sections.reduce((a, s) => a + s.words, 0)
  if (total <= PAGE_WORDS) return [{ id: '', from: 0, to: n, whole: true }]
  const pages = []
  let cur = null
  const flush = () => {
    if (cur) pages.push(cur)
    cur = null
  }
  const add = (from, to, words) => {
    if (cur && cur.to === from && cur.words + words <= CHUNK) {
      cur.to = to
      cur.words += words
    } else {
      flush()
      cur = { from, to, words }
    }
  }
  const visit = (i, stop) => {
    while (i < stop) {
      if (sub[i] <= PAGE_WORDS) add(i, end[i], sub[i])
      else {
        flush()
        add(i, i + 1, sections[i].words) // the heading and any opening text lead into the first children
        visit(i + 1, end[i])
        flush()
      }
      i = end[i]
    }
  }
  visit(0, n)
  flush()
  for (const p of pages) p.id = sections[p.from].id
  return pages
}

export function loadLibrary() {
  const catalogs = walk(join(LIB, 'catalog')).map(readToml)
  const collections = {}
  const authors = {}
  const external = []
  for (const c of catalogs) {
    for (const col of c.collection || []) collections[col.id] = col
    for (const [k, a] of Object.entries(c.authors || {})) authors[k] = { ...authors[k], ...a, id: k }
    for (const x of c.external || []) external.push(x)
  }
  const works = []
  for (const path of walk(LIB)) {
    const rel = relative(LIB, path)
    if (rel.startsWith('catalog/')) continue
    const doc = readToml(path)
    const w = doc.work
    const sections = (doc.section || []).map((s) => ({
      id: String(s.id),
      title: s.title,
      level: s.level,
      words: countWords(s.blocks),
      verses: s.blocks.filter((b) => b.t === 'v').length,
    }))
    const isBible = w.collection === 'bible'
    works.push({
      ...w,
      path,
      rel,
      sections,
      pages: planPages(sections, isBible),
      words: sections.reduce((a, s) => a + s.words, 0),
    })
  }
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)
  works.sort(byOrder)
  return { collections, authors, external, works, media: loadMedia(), encyclicals: loadEncyclicals(), audio: loadAudio() }
}

export function loadMedia() {
  const f = (name, key) => {
    const p = join(ROOT, 'media', `${name}.toml`)
    return existsSync(p) ? readToml(p)[key] || [] : []
  }
  // The catalog id is a slug; the YouTube id comes from the watch URL. An entry without one is dropped.
  const videos = f('videos', 'video')
    .map((v) => ({ ...v, slug: v.id, id: ytId(v.url) }))
    .filter((v) => v.id)
  // Image paths become one site path, "/media/...", whether the catalog wrote "public/media/..." or "/media/...".
  const site = (list) => list.map((m) => ({ ...m, file: '/' + m.file.replace(/^\/+/, '').replace(/^public\//, '') }))
  return { images: site(f('images', 'image')), maps: site(f('maps', 'map')), videos, articles: f('articles', 'article') }
}

export function ytId(url) {
  const m = /(?:[?&]v=|youtu\.be\/|\/embed\/)([\w-]{11})(?![\w-])/.exec(url || '')
  return m ? m[1] : null
}

function loadEncyclicals() {
  const p = join(ROOT, 'data', 'encyclicals.toml')
  return existsSync(p) ? readToml(p).encyclical || [] : []
}

// Audio fails closed: only files listed in the manifest are offered.
function loadAudio() {
  const p = join(ROOT, 'audio', 'manifest.json')
  if (!existsSync(p)) return new Map()
  const m = JSON.parse(readFileSync(p, 'utf8'))
  const map = new Map()
  // audio/publish.sh writes {items: [{work, section, url, timing, ...}]} with paths like "audio/<work>/<id>.m4a"
  const abs = (u) => (u && !u.startsWith('/') ? `/${u}` : u)
  for (const e of m.items || []) map.set(`${e.work}/${e.section}`, { ...e, url: abs(e.url), timing: abs(e.timing) })
  return map
}

// Tags look like "bible:genesis:1", "bible:genesis", "work:<id>", "author:<slug>", "collection:<id>", "topic:<slug>".
export function tagIndex(items) {
  const idx = new Map()
  for (const it of items) for (const t of it.tags || []) {
    if (!idx.has(t)) idx.set(t, [])
    idx.get(t).push(it)
  }
  return idx
}
