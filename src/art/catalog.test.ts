import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARTWORKS, LIBRARY, PASSAGE_ARTWORKS, artworkForPassage, scenesForBook } from './catalog.ts'
import { CANON_BOOKS } from '../canon/scriptures.ts'
import { POOL } from '../word/pool.ts'

describe('Scripture artwork coverage', () => {
  it('keeps a canonical 66-book index and provides ten scenes for every book', () => {
    expect(ARTWORKS.map(art => art.id)).toEqual(CANON_BOOKS.map(book => book.id))
    expect(LIBRARY).toHaveLength(660)
    expect(new Set(LIBRARY.map(art => art.id)).size).toBe(660)
    expect(new Set(LIBRARY.map(art => art.file)).size).toBe(660)
    for (const book of CANON_BOOKS) {
      const scenes = scenesForBook(book.id)
      expect(scenes).toHaveLength(10)
      expect(scenes.every(scene => scene.bookTitle === book.title)).toBe(true)
    }
    expect(LIBRARY.slice(0, 10).every(scene => scene.bookId === 'genesis')).toBe(true)
    expect(LIBRARY[9]?.bookId).toBe('genesis')
    expect(LIBRARY[10]?.bookId).toBe('exodus')
    expect(LIBRARY[659]?.bookId).toBe('revelation')
    const drawings = LIBRARY.map(art => readFileSync(resolve('public/art/scripture', art.file), 'utf8'))
    for (const drawing of drawings) {
      expect(drawing).toContain('viewBox="0 0 1600 1000"')
      expect(drawing).not.toMatch(/<(?:script|foreignObject|image|use|animate)\b|\bon\w+=|\bhref=/i)
      expect(drawing.length).toBeLessThan(350000)
    }
  })
  it('uses twelve distinct passage scenes with real rotating references', () => {
    expect(PASSAGE_ARTWORKS).toHaveLength(12)
    for (const art of PASSAGE_ARTWORKS) {
      const reference = art.ref!
      expect(POOL.some(p => p.ref === reference)).toBe(true)
      expect(artworkForPassage(reference).id).toBe(art.id)
    }
  })
  it('matches every rotating passage to its book, including numbered letters and Psalms', () => {
    for (const passage of POOL) {
      const expected = passage.ref.replace(/\s+\d+:.*$/, '').replace(/^Psalm$/, 'Psalms')
      expect(artworkForPassage(passage.ref).bookTitle).toBe(expected)
    }
    expect(artworkForPassage('2 Corinthians 4:6').id).toBe('2-corinthians')
  })

  it('keeps the first passage view exact, then reaches every scene in its book across visits', () => {
    expect(artworkForPassage('John 8:12').id).toBe('john-world-light')
    const visits = Array.from({ length: 10 }, (_, visit) => artworkForPassage('John 8:12', visit * 48, 42))
    expect(visits).toEqual(Array.from({ length: 10 }, (_, visit) => artworkForPassage('John 8:12', visit * 48, 42)))
    expect(new Set(visits.map(art => art.id)).size).toBe(10)
    expect(visits.every(art => art.bookId === 'john')).toBe(true)
  })
})
