import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { GRADES, LIB, loadMiracles, readToml } from '../lib/load.mjs'

const m = loadMiracles()
const DASH = /[–—]/

test('the miracles page has Scripture tests, groups and cases', () => {
  assert.ok(m, 'data/miracles.toml loads')
  assert.ok(m.intro && m.tests.length >= 3 && m.groups.length >= 3 && m.cases.length >= 8)
  for (const t of m.tests) assert.match(t.href, /^\/bible\/[\w-]+\/\d+\/#v\d+$/, t.ref)
})

test('every case has a grade, a kind, an objection and an https source', () => {
  const groups = new Set(m.groups.map((g) => g.id))
  const ids = new Set()
  for (const c of m.cases) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`)
    ids.add(c.id)
    assert.ok(GRADES.includes(c.grade), `${c.id}: grade ${c.grade}`)
    assert.ok(['good', 'evil', 'study'].includes(c.kind), `${c.id}: kind ${c.kind}`)
    assert.ok(groups.has(c.group), `${c.id}: group ${c.group}`)
    for (const k of ['title', 'when', 'where', 'summary', 'evidence', 'objection']) assert.ok(c[k] && c[k].length > 3, `${c.id}: ${k}`)
    assert.ok(c.sources.length >= 1, `${c.id}: sources`)
    for (const [title, url] of c.sources) {
      assert.ok(title, `${c.id}: source title`)
      assert.match(url, /^https:\/\/[^\s]+$/, `${c.id}: ${url}`)
    }
  }
})

test('the page text has no em or en dashes', () => {
  const all = JSON.stringify(m)
  assert.ok(!DASH.test(all), all.match(new RegExp(`.{0,40}${DASH.source}.{0,40}`))?.[0])
})

test('the record covers both good and evil and admits the null studies', () => {
  const kinds = new Set(m.cases.map((c) => c.kind))
  assert.ok(kinds.has('good') && kinds.has('evil') && kinds.has('study'))
  assert.ok(m.cases.some((c) => c.grade === 'negative'), 'a study that found no effect is shown')
})

test('every Scripture test quotes the shipped BSB word for word', () => {
  const dir = join(LIB, 'bible', 'bsb')
  const files = readdirSync(dir).filter((f) => f.endsWith('.toml'))
  for (const t of m.tests) {
    const [, slug, ch, v] = /^\/bible\/([\w-]+)\/(\d+)\/#v(\d+)$/.exec(t.href)
    const range = /:(\d+)(?: to (\d+))?$/.exec(t.ref)
    assert.equal(range[1], v, `${t.ref}: href verse`)
    const last = Number(range[2] || range[1])
    const file = files.find((f) => f.replace(/^\d+-/, '').replace(/\.toml$/, '') === slug)
    assert.ok(file, `${t.ref}: no BSB file for ${slug}`)
    const sec = readToml(join(dir, file)).section.find((s) => s.id === ch)
    const text = sec.blocks
      .filter((b) => b.t === 'v' && b.n >= Number(v) && b.n <= last)
      .map((b) => b.text.replace(/\[\^\w+\]/g, ''))
      .join(' ')
    assert.equal(t.text, text, t.ref)
  }
})
