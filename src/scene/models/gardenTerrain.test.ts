import { describe, expect, it } from 'vitest'
import { EDEN } from './eden.ts'
import { createPlantedIsland, createPlantedMeadow } from './gardenTerrain.ts'

describe('planted garden ground', () => {
  it('is an irregular island with a river cut, not a flat disk', () => {
    const island = createPlantedIsland()
    const meadow = createPlantedMeadow()
    island.computeBoundingBox()
    meadow.computeBoundingBox()
    const isle = island.boundingBox
    const bed = meadow.boundingBox
    expect(isle).toBeTruthy()
    expect(bed).toBeTruthy()
    if (!isle || !bed) return
    expect(isle.max.x - isle.min.x).toBeGreaterThan(7)
    expect(isle.max.y - isle.min.y).toBeGreaterThan(5)
    expect(bed.max.z - bed.min.z).toBeGreaterThan(0.08)
    expect(meadow.getAttribute('position').count).toBeGreaterThan(60)
    expect(EDEN.groundRadius).toBeGreaterThan(4)
    island.dispose()
    meadow.dispose()
  })
})
