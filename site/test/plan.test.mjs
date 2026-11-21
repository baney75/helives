import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHUNK, PAGE_WORDS, planPages } from '../lib/load.mjs'
import { pageLabel } from '../lib/render.mjs'

const sec = (id, level, words, title = id) => ({ id, title, level, words })

function covers(sections, pages) {
  let at = 0
  for (const p of pages) {
    assert.equal(p.from, at, 'pages are contiguous and in order')
    assert.ok(p.to > p.from, 'no empty page')
    at = p.to
  }
  assert.equal(at, sections.length, 'every section is on a page')
}

test('a short work is one whole page', () => {
  const s = [sec('a', 1, 3000), sec('b', 1, 4000)]
  assert.deepEqual(planPages(s, false), [{ id: '', from: 0, to: 2, whole: true }])
})

test('the Bible is one page per chapter', () => {
  const s = [sec('1', 1, 800), sec('2', 1, 900)]
  assert.equal(planPages(s, true).length, 2)
})

test('small chapters share pages up to the chunk size', () => {
  const s = Array.from({ length: 60 }, (_, i) => sec(`c${i}`, 1, 300, `Chapter ${i + 1}`))
  const pages = planPages(s, false)
  covers(s, pages)
  for (const p of pages) assert.ok(p.words <= CHUNK)
  assert.ok(pages.length <= 3, `expected few pages, got ${pages.length}`)
})

test('a large book starts its own pages and never shares one with the next book', () => {
  const book = (b) => [sec(`b${b}`, 1, 50, `Book ${b}`), ...Array.from({ length: 30 }, (_, i) => sec(`b${b}c${i}`, 2, 600, `Chapter ${i + 1}`))]
  const s = [...book(1), ...book(2)]
  const pages = planPages(s, false)
  covers(s, pages)
  const startsBook2 = pages.find((p) => s[p.from].id === 'b2')
  assert.ok(startsBook2, 'book 2 begins a page')
  for (const p of pages) {
    const ids = s.slice(p.from, p.to).map((x) => x.id)
    assert.ok(!(ids.some((i) => i.startsWith('b1')) && ids.some((i) => i.startsWith('b2'))), 'no page spans two books')
  }
})

test('an oversized single section still gets a page', () => {
  const s = [sec('a', 1, PAGE_WORDS * 2), sec('b', 1, 100)]
  const pages = planPages(s, false)
  covers(s, pages)
})

test('page labels name a range of numbered chapters', () => {
  const s = Array.from({ length: 40 }, (_, i) => sec(`c${i}`, 1, 400, `Chapter ${['I', 'II', 'III'][i] || i + 1}.—Of things`))
  const w = { title: 'T', sections: s, pages: planPages(s, false) }
  assert.equal(pageLabel(w, w.pages[0]), 'Chapters I to 22')
})
