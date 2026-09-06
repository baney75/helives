import { BufferGeometry, Float32BufferAttribute } from 'three'
import { riverDistance } from './eden.ts'

/** A low, irregular planted bank; riverbed stays below the water ribbon. */
export function createPlantedIsland(): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const rings = 18, segments = 96
  for (let ring = 0; ring <= rings; ring += 1) {
    const r = ring / rings
    for (let j = 0; j <= segments; j += 1) {
      const angle = j / segments * Math.PI * 2
      const edge = 1 + Math.sin(angle * 3 + 0.5) * 0.065 + Math.sin(angle * 7) * 0.025
      const x = Math.cos(angle) * 4.12 * r * edge - 0.08
      const z = Math.sin(angle) * 3.45 * r * edge
      const river = riverDistance(x, z)
      const rise = Math.min(1, Math.max(0, (river - 0.20) / 0.45))
      const relief = (0.055 + Math.sin(x * 2.4 + z) * 0.018 + Math.sin(z * 3.1 - x) * 0.022) * rise
      const rim = Math.max(0, (r - 0.9) / 0.1)
      positions.push(x, z, -relief + rim * rim * 0.13)
    }
  }
  for (let i = 0; i < rings; i += 1) for (let j = 0; j < segments; j += 1) {
    const a = i * (segments + 1) + j, b = a + segments + 1
    indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
  const surfaceCount = indices.length
  const base = positions.length / 3
  for (let j = 0; j <= segments; j += 1) {
    const offset = (rings * (segments + 1) + j) * 3
    positions.push(positions[offset]! * 0.98, positions[offset + 1]! * 0.98, 0.27 + Math.sin(j * 0.7) * 0.025)
    if (j < segments) {
      const a = rings * (segments + 1) + j, b = base + j
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.addGroup(0, surfaceCount, 0)
  geometry.addGroup(surfaceCount, indices.length - surfaceCount, 1)
  geometry.computeVertexNormals()
  return geometry
}
