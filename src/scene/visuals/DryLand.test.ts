import { describe, expect, it } from 'vitest'
import { createCoastalTerrainGeometry } from './DryLand.tsx'

describe('coastal terrain', () => {
  it.each([32, 52, 72])('faces upward at %i segments so the shore is visible from above', (segments) => {
    const geometry = createCoastalTerrainGeometry(segments)
    try {
      const normal = geometry.getAttribute('normal')
      const position = geometry.getAttribute('position')
      for (let index = 0; index < normal.count; index += 1) {
        expect(normal.getY(index)).toBeGreaterThan(0)
        expect(Number.isFinite(position.getY(index))).toBe(true)
      }
    } finally {
      geometry.dispose()
    }
  })
})
