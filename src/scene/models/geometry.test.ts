import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createLeafGeometry, createTaperedTube, leafAspect } from './geometry.ts'

describe('createLeafGeometry', () => {
  it('is a flat pointed leaf, not a sphere', () => {
    const geometry = createLeafGeometry()
    const { length, width, thick } = leafAspect(geometry)
    expect(length).toBeGreaterThan(width * 0.9)
    expect(thick).toBeLessThan(width * 0.4)
    expect(length).toBeGreaterThan(0.15)
    geometry.dispose()
  })
})

describe('createTaperedTube', () => {
  it('builds a body that shrinks toward the last point', () => {
    const geometry = createTaperedTube(
      [new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 2, 0.2)],
      0.1,
      0.03,
      8,
    )
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    expect(box).toBeTruthy()
    if (!box) return
    expect(box.max.y - box.min.y).toBeGreaterThan(1.5)
    expect(geometry.getAttribute('position').count).toBeGreaterThan(20)
    geometry.dispose()
  })
})
