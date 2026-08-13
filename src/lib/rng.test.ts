import { describe, expect, it } from 'vitest'
import { fillSphere, fillSpiral, mulberry32 } from './rng.ts'

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(17)
    const b = mulberry32(17)
    expect(a()).toBe(b())
    expect(a()).toBe(b())
  })

  it('stays in [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 200; i += 1) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('fillSphere', () => {
  it('writes 3 floats per particle inside the radius', () => {
    const pos = fillSphere(40, 2, 3)
    expect(pos.length).toBe(120)
    for (let i = 0; i < 40; i += 1) {
      const x = pos[i * 3] ?? 0
      const y = pos[i * 3 + 1] ?? 0
      const z = pos[i * 3 + 2] ?? 0
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(2.0001)
    }
  })
})

describe('fillSpiral', () => {
  it('keeps the disk thin on Y', () => {
    const pos = fillSpiral(80, 4, 11, 2)
    expect(pos.length).toBe(240)
    let maxY = 0
    for (let i = 0; i < 80; i += 1) {
      maxY = Math.max(maxY, Math.abs(pos[i * 3 + 1] ?? 0))
    }
    expect(maxY).toBeLessThan(0.2)
  })
})
