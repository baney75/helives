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

/** Gull silhouette with a body and two wings — not a cone. */
export function createBirdGeometry(): BufferGeometry {
  const positions = [
    0.08, 0, 0, -0.12, 0.02, 0, 0.02, 0.04, 0.05, 0.02, 0.04, -0.05, -0.02, 0.02, 0.55, 0.18, 0.16,
    0.18, -0.02, 0.02, -0.55, 0.18, 0.16, -0.18,
  ]
  const idx = [0, 1, 2, 0, 3, 1, 0, 2, 3, 2, 4, 5, 2, 5, 0, 3, 0, 7, 3, 7, 6]
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
