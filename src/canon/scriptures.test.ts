import { describe, expect, it } from 'vitest'
import { CANON, CANON_BOOKS, NEW_TESTAMENT, OLD_TESTAMENT } from './scriptures.ts'

describe('scriptures canon', () => {
  it('names the whole Protestant 66 and ships only Genesis live', () => {
    expect(CANON_BOOKS).toHaveLength(66)
    expect(OLD_TESTAMENT.flatMap((d) => d.books)).toHaveLength(39)
    expect(NEW_TESTAMENT.flatMap((d) => d.books)).toHaveLength(27)

    const live = CANON_BOOKS.filter((book) => book.status === 'live')
    expect(live).toEqual([
      expect.objectContaining({ id: 'genesis', href: '/genesis', status: 'live' }),
    ])

    const titles = CANON_BOOKS.map((book) => book.title)
    expect(new Set(titles).size).toBe(66)
    expect(titles).toContain('Leviticus')
    expect(titles).toContain('1 Chronicles')
    expect(titles).toContain('2 Chronicles')
    expect(titles).toContain('Obadiah')
    expect(titles).toContain('Nahum')
    expect(titles).toContain('Habakkuk')
    expect(titles).toContain('Haggai')
    expect(titles).toContain('Zechariah')
    expect(titles).toContain('Malachi')
    expect(titles).toContain('Philemon')
    expect(titles).toContain('Jude')
    expect(titles).toContain('Revelation')

    const forthcoming = CANON_BOOKS.filter((book) => book.status === 'forthcoming')
    expect(forthcoming).toHaveLength(65)
    expect(forthcoming.every((book) => book.href === null)).toBe(true)
  })

  it('keeps law and genealogies as Scripture, not jokes', () => {
    const notes = CANON.flatMap((division) => division.books)
      .map((book) => book.note)
      .filter((note): note is string => Boolean(note))
      .join(' ')
      .toLowerCase()
    expect(notes).toContain('holiness')
    expect(notes).toContain('genealogies')
    expect(notes).not.toMatch(/boring|skip|filler|joke/)
  })
})
