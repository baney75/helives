import { describe, expect, it } from 'vitest'
import { EDEN } from './eden.ts'
import { createPlantedIsland } from './gardenTerrain.ts'

describe('planted garden ground', () => {
  it('is an irregular island, not a flat disk', () => {
    const island = createPlantedIsland()
    island.computeBoundingBox()
    const isle = island.boundingBox
    expect(isle).toBeTruthy()
    if (!isle) return
    expect(isle.max.x - isle.min.x).toBeGreaterThan(7)
    expect(isle.max.y - isle.min.y).toBeGreaterThan(5)
    expect(isle.max.x + isle.min.x).not.toBeCloseTo(0, 1)
    expect(EDEN.river.points.length).toBeGreaterThanOrEqual(6)
    island.dispose()
  })
})
