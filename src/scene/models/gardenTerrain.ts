import { BufferAttribute, CircleGeometry, ExtrudeGeometry, Shape } from 'three'
import { EDEN, riverDistance } from './eden.ts'

const ISLAND: readonly (readonly [number, number])[] = [
  [-4.05, -0.35],
  [-3.55, -1.85],
  [-2.35, -2.95],
  [-0.85, -3.35],
  [0.55, -3.55],
  [2.05, -2.85],
  [3.35, -1.75],
  [4.05, -0.25],
  [3.85, 1.15],
  [2.75, 2.25],
  [1.15, 3.15],
  [-0.45, 3.35],
  [-1.95, 2.85],
  [-3.25, 1.75],
  [-4.15, 0.55],
]

export function createPlantedIsland(): ExtrudeGeometry {
  const shape = new Shape()
  ISLAND.forEach(([x, z], index) => (index === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.04,
    bevelThickness: 0.03,
    curveSegments: 3,
  })
  geometry.computeVertexNormals()
  return geometry
}

/** Circle in XY; local Z becomes world Y after a -PI/2 pitch. Banks rise; the river cuts a bed. */
export function createPlantedMeadow(): CircleGeometry {
  const geometry = new CircleGeometry(EDEN.groundRadius, 64)
  const position = geometry.getAttribute('position') as BufferAttribute
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const radius = Math.hypot(x, y) / EDEN.groundRadius
    const river = riverDistance(x, y)
    let height = (1 - radius * radius) * 0.11 + Math.sin(x * 1.3) * Math.cos(y * 1.1) * 0.045
    if (river < 0.62) height -= (0.62 - river) * 0.22
    if (river > 0.28 && river < 0.72) height += 0.035
    position.setZ(i, height)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}
