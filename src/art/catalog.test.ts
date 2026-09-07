import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARTWORKS, PASSAGE_ARTWORKS, artworkForPassage } from './catalog.ts'
import { CANON_BOOKS } from '../canon/scriptures.ts'
import { POOL } from '../word/pool.ts'

describe('Scripture artwork coverage', () => {
  it('provides a real, distinct SVG for every book', () => {
    expect(ARTWORKS.map(art => art.id)).toEqual(CANON_BOOKS.map(book => book.id))
    const drawings = [...ARTWORKS, ...PASSAGE_ARTWORKS].map(art => readFileSync(resolve('public/art/scripture', art.file), 'utf8'))
    expect(new Set(drawings).size).toBe(78)
    for (const drawing of drawings) {
      expect(drawing).toContain('viewBox="0 0 1600 1000"')
      expect(drawing).not.toMatch(/<(?:script|foreignObject|image|use|animate)\b|\bon\w+=|\bhref=/i)
      expect(drawing.length).toBeLessThan(350000)
    }
  })
  it('uses twelve distinct passage scenes with real rotating references', () => {
    expect(PASSAGE_ARTWORKS).toHaveLength(12)
    for (const art of PASSAGE_ARTWORKS) {
      expect(POOL.some(p => p.ref === art.ref)).toBe(true)
      expect(artworkForPassage(art.ref).id).toBe(art.id)
    }
  })
  it('matches every rotating passage to its book, including numbered letters and Psalms', () => {
    for (const passage of POOL) {
      const expected = passage.ref.replace(/\s+\d+:.*$/, '').replace(/^Psalm$/, 'Psalms')
      expect(artworkForPassage(passage.ref).bookTitle).toBe(expected)
    }
    expect(artworkForPassage('2 Corinthians 4:6').id).toBe('2-corinthians')
  })
})
