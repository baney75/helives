import { BufferGeometry, Float32BufferAttribute } from 'three'

/** Elongated fish with a forked tail — not a sphere. */
export function createFishGeometry(): BufferGeometry {
  const positions = [
    0.55, 0, 0, 0.22, 0.12, 0.08, 0.22, 0.12, -0.08, 0.22, -0.1, 0.07, 0.22, -0.1, -0.07, -0.2,
    0.16, 0.06, -0.2, 0.16, -0.06, -0.2, -0.12, 0.05, -0.2, -0.12, -0.05, -0.42, 0.04, 0, -0.62,
    0.2, 0, -0.62, -0.18, 0,
  ]
  const idx = [
    0, 1, 2, 0, 2, 4, 0, 4, 3, 0, 3, 1, 1, 5, 2, 2, 5, 6, 3, 4, 8, 3, 8, 7, 1, 3, 7, 1, 7, 5, 2,
    6, 8, 2, 8, 4, 5, 7, 9, 6, 5, 9, 7, 8, 9, 6, 9, 8, 9, 10, 11,
  ]
  return mesh(positions, idx)
}

/** Gull with a head, breast, tail, and two wings — not a paper plane. */
export function createBirdGeometry(): BufferGeometry {
  const positions = [
    0.34, 0.05, 0, 0.22, 0.07, 0.03, 0.22, 0.07, -0.03, 0.04, 0.09, 0.05, 0.04, 0.09, -0.05, 0.06,
    -0.03, 0.04, 0.06, -0.03, -0.04, -0.22, 0.06, 0.03, -0.22, 0.06, -0.03, -0.38, 0.1, 0.07, -0.38,
    0.1, -0.07, 0.06, 0.14, 0.28, 0.02, 0.1, 0.55, 0.06, 0.14, -0.28, 0.02, 0.1, -0.55,
  ]
  const idx = [
    0, 1, 2, 1, 3, 2, 1, 5, 3, 2, 4, 6, 3, 5, 7, 4, 8, 6, 5, 6, 8, 5, 8, 7, 7, 9, 8, 8, 10, 7, 3, 11,
    1, 3, 12, 11, 4, 2, 13, 4, 13, 14,
  ]
  return mesh(positions, idx)
}

export function fishAspect(geometry: BufferGeometry): { length: number; height: number } {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return { length: 0, height: 0 }
  return { length: box.max.x - box.min.x, height: box.max.y - box.min.y }
}

export function birdWingspan(geometry: BufferGeometry): { span: number; length: number } {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return { span: 0, length: 0 }
  return { span: box.max.z - box.min.z, length: box.max.x - box.min.x }
}

function mesh(positions: number[], index: number[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}
