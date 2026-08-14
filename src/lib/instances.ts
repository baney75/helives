import { Euler, InstancedMesh, Object3D } from 'three'

const dummy = new Object3D()
const euler = new Euler()

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
    dummy.rotation.set(0, 0, 0)
    dummy.scale.setScalar(scaleAt(i))
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

export type InstancePose = {
  scale: readonly [number, number, number]
  rotation: readonly [number, number, number]
}

/** Leaves and grass need facing, not uniform scale. */
export function writeOrientedInstances(
  mesh: InstancedMesh,
  positions: Float32Array,
  count: number,
  poseAt: (index: number) => InstancePose,
): void {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    const pose = poseAt(i)
    dummy.position.set(positions[i3] ?? 0, positions[i3 + 1] ?? 0, positions[i3 + 2] ?? 0)
    euler.set(pose.rotation[0], pose.rotation[1], pose.rotation[2])
    dummy.setRotationFromEuler(euler)
    dummy.scale.set(pose.scale[0], pose.scale[1], pose.scale[2])
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}
