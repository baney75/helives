import { describe, expect, it } from 'vitest'
import { formatCountdown, msUntilNextHour, passageAt, passageIndex, utcHourIndex } from './clock.ts'
import { POOL, POOL_STEP } from './pool.ts'

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x
}

describe('word clock', () => {
  it('keeps a coprime walk so every pool row is used', () => {
    expect(POOL.length).toBeGreaterThan(24)
    expect(gcd(POOL_STEP, POOL.length)).toBe(1)
    const seen = new Set<number>()
    const start = new Date('2026-01-01T00:00:00.000Z')
    for (let h = 0; h < POOL.length; h += 1) {
      const at = new Date(start.getTime() + h * 3_600_000)
      seen.add(passageIndex(at))
    }
    expect(seen.size).toBe(POOL.length)
  })

  it('is stable for a given UTC hour and changes at the next hour', () => {
    const a = new Date('2026-08-15T13:00:00.000Z')
    const b = new Date('2026-08-15T13:59:59.000Z')
    const c = new Date('2026-08-15T14:00:00.000Z')
    expect(utcHourIndex(a)).toBe(utcHourIndex(b))
    expect(passageAt(a).ref).toBe(passageAt(b).ref)
    expect(passageAt(c).ref).not.toBe(passageAt(a).ref)
  })

  it('covers hour 0, hour 23, and a single-row pool', () => {
    expect(passageIndex(new Date('2026-01-01T00:00:00.000Z'))).toBeTypeOf('number')
    expect(passageIndex(new Date('2026-01-01T23:00:00.000Z'))).toBeTypeOf('number')
    expect(passageIndex(new Date('2026-01-01T12:00:00.000Z'), 1, 1)).toBe(0)
  })

  it('rejects a step that cannot visit every row', () => {
    expect(() => passageIndex(new Date('2026-01-01T00:00:00.000Z'), 31, 31)).toThrow(/coprime/)
  })

  it('counts down to the next UTC hour', () => {
    const at = new Date('2026-08-15T13:18:48.000Z')
    expect(msUntilNextHour(at)).toBe((41 * 60 + 12) * 1000)
    expect(formatCountdown((41 * 60 + 12) * 1000)).toBe('41:12')
    expect(formatCountdown(msUntilNextHour(new Date('2026-08-15T14:00:00.000Z')))).toBe('60:00')
  })
})
