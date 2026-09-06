import { Quaternion, Vector3, type Object3D } from 'three'
const origin = new Vector3(), hand = new Vector3(), towardHand = new Vector3(), towardTarget = new Vector3()
const inverseParent = new Quaternion(), turn = new Quaternion()
/** Rotate the connected shoulder and elbow toward the fruit; never translate the wrist. */
export function solveReach(root: Object3D, side: 'L' | 'R', target: Vector3): void {
  const wrist = root.getObjectByName(side + 'Hand')
  if (!wrist) return
  for (let iteration = 0; iteration < 5; iteration += 1) {
    for (const name of [side + 'Forearm', side + 'UpperArm']) {
      const joint = root.getObjectByName(name)
      if (!joint?.parent) continue
      root.updateWorldMatrix(true, true)
      joint.getWorldPosition(origin)
      wrist.getWorldPosition(hand)
      joint.parent.getWorldQuaternion(inverseParent).invert()
      towardHand.copy(hand).sub(origin).applyQuaternion(inverseParent).normalize()
      towardTarget.copy(target).sub(origin).applyQuaternion(inverseParent).normalize()
      if (towardHand.lengthSq() < 0.01 || towardTarget.lengthSq() < 0.01) continue
      turn.setFromUnitVectors(towardHand, towardTarget)
      joint.quaternion.premultiply(turn)
    }
  }
  root.updateWorldMatrix(true, true)
}
