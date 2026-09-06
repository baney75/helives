export type FigureRole = 'man' | 'woman'
export type FigurePoseId = 'stand' | 'reach' | 'eat' | 'offer' | 'depart'
export type JointEuler = { x: number; y: number; z: number }
export type JointShift = { x: number; y: number; z: number }

/** Angles for connected Y-up shoulder → elbow → wrist joints. */
export function figureJointPose(pose: FigurePoseId, role: FigureRole, time: number): Record<string, JointEuler> {
  const phase = role === 'man' ? 0 : Math.PI * 0.7
  const walk = pose === 'depart' ? Math.sin(time * 3.05 + phase) : 0
  const result: Record<string, JointEuler> = {
    Head: { x: pose === 'eat' ? 0.16 : pose === 'depart' ? 0.1 : 0.02, y: role === 'woman' ? -0.12 : 0.12, z: 0 },
    LUpperArm: { x: 0.12 + walk * 0.2, y: 0, z: -0.08 },
    RUpperArm: { x: 0.12 - walk * 0.2, y: 0, z: 0.08 },
    LForearm: { x: 0.18, y: 0, z: 0 },
    RForearm: { x: 0.18, y: 0, z: 0 },
    LLowerLeg: { x: walk * 0.28, y: 0, z: 0 },
    RLowerLeg: { x: -walk * 0.28, y: 0, z: 0 },
  }
  const side = role === 'woman' ? 'L' : 'R'
  if (pose === 'reach') {
    result[side + 'UpperArm'] = { x: 1.65, y: role === 'woman' ? -0.3 : 0.3, z: 0 }
    result[side + 'Forearm'] = { x: 0.35, y: 0, z: 0 }
  } else if (pose === 'eat') {
    result[side + 'UpperArm'] = { x: 1.12, y: role === 'woman' ? -0.5 : 0.5, z: role === 'woman' ? 0.18 : -0.18 }
    result[side + 'Forearm'] = { x: 1.6, y: 0, z: 0 }
  } else if (pose === 'offer') {
    result[side + 'UpperArm'] = { x: 0.55, y: 0, z: 0 }
    result[side + 'Forearm'] = { x: 1.0, y: 0, z: 0 }
  }
  return result
}

/** Connected wrists require no independent translation. */
export function figureJointShift(_pose: FigurePoseId, _role: FigureRole): Record<string, JointShift> {
  return {}
}
export function heldFruitJoint(role: FigureRole): 'LHand' | 'RHand' {
  return role === 'woman' ? 'LHand' : 'RHand'
}
