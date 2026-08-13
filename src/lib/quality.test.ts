import { describe, expect, it } from 'vitest'
import { DPR } from './budget.ts'
import {
  chooseTier,
  hashUa,
  HIGH_FRAME_MS,
  makeQualityRecord,
  MAX_AGE_MS,
  MEDIUM_FRAME_MS,
  parseQualityRecord,
  percentile,
  qualityFromSearch,
  readReusableQuality,
  shouldReuse,
} from './quality.ts'

function times(ms: number, count: number): number[] {
  return Array.from({ length: count }, () => ms)
}

describe('chooseTier', () => {
  it('picks high when p90 stays at or under 18ms', () => {
    expect(chooseTier(times(16, 24))).toBe('high')
    expect(chooseTier(times(HIGH_FRAME_MS, 24))).toBe('high')
  })

  it('picks medium when p90 is between 18ms and 30fps', () => {
    expect(chooseTier(times(22, 24))).toBe('medium')
    expect(chooseTier(times(MEDIUM_FRAME_MS, 24))).toBe('medium')
  })

  it('picks low when p90 is slower than 30fps', () => {
    expect(chooseTier(times(40, 24))).toBe('low')
    expect(chooseTier(times(MEDIUM_FRAME_MS + 0.1, 24))).toBe('low')
  })

  it('fails closed on empty samples', () => {
    expect(chooseTier([])).toBe('low')
  })

  it('uses p90 rather than the best frame', () => {
    const fast = times(16, 17)
    const slow = times(80, 3)
    expect(chooseTier([...fast, ...slow])).toBe('low')
  })

  it('ignores a single spike when p90 stays fast', () => {
    expect(chooseTier([...times(16, 19), 80])).toBe('high')
  })
})

describe('percentile', () => {
  it('returns infinity for an empty list', () => {
    expect(percentile([], 90)).toBe(Number.POSITIVE_INFINITY)
  })

  it('returns the only sample at any percentile', () => {
    expect(percentile([12], 90)).toBe(12)
  })
})

describe('qualityFromSearch', () => {
  it('reads a valid quality override', () => {
    expect(qualityFromSearch('?quality=low')).toBe('low')
    expect(qualityFromSearch('?cinematic=1&quality=high')).toBe('high')
    expect(qualityFromSearch('?quality=medium')).toBe('medium')
  })

  it('ignores missing or invalid values', () => {
    expect(qualityFromSearch('')).toBeNull()
    expect(qualityFromSearch('?quality=ultra')).toBeNull()
    expect(qualityFromSearch('?mode=cinematic')).toBeNull()
  })
})

describe('quality persistence', () => {
  const ua = 'Mozilla/5.0 OriginTest'
  const now = 1_700_000_000_000

  it('round-trips a record', () => {
    const record = makeQualityRecord('high', now, ua)
    expect(record.dpr).toBe(DPR.high[1])
    expect(parseQualityRecord(JSON.stringify(record))).toEqual(record)
  })

  it('rejects malformed storage', () => {
    expect(parseQualityRecord('not-json')).toBeNull()
    expect(parseQualityRecord('{}')).toBeNull()
    expect(parseQualityRecord('{"tier":"ultra","dpr":1,"ts":1,"uaHash":"a"}')).toBeNull()
  })

  it('reuses a recent medium or high result for the same UA', () => {
    const record = makeQualityRecord('medium', now, ua)
    expect(shouldReuse(record, now + 86_400_000, hashUa(ua))).toBe(true)
    expect(shouldReuse(makeQualityRecord('high', now, ua), now + 1000, hashUa(ua))).toBe(
      true,
    )
  })

  it('re-benches a poor result, a stale result, or a new device', () => {
    const low = makeQualityRecord('low', now, ua)
    expect(shouldReuse(low, now + 1000, hashUa(ua))).toBe(false)
    const medium = makeQualityRecord('medium', now, ua)
    expect(shouldReuse(medium, now + MAX_AGE_MS + 1, hashUa(ua))).toBe(false)
    expect(shouldReuse(medium, now + 1000, hashUa('other-ua'))).toBe(false)
  })

  it('readReusableQuality applies the reuse rules', () => {
    const record = makeQualityRecord('medium', now, ua)
    const raw = JSON.stringify(record)
    expect(readReusableQuality(raw, now + 1000, hashUa(ua))?.tier).toBe('medium')
    expect(readReusableQuality(raw, now + 1000, hashUa('other'))).toBeNull()
    expect(readReusableQuality(null, now, hashUa(ua))).toBeNull()
  })
})
