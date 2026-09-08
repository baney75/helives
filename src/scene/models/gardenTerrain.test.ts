import { describe, expect, it } from 'vitest'
import { EDEN } from './eden.ts'
import { createPlantedIsland, createRiverGlintGeometry } from './gardenTerrain.ts'

describe('planted garden ground', () => {
  it('is an irregular island, not a flat disk', () => {
    const island = createPlantedIsland()
    island.computeBoundingBox()
    const isle = island.boundingBox
    expect(isle).toBeTruthy()
    if (!isle) return
    expect(isle.max.x - isle.min.x).toBeGreaterThan(7)
    expect(isle.max.y - isle.min.y).toBeGreaterThan(5)
    expect(isle.max.z - isle.min.z).toBeGreaterThan(0.25)
    expect(EDEN.river.points.length).toBeGreaterThanOrEqual(6)
    island.dispose()
  })
})

describe('river reflection facets', () => {
  it('keeps finite upward-facing glints for the overhead garden view', () => {
    const glints = createRiverGlintGeometry(EDEN.river.points)
    const positions = glints.getAttribute('position')
    const normals = glints.getAttribute('normal')
    expect(positions.count).toBeGreaterThan(0)
    for (let index = 0; index < positions.count; index += 1) {
      expect(Number.isFinite(positions.getX(index))).toBe(true)
      expect(Number.isFinite(positions.getY(index))).toBe(true)
      expect(Number.isFinite(positions.getZ(index))).toBe(true)
      expect(normals.getY(index)).toBeGreaterThan(0.9)
    }
    glints.dispose()
  })
})
