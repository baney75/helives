import type { Vec3 } from './eden.ts'

export type FigureRole = 'man' | 'woman'
export type FigurePoseId = 'stand' | 'reach' | 'eat' | 'offer' | 'depart'

type Joints = {
  torso: number
  head: number
  leftShoulder: number
  leftElbow: number
  rightShoulder: number
  rightElbow: number
  leftHip: number
  leftKnee: number
  rightHip: number
  rightKnee: number
}

const POSES: Record<FigurePoseId, Joints> = {
  stand: {
    torso: 0.04,
    head: 0,
    leftShoulder: 0.18,
    leftElbow: 0.22,
    rightShoulder: 0.18,
    rightElbow: 0.22,
    leftHip: 0.04,
    leftKnee: 0.06,
    rightHip: 0.04,
    rightKnee: 0.06,
  },
  reach: {
    torso: 0.08,
    head: -0.28,
    leftShoulder: 0.35,
    leftElbow: 0.4,
    rightShoulder: -1.15,
    rightElbow: -0.35,
    leftHip: 0.08,
    leftKnee: 0.1,
    rightHip: -0.06,
    rightKnee: 0.12,
  },
  eat: {
    torso: 0.1,
    head: 0.22,
    leftShoulder: 0.45,
    leftElbow: 0.7,
    rightShoulder: -0.95,
    rightElbow: -1.35,
    leftHip: 0.06,
    leftKnee: 0.08,
    rightHip: 0.04,
    rightKnee: 0.08,
  },
  offer: {
    torso: 0.12,
    head: 0.08,
    leftShoulder: -0.55,
    leftElbow: -0.7,
    rightShoulder: -0.55,
    rightElbow: -0.7,
    leftHip: 0.05,
    leftKnee: 0.08,
    rightHip: 0.05,
    rightKnee: 0.08,
  },
  depart: {
    torso: 0.16,
    head: 0.12,
    leftShoulder: -0.35,
    leftElbow: 0.25,
    rightShoulder: 0.45,
    rightElbow: 0.2,
    leftHip: -0.42,
    leftKnee: 0.38,
    rightHip: 0.32,
    rightKnee: 0.12,
  },
}

const MAN = {
  height: 1.16,
  skin: '#c4a07a',
  robe: '#8d7a5c',
  hair: '#2a2218',
  shoulder: 0.2,
}

const WOMAN = {
  height: 1.08,
  skin: '#d2b08c',
  robe: '#c4b496',
  hair: '#3a2a1c',
  shoulder: 0.175,
}

export function Figure({
  role,
  pose,
  position,
  rotationY = 0,
  fade = 1,
  holdFruit = false,
  fruitColor = '#8a2a22',
}: {
  role: FigureRole
  pose: FigurePoseId
  position: Vec3
  rotationY?: number
  fade?: number
  holdFruit?: boolean
  fruitColor?: string
}) {
  if (fade < 0.04) return null
  const spec = role === 'man' ? MAN : WOMAN
  const joints = POSES[pose]
  const scale = spec.height / 1.16
  const skin = spec.skin

  return (
    <group position={position} rotation-y={rotationY} scale={scale} visible={fade > 0.04}>
      <mesh position={[0, 0.72, 0]} rotation={[joints.torso, 0, 0]}>
        <capsuleGeometry args={[0.11, 0.28, 4, 8]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.58, 0.02]} rotation={[0.12 + joints.torso, 0, 0]}>
        <coneGeometry args={[0.22, 0.72, 10]} />
        <meshStandardMaterial color={spec.robe} roughness={0.88} />
      </mesh>
      <group position={[0, 0.96, 0]} rotation={[joints.head, 0, 0]}>
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color={skin} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.14, -0.01]}>
          <sphereGeometry args={[role === 'woman' ? 0.09 : 0.08, 10, 10]} />
          <meshStandardMaterial color={spec.hair} roughness={0.9} />
        </mesh>
        {role === 'woman' ? (
          <mesh position={[0, 0.02, -0.06]} rotation={[0.35, 0, 0]}>
            <capsuleGeometry args={[0.05, 0.22, 3, 6]} />
            <meshStandardMaterial color={spec.hair} roughness={0.9} />
          </mesh>
        ) : (
          <mesh position={[0, 0.05, 0.04]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={spec.hair} roughness={0.85} />
          </mesh>
        )}
      </group>
      <Arm
        side={-1}
        shoulderX={spec.shoulder}
        color={skin}
        shoulder={joints.leftShoulder}
        elbow={joints.leftElbow}
      />
      <Arm
        side={1}
        shoulderX={spec.shoulder}
        color={skin}
        shoulder={joints.rightShoulder}
        elbow={joints.rightElbow}
        fruit={holdFruit ? fruitColor : null}
      />
      <Leg side={-1} color={skin} hip={joints.leftHip} knee={joints.leftKnee} />
      <Leg side={1} color={skin} hip={joints.rightHip} knee={joints.rightKnee} />
    </group>
  )
}

function Arm({
  side,
  shoulderX,
  color,
  shoulder,
  elbow,
  fruit = null,
}: {
  side: 1 | -1
  shoulderX: number
  color: string
  shoulder: number
  elbow: number
  fruit?: string | null
}) {
  return (
    <group position={[side * shoulderX, 0.9, 0]} rotation={[shoulder, 0, side * 0.18]}>
      <mesh position={[0, -0.12, 0]}>
        <capsuleGeometry args={[0.035, 0.16, 3, 6]} />
        <meshStandardMaterial color={color} roughness={0.72} />
      </mesh>
      <group position={[0, -0.22, 0]} rotation={[elbow, 0, 0]}>
        <mesh position={[0, -0.11, 0]}>
          <capsuleGeometry args={[0.03, 0.14, 3, 6]} />
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
        {fruit ? (
          <mesh position={[0, -0.22, 0.02]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color={fruit} roughness={0.38} />
          </mesh>
        ) : null}
      </group>
    </group>
  )
}

function Leg({
  side,
  color,
  hip,
  knee,
}: {
  side: 1 | -1
  color: string
  hip: number
  knee: number
}) {
  return (
    <group position={[side * 0.07, 0.42, 0]} rotation={[hip, 0, side * 0.04]}>
      <mesh position={[0, -0.13, 0]}>
        <capsuleGeometry args={[0.045, 0.16, 3, 6]} />
        <meshStandardMaterial color={color} roughness={0.74} />
      </mesh>
      <group position={[0, -0.24, 0]} rotation={[knee, 0, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.038, 0.15, 3, 6]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
        <mesh position={[0, -0.22, 0.03]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.03, 0.12]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}
