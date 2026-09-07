import { describe, expect, it } from 'vitest'
import { rotatedPassage } from './rotation.ts'
import { POOL } from './pool.ts'
import { passageAt } from './clock.ts'

describe('reading sequence', () => {
  const start = new Date('2026-09-07T16:30:00Z')
  it('begins with the established daily selection and visits every passage before repeating', () => {
    expect(rotatedPassage(start, 0)).toBe(passageAt(start))
    expect(new Set(POOL.map((_, i) => rotatedPassage(start, i))).size).toBe(POOL.length)
    expect(rotatedPassage(start, POOL.length)).toBe(rotatedPassage(start, 0))
  })
  it('supports previous and long-running sessions without leaving the pool', () => {
    expect(rotatedPassage(start, -1)).toBe(rotatedPassage(start, POOL.length - 1))
    expect(POOL).toContain(rotatedPassage(start, 1000000))
  })
})
