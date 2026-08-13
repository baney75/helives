import { describe, expect, it } from 'vitest'
import { parsePath } from '../canon/catalog.ts'
import { pageFor, titleFor } from './router.ts'

describe('pageFor', () => {
  it('maps live surfaces only', () => {
    expect(pageFor(parsePath('/'))).toBe('home')
    expect(pageFor(parsePath('/faith'))).toBe('faith')
    expect(pageFor(parsePath('/scriptures'))).toBe('scriptures')
    expect(pageFor(parsePath('/genesis'))).toBe('genesis')
    expect(pageFor(parsePath('/genesis/afterword'))).toBe('afterword')
    expect(pageFor(parsePath('/exodus'))).toBe('not-found')
    expect(pageFor(parsePath('/genesis/1'))).toBe('not-found')
  })
})

describe('titleFor', () => {
  it('keeps He Lives on every surface', () => {
    expect(titleFor('home')).toBe('He Lives')
    expect(titleFor('scriptures')).toBe('The Scriptures — He Lives')
    expect(titleFor('genesis')).toBe('Genesis — He Lives')
    expect(titleFor('faith')).toBe('Faith — He Lives')
    expect(titleFor('afterword')).toBe('Got doubt? — He Lives')
  })
})
