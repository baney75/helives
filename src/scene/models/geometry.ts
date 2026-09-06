import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three'

/** Flat pointed leaf in XY. Thickness is on Z so a canopy of these reads as foliage, not balls. */
export function createLeafGeometry(): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const colors: number[] = []
  const rows = 12
  for (let i = 0; i <= rows; i += 1) {
    const t = i / rows
    const width = Math.pow(Math.sin(t * Math.PI), 0.9) * 0.055
    for (let side = -1; side <= 1; side += 1) {
      positions.push(side * width, t * 0.265 - 0.125, Math.sin(t * Math.PI) * 0.008 + Math.abs(side) * 0.010 + t * t * 0.008)
      const tint = side === 0 ? 0.93 : 0.72 + Math.sin(t * Math.PI) * 0.14
      colors.push(tint, tint, tint * 0.86)
    }
  }
  for (let i = 0; i < rows; i += 1) for (let j = 0; j < 2; j += 1) {
    const a = i * 3 + j
    indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3)
  }
  const leaf = mesh(positions, indices)
  leaf.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return leaf
}

/** A radial rosette, authored once and instanced across the meadow. */
export function createPlantGeometry(): BufferGeometry {
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const leaf = createLeafGeometry()
    leaf.translate(0, 0.125, 0)
    leaf.scale(0.72, 0.75 + (i % 3) * 0.18, 1)
    leaf.rotateZ(0.45 + (i % 3) * 0.25)
    leaf.rotateY(i * 2.39996)
    leaf.translate(0, 0.015, 0)
    return leaf
  })
  const plant = mergeGeometries(leaves)
  leaves.forEach((leaf) => leaf.dispose())
  return plant
}

export function leafAspect(geometry: BufferGeometry): { length: number; width: number; thick: number } {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return { length: 0, width: 0, thick: 0 }
  return {
    length: box.max.y - box.min.y,
    width: box.max.x - box.min.x,
    thick: box.max.z - box.min.z,
  }
}

/** Serpent body: radius shrinks toward the head. */
export function createTaperedTube(
  points: readonly Vector3[],
  startRadius: number,
  endRadius: number,
  radial = 8,
): BufferGeometry {
  if (points.length < 2) return new BufferGeometry()
  const curve = new CatmullRomCurve3([...points])
  const segs = Math.max(8, points.length * 2)
  const positions: number[] = []
  const normals: number[] = []
  const index: number[] = []
  const normal = new Vector3()
  const binormal = new Vector3()

  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs
    const radius = startRadius + (endRadius - startRadius) * t
    const { position, tangent } = frameAt(curve, t)
    normal.set(0, 1, 0)
    if (Math.abs(tangent.dot(normal)) > 0.92) normal.set(1, 0, 0)
    binormal.crossVectors(tangent, normal).normalize()
    normal.crossVectors(binormal, tangent).normalize()
    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * Math.PI * 2
      const cx = Math.cos(a)
      const sy = Math.sin(a)
      const px = position.x + (normal.x * cx + binormal.x * sy) * radius
      const py = position.y + (normal.y * cx + binormal.y * sy) * radius
      const pz = position.z + (normal.z * cx + binormal.z * sy) * radius
      positions.push(px, py, pz)
      normals.push(normal.x * cx + binormal.x * sy, normal.y * cx + binormal.y * sy, normal.z * cx + binormal.z * sy)
    }
  }

  for (let i = 0; i < segs; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = (i + 1) * radial + j
      const d = (i + 1) * radial + ((j + 1) % radial)
      index.push(a, c, b, b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(index)
  return geometry
}

function frameAt(curve: CatmullRomCurve3, t: number): { position: Vector3; tangent: Vector3 } {
  return { position: curve.getPointAt(t), tangent: curve.getTangentAt(t).normalize() }
}

function mesh(positions: number[], index: number[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}
