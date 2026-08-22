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
    Head: { x: 0.04 + eat * 0.22 + (pose === 'depart' ? 0.1 : 0), y: woman * offer * -0.12, z: woman * reach * -0.08 },
    Neck: { x: eat * 0.08, y: 0, z: 0 },
    LForearm: { x: -walk * 0.38 - offer * 0.15, y: 0, z: woman * (reach * -1.05 - eat * -0.35) },
    RForearm: { x: walk * 0.38 - offer * 0.85 - eat * 0.55, y: offer * 0.25, z: woman * (reach * 0.12) },
    LHand: { x: eat * 0.35, y: 0, z: reach * -0.2 },
    RHand: { x: offer * 0.2 + eat * 0.15, y: 0, z: 0 },
    LLowerLeg: { x: walk * 0.62, y: 0, z: 0 },
    RLowerLeg: { x: -walk * 0.62, y: 0, z: 0 },
    LKnee: { x: Math.max(0, walk) * 0.45, y: 0, z: 0 },
    RKnee: { x: Math.max(0, -walk) * 0.45, y: 0, z: 0 },
    LFoot: { x: walk * 0.12, y: 0, z: 0 },
    RFoot: { x: -walk * 0.12, y: 0, z: 0 },
  }
}
