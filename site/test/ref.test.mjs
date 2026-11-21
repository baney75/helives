import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRef, refAction } from '../assets/ref.js'

const books = [
  { s: 'genesis', t: 'Genesis', a: 'Gen', c: 50 },
  { s: 'psalms', t: 'Psalms', a: 'Ps', c: 150 },
  { s: 'song-of-solomon', t: 'Song of Solomon', a: 'Song', c: 8 },
  { s: 'john', t: 'John', a: 'John', c: 21 },
  { s: '1-corinthians', t: '1 Corinthians', a: '1Cor', c: 16 },
  { s: '1-john', t: '1 John', a: '1John', c: 5 },
  { s: 'revelation', t: 'Revelation', a: 'Rev', c: 22 },
]

test('references go to the chapter and verse', () => {
  assert.equal(parseRef('John 3:16', books), '/bible/john/3/#v16')
  assert.equal(parseRef('jn 3', books), '/bible/john/3/')
  assert.equal(parseRef('1 Cor 13:4-7', books), '/bible/1-corinthians/13/#v4')
  assert.equal(parseRef('1 john 4:8', books), '/bible/1-john/4/#v8')
  assert.equal(parseRef('Psalm 23', books), '/bible/psalms/23/')
  assert.equal(parseRef('song 2', books), '/bible/song-of-solomon/2/')
  assert.equal(parseRef('Revelations 21', books), '/bible/revelation/21/')
  assert.equal(parseRef('Genesis', books), '/bible/genesis/')
})

test('words that are not references stay searches', () => {
  assert.equal(parseRef('grace', books), null)
  assert.equal(parseRef('love your enemies', books), null)
  assert.equal(parseRef('John 99', books), null)
  assert.equal(parseRef('Augustine 4', books), null)
})

test('a bare book name searches and offers the book; a reference opens it', () => {
  assert.deepEqual(refAction('John', books), { search: true, book: '/bible/john/' })
  assert.deepEqual(refAction('John 3:16', books), { go: '/bible/john/3/#v16' })
  assert.deepEqual(refAction('ps 23', books), { go: '/bible/psalms/23/' })
  assert.deepEqual(refAction('grace', books), { search: true })
})
