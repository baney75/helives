import { describe, expect, it } from 'vitest'
import { parsePath } from '../canon/catalog.ts'
import { pageFor } from './router.ts'

describe('pageFor', () => {
  it('maps live surfaces only', () => {
    expect(pageFor(parsePath('/'))).toBe('home')
    expect(pageFor(parsePath('/faith'))).toBe('faith')
    expect(pageFor(parsePath('/genesis'))).toBe('genesis')
    expect(pageFor(parsePath('/genesis/afterword'))).toBe('afterword')
    expect(pageFor(parsePath('/exodus'))).toBe('not-found')
    expect(pageFor(parsePath('/genesis/1'))).toBe('not-found')
  })
})
