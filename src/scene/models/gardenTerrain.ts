import { ExtrudeGeometry, Shape } from 'three'

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
