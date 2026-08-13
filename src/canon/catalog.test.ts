import { describe, expect, it } from 'vitest'
import { getBook, LIVE_BOOKS, parseBookRest, parsePath } from './catalog.ts'

describe('catalog', () => {
  it('ships only Genesis as live', () => {
    expect(LIVE_BOOKS.map((book) => book.slug)).toEqual(['genesis'])
    expect(getBook('genesis')?.status).toBe('live')
  })
})

describe('parsePath', () => {
  it('routes the site surfaces', () => {
    expect(parsePath('/')).toEqual({ kind: 'home' })
    expect(parsePath('/faith')).toEqual({ kind: 'faith' })
    expect(parsePath('/genesis')).toEqual({ kind: 'book', slug: 'genesis' })
    expect(parsePath('/genesis/afterword')).toEqual({ kind: 'afterword', slug: 'genesis' })
    expect(parsePath('/genesis/')).toEqual({ kind: 'book', slug: 'genesis' })
  })

  it('does not invent unread books', () => {
    expect(parsePath('/exodus')).toEqual({ kind: 'not-found' })
    expect(parsePath('/revelation')).toEqual({ kind: 'not-found' })
    expect(parsePath('/genesis/chapter/1')).toEqual({ kind: 'not-found' })
    expect(parsePath('/genesis/1')).toEqual({ kind: 'not-found' })
  })
})

describe('parseBookRest', () => {
  it('keeps a reading-book chapter path ready without shipping Exodus', () => {
    const reading = {
      slug: 'genesis' as const,
      title: 'Genesis',
      testament: 'old' as const,
      kind: 'reading' as const,
      status: 'live' as const,
      href: '/genesis',
      summary: 'test',
      hasAfterword: false,
    }
    expect(parseBookRest(reading, ['3'])).toEqual({
      kind: 'chapter',
      slug: 'genesis',
      chapter: 3,
    })
  })
})
