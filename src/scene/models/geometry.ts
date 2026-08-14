import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three'

/** Flat pointed leaf in XY. Thickness is on Z so a canopy of these reads as foliage, not balls. */
export function createLeafGeometry(): BufferGeometry {
  const positions = [
    0, 0.11, 0, -0.045, 0.02, 0.006, 0.045, 0.02, 0.006, -0.038, -0.05, 0.004, 0.038, -0.05, 0.004,
    0, -0.1, 0, -0.045, 0.02, -0.006, 0.045, 0.02, -0.006, -0.038, -0.05, -0.004, 0.038, -0.05,
    -0.004,
  ]
  const idx = [
    0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 0, 2, 7, 0, 6, 1, 6, 8, 1, 1, 8, 3, 7, 2, 9, 2, 4, 9, 8,
    5, 3, 9, 4, 5, 0, 7, 6, 6, 7, 9, 6, 9, 8,
  ]
  return mesh(positions, idx)
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
