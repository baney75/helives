import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three'
import { GARDEN_BEDS, riverDistance, type Vec3 } from './eden.ts'

/** A low, irregular planted bank; riverbed stays below the water ribbon. */
export function createPlantedIsland(): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const rings = 22, segments = 112
  for (let ring = 0; ring <= rings; ring += 1) {
    const r = ring / rings
    for (let j = 0; j <= segments; j += 1) {
      const angle = j / segments * Math.PI * 2
      const edge = 1 + Math.sin(angle * 3 + 0.5) * 0.065 + Math.sin(angle * 7) * 0.025
      // The planted ground extends past the camera framing. It remains irregular,
      // but no longer reads as a floating dinner plate against the void.
      const x = Math.cos(angle) * 5.95 * r * edge - 0.08
      const z = Math.sin(angle) * 4.85 * r * edge
      const river = riverDistance(x, z)
      const rise = Math.min(1, Math.max(0, (river - 0.20) / 0.45))
      const relief = (0.11 + Math.sin(x * 2.4 + z) * 0.045 + Math.sin(z * 3.1 - x) * 0.05) * rise
      const rim = Math.max(0, (r - 0.9) / 0.1)
      positions.push(x, z, -relief + rim * rim * 0.22)
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
    positions.push(positions[offset]! * 0.975, positions[offset + 1]! * 0.975, 0.42 + Math.sin(j * 0.7) * 0.045)
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

/** Raised cultivated beds make Eden read as a planted place, not a grass disk. */
export function createGardenBedGeometry(): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const rings = 5
  const segments = 28
  for (const [bedIndex, bed] of GARDEN_BEDS.entries()) {
    const base = positions.length / 3
    const cos = Math.cos(bed.turn), sin = Math.sin(bed.turn)
    for (let ring = 0; ring <= rings; ring += 1) {
      const radius = ring / rings
      for (let segment = 0; segment <= segments; segment += 1) {
        const angle = segment / segments * Math.PI * 2
        const irregular = 1 + Math.sin(angle * 3 + bedIndex) * 0.035
        const localX = Math.cos(angle) * bed.radius[0] * radius * irregular
        const localZ = Math.sin(angle) * bed.radius[1] * radius * irregular
        const x = bed.center[0] + localX * cos - localZ * sin
        const z = bed.center[1] + localX * sin + localZ * cos
        const crown = Math.pow(Math.max(0, 1 - radius), 0.72)
        positions.push(x, 0.008 + crown * 0.105, z)
      }
    }
    for (let ring = 0; ring < rings; ring += 1) for (let segment = 0; segment < segments; segment += 1) {
      const a = base + ring * (segments + 1) + segment
      const b = a + segments + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A modeled distant ridge closes the garden while preserving the night void above it. */
export function createGardenRidgeGeometry(seed = 0): BufferGeometry {
  const segments = 44
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const x = -7.8 + t * 15.6
    const crown = 0.48 + Math.sin(t * Math.PI * 5 + seed) * 0.18 + Math.sin(t * Math.PI * 11 + 0.7) * 0.08
    positions.push(x, -0.12, -3.88, x, crown, -4.72, x, -0.18, -5.52)
    if (i < segments) {
      const a = i * 3
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4)
      indices.push(a + 1, a + 4, a + 2, a + 2, a + 4, a + 5)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Small reflection facets whose front faces intentionally point toward the garden camera. */
export function createRiverGlintGeometry(points: readonly Vec3[], warm = false): BufferGeometry {
  const path = new CatmullRomCurve3(points.map((point) => new Vector3(...point)))
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index < 15; index += 1) {
    const t = 0.08 + index / 15 * 0.86
    const point = path.getPoint(t)
    const tangent = path.getTangent(t).normalize()
    const lateral = new Vector3(-tangent.z, 0, tangent.x).normalize()
    const length = 0.07 + (index % 4) * 0.035
    const width = 0.012 + (index % 3) * 0.006
    const offset = ((index * 7 + (warm ? 3 : 0)) % 9 - 4) * 0.027
    const center = point.clone().addScaledVector(lateral, offset)
    const a = center.clone().addScaledVector(tangent, -length).addScaledVector(lateral, -width)
    const b = center.clone().addScaledVector(tangent, length).addScaledVector(lateral, -width)
    const c = center.clone().addScaledVector(tangent, length).addScaledVector(lateral, width)
    const d = center.clone().addScaledVector(tangent, -length).addScaledVector(lateral, width)
    const base = positions.length / 3
    for (const vertex of [a, b, c, d]) positions.push(vertex.x, vertex.y + (warm ? 0.029 : 0.027), vertex.z)
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
  }
  const glints = new BufferGeometry()
  glints.setAttribute('position', new Float32BufferAttribute(positions, 3))
  glints.setIndex(indices)
  glints.computeVertexNormals()
  return glints
}
