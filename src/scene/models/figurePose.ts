export type FigureRole = 'man' | 'woman'
export type FigurePoseId = 'stand' | 'reach' | 'eat' | 'offer' | 'depart'

export type JointEuler = { x: number; y: number; z: number }

/** Story poses for the named GLB joints. Not a bounce-orb or capsule walk. */
export function figureJointPose(
  pose: FigurePoseId,
  role: FigureRole,
  time: number,
): Record<string, JointEuler> {
  const phase = role === 'man' ? 0 : Math.PI * 0.7
  const walk = pose === 'depart' ? Math.sin(time * 3.05 + phase) : 0
  const reach = pose === 'reach' || pose === 'eat' ? 1 : 0
  const eat = pose === 'eat' ? 1 : 0
  const offer = pose === 'offer' ? 1 : 0
  const woman = role === 'woman' ? 1 : -1
  return {
    Head: { x: 0.05 + eat * 0.18 + (pose === 'depart' ? 0.1 : 0), y: woman * offer * -0.1, z: woman * reach * -0.06 },
    Neck: { x: eat * 0.08, y: 0, z: 0 },
    LForearm: { x: -walk * 0.28 - eat * 0.35, y: 0, z: woman * (reach * -0.72) },
    RForearm: { x: walk * 0.28 - offer * 0.55 - eat * 0.4, y: offer * 0.18, z: 0 },
    LHand: { x: eat * 0.2, y: 0, z: reach * -0.12 },
    RHand: { x: offer * 0.15 + eat * 0.12, y: 0, z: 0 },
    LLowerLeg: { x: walk * 0.42, y: 0, z: 0 },
    RLowerLeg: { x: -walk * 0.42, y: 0, z: 0 },
    LKnee: { x: Math.max(0, walk) * 0.28, y: 0, z: 0 },
    RKnee: { x: Math.max(0, -walk) * 0.28, y: 0, z: 0 },
    LFoot: { x: walk * 0.08, y: 0, z: 0 },
    RFoot: { x: -walk * 0.08, y: 0, z: 0 },
  }
}
