import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertClean, chunkStatements } from '../lib/search-chunks.mjs'

test('chunks keep every statement once, in order, with setup first and optimize last', () => {
  const stmts = Array.from({ length: 50 }, (_, i) => `INSERT ${i} ${'x'.repeat(100)};`)
  const chunks = chunkStatements(['DROP;', 'CREATE;'], stmts, ['OPTIMIZE;'], 1000)
  assert.equal(chunks[0], 'DROP;\nCREATE;\n')
  assert.equal(chunks.at(-1), 'OPTIMIZE;\n')
  const body = chunks.slice(1, -1)
  assert.ok(body.length > 5, 'a small limit must split the inserts')
  for (const c of body) assert.ok(c.length <= 1000 + 120, `chunk of ${c.length} bytes`)
  assert.deepEqual(body.join('').trim().split('\n'), stmts)
})

test('a row with a control character stops the index', () => {
  assert.doesNotThrow(() => assertClean(["('Genesis 1:1','In the beginning','/bible/genesis/1/#v1')"]))
  assert.throws(() => assertClean(["('Song IX. \u0000Footnote_I_9\u0000 Invocation','text')"]), /control character/)
})
