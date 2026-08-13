import { InstancedMesh, Object3D } from 'three'

const dummy = new Object3D()

/** Write instance matrices once. Animate the parent mesh instead of this loop. */
export function writeInstanceMatrices(
  mesh: InstancedMesh,
  positions: Float32Array,
  count: number,
  scaleAt: (index: number) => number,
): void {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    dummy.position.set(positions[i3] ?? 0, positions[i3 + 1] ?? 0, positions[i3 + 2] ?? 0)
    dummy.scale.setScalar(scaleAt(i))
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}
