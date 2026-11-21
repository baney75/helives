import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fixLen, fixate, inline } from '../lib/html.mjs'

test('focus bold length follows word length', () => {
  assert.equal(fixLen('a'), 1)
  assert.equal(fixLen('the'), 1)
  assert.equal(fixLen('Word'), 2)
  assert.equal(fixLen('light'), 2)
  assert.equal(fixLen('beginning'), 4)
})

test('fixate bolds word starts and never breaks entities', () => {
  assert.equal(fixate('the Word'), '<b>t</b>he <b>Wo</b>rd')
  assert.equal(fixate('salt &amp; light'), '<b>sa</b>lt &amp; <b>li</b>ght')
  assert.equal(fixate('&#39;LORD&#39;'), '&#39;<b>LO</b>RD&#39;')
  assert.equal(fixate("Lord’s"), '<b>Lor</b>d’s')
})

test('inline escapes HTML from the data', () => {
  const out = inline('<script>alert(1)</script> & "x"', { fx: false })
  assert.ok(!out.includes('<script>'))
  assert.ok(out.includes('&lt;script&gt;'))
})

test('inline renders the schema markup and footnote links', () => {
  const out = inline('*A Psalm* of **David**.[^a]', { fx: false, noteHref: (id) => `n-1-${id}` })
  assert.match(out, /<em>A Psalm<\/em>/)
  assert.match(out, /<strong>David<\/strong>/)
  assert.match(out, /<sup class="fn"><a href="#n-1-a" id="r-n-1-a"/)
})

test('focus bold applies inside emphasis but not to markup', () => {
  const out = inline('*In the beginning*', { fx: true })
  assert.equal(out, '<em><b>I</b>n <b>t</b>he <b>begi</b>nning</em>')
})
