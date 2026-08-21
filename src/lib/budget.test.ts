import { describe, expect, it } from 'vitest'
import { BUDGET, DPR } from './budget.ts'

describe('BUDGET', () => {
  it('keeps medium below high particle caps', () => {
    expect(BUDGET.medium.void).toBeLessThan(BUDGET.high.void)
    expect(BUDGET.medium.light).toBeLessThan(BUDGET.high.light)
    expect(BUDGET.medium.earth).toBeLessThan(BUDGET.high.earth)
    expect(BUDGET.medium.stars).toBeLessThan(BUDGET.high.stars)
    expect(BUDGET.medium.spiral).toBeLessThan(BUDGET.high.spiral)
    expect(BUDGET.medium.fish).toBeLessThan(BUDGET.high.fish)
  })

  it('keeps high desktop counts explicit', () => {
    expect(BUDGET.high.void).toBe(720)
    expect(BUDGET.high.light).toBe(2800)
    expect(BUDGET.high.earth).toBe(520)
    expect(BUDGET.high.stars).toBe(3200)
    expect(BUDGET.high.spiral).toBe(5200)
  })

  it('keeps low below medium', () => {
    const keys = Object.keys(BUDGET.low) as Array<keyof typeof BUDGET.low>
    for (const key of keys) {
      expect(BUDGET.low[key]).toBeLessThan(BUDGET.medium[key])
    }
  })

  it('raises DPR only on richer tiers', () => {
    expect(DPR.low).toEqual([1, 1])
    expect(DPR.medium).toEqual([1, 1.25])
    expect(DPR.high).toEqual([1, 2])
  })
})
