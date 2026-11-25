import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { EVIDENCE_GRADES, LIB, ROOT, loadEvidence, loadLibrary, loadMedia, readToml } from '../lib/load.mjs'

const ev = loadEvidence()
const images = new Map(loadMedia().images.map((m) => [m.id, m]))
const exhibits = ev.parts.flatMap((p) => p.exhibits.map((e) => ({ ...e, part: p.id, ungraded: p.ungraded })))
let lib0
const library = () => (lib0 ??= loadLibrary())
const clean = (s) => s.replace(/\[\^\w+\]/g, '').replace(/\*/g, '')

test('every part and exhibit is complete', () => {
  assert.ok(ev.title && ev.lede && ev.description && ev.close.verses.length && ev.parts.length >= 2)
  const seen = new Set()
  for (const p of ev.parts) {
    for (const k of ['id', 'title', 'short', 'intro', 'image']) assert.ok(p[k], `${p.id}: ${k}`)
    assert.match(p.id, /^[a-z-]+$/)
    assert.ok(!seen.has(p.id), `duplicate part ${p.id}`)
    seen.add(p.id)
    assert.ok(p.exhibits.length >= 3, `${p.id}: exhibits`)
    assert.equal(new Set(p.exhibits.map((e) => e.id)).size, p.exhibits.length, `${p.id}: duplicate exhibit id`)
  }
  for (const e of exhibits) {
    for (const k of ['id', 'title', 'when', 'summary', 'shows', 'objection']) assert.ok(e[k]?.length > 3, `${e.part}/${e.id}: ${k}`)
    if (e.ungraded) assert.equal(e.grade, undefined, `${e.part}/${e.id}: grade`)
    else assert.ok(EVIDENCE_GRADES.includes(e.grade), `${e.part}/${e.id}: grade ${e.grade}`)
    assert.ok(e.sources?.length, `${e.part}/${e.id}: sources`)
    for (const [title, url] of e.sources) {
      assert.ok(title, `${e.id}: source title`)
      assert.match(url, /^(https:\/\/[^\s]+|\/(bible|read)\/[\w\-/#]+)$/, `${e.id}: ${url}`)
    }
  }
})

test('our own words have no em or en dashes', () => {
  const all = JSON.stringify(ev)
  assert.ok(!/[–—]/.test(all), all.match(/.{0,40}[–—].{0,40}/)?.[0])
})

test('every picture named is in the catalog and on disk', () => {
  for (const id of [ev.image, ev.close.image, ...ev.parts.map((p) => p.image), ...exhibits.map((e) => e.image).filter(Boolean)]) {
    assert.ok(images.has(id), id)
    assert.ok(existsSync(join(ROOT, 'public', images.get(id).file)), id)
  }
})

test('every verse is the shipped BSB, word for word', () => {
  const dir = join(LIB, 'bible', 'bsb')
  const files = readdirSync(dir).filter((f) => f.endsWith('.toml'))
  for (const v of [ev.verse, ...ev.close.verses, ...ev.parts.map((p) => p.verse)]) {
    const [, slug, ch, n] = /^\/bible\/([\w-]+)\/(\d+)\/#v(\d+)$/.exec(v.href)
    const range = /:(\d+)(?: to (\d+))?$/.exec(v.ref)
    assert.equal(range[1], n, `${v.ref}: href verse`)
    const file = files.find((f) => f.replace(/^\d+-/, '').replace(/\.toml$/, '') === slug)
    const sec = readToml(join(dir, file)).section.find((s) => s.id === ch)
    const text = sec.blocks.filter((b) => b.t === 'v' && b.n >= Number(n) && b.n <= Number(range[2] || n)).map((b) => clean(b.text)).join(' ')
    assert.ok(text.includes(v.text), `${v.ref}: ${text}`)
  }
})

test('the short list leads to exhibits that are there', () => {
  for (const [, u] of ev.short?.items || []) {
    const [, part, id] = /^\/evidence\/([\w-]+)\/#([\w-]+)$/.exec(u)
    assert.ok(exhibits.some((e) => e.part === part && e.id === id), u)
  }
})

test('every link inside the library leads to a page that is there', () => {
  const lib = library()
  const ids = new Set(lib.works.map((w) => w.id))
  for (const e of exhibits) for (const [, u] of e.sources) {
    const [, kind, slug, ch] = /^\/(bible|read)\/([\w-]+)\/(\w+)?/.exec(u) || []
    if (!kind) continue
    const id = kind === 'bible' ? `bsb-${slug}` : slug
    assert.ok(ids.has(id), `${e.id}: ${u}`)
    if (kind === 'bible') assert.ok(lib.works.find((w) => w.id === id).chapters >= Number(ch), `${e.id}: ${u}`)
  }
})

test('every quotation from a hosted work is in that section, word for word', () => {
  const byId = new Map(library().works.map((w) => [w.id, w]))
  for (const e of exhibits.filter((x) => x.quote)) {
    const q = e.quote
    assert.ok(q.text && q.by, `${e.id}: quote`)
    if (!q.work) { assert.match(q.href, /^https:\/\//, `${e.id}: quote href`); continue }
    const w = byId.get(q.work)
    assert.ok(w, `${e.id}: ${q.work}`)
    const sec = readToml(w.path).section.find((s) => String(s.id) === q.sec)
    assert.ok(sec, `${e.id}: ${q.work} ${q.sec}`)
    const text = clean(sec.blocks.map((b) => b.text || '').join(' '))
    for (const piece of q.text.split(' ... ')) assert.ok(text.includes(piece), `${e.id}: ${piece}`)
  }
})
