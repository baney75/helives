import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderSections } from '../lib/render.mjs'

// audio/prep.py anchors a prose block as "b<i>", i being its index in the section's blocks
// (notes and headings count). The page must carry the same index so the player can light it.
test('prose blocks carry data-b="<section>:<block index>" for the audio timing', () => {
  const { html } = renderSections([{ id: 'chapter-1', title: 'Chapter 1', blocks: [
    { t: 'h', text: 'Heading' },
    { t: 'note', id: '1', text: 'a note' },
    { t: 'p', text: 'First paragraph.' },
    { t: 'q', text: 'A line of poetry.' },
    { t: 'bq', text: 'A quotation.' },
  ] }], { fx: false })
  assert.match(html, /<p class="h l2" data-b="chapter-1:0"/)
  assert.match(html, /<p data-b="chapter-1:2">First paragraph\.<\/p>/)
  assert.match(html, /<p class="q i1" data-b="chapter-1:3">/)
  assert.match(html, /<blockquote data-b="chapter-1:4">/)
})

test('verses keep data-v for the audio verse anchors', () => {
  const { html } = renderSections([{ id: '23', title: 'Psalm 23', blocks: [{ t: 'v', n: 1, text: 'The LORD is my shepherd.' }] }], { bible: true, fx: false })
  assert.match(html, /id="v1" data-s="23" data-v="1"/)
})

test('verses of several chapters on one page have unique ids, scoped to their chapter', () => {
  const ch = (n) => ({ id: String(n), title: `Chapter ${n}`, blocks: [{ t: 'v', n: 1, text: 'One.' }, { t: 'v', n: 2, text: 'Two.' }] })
  const { html } = renderSections([ch(1), ch(2)], { fx: false })
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.join(' ')}`)
  assert.match(html, /id="2-v1" data-s="2" data-v="1"/)
})
