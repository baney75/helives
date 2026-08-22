import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Object3D } from 'three'
import type { Vec3 } from './eden.ts'
import { figureJointPose, type FigurePoseId, type FigureRole } from './figurePose.ts'

export type { FigurePoseId, FigureRole } from './figurePose.ts'
export { figureJointPose } from './figurePose.ts'

const SRC = {
  man: '/models/genesis/man.glb',
  woman: '/models/genesis/woman.glb',
} as const

const LEAN: Record<FigurePoseId, number> = {
  stand: 0,
  offer: 0.04,
  reach: 0.12,
  eat: 0.16,
  depart: 0.05,
}

function applyJoints(root: Object3D, pose: FigurePoseId, role: FigureRole, time: number): void {
  const joints = figureJointPose(pose, role, time)
  for (const [name, rot] of Object.entries(joints)) {
    const node = root.getObjectByName(name)
    if (!node) continue
    node.rotation.set(rot.x, rot.y, rot.z)
  }
}

export function Figure({
  role,
  pose,
  position,
  rotationY = 0,
  fade = 1,
  holdFruit = false,
  fruitColor = '#8a2a22',
  reducedMotion = false,
}: {
  role: FigureRole
  pose: FigurePoseId
  position: Vec3
  rotationY?: number
  fade?: number
  holdFruit?: boolean
  fruitColor?: string
  reducedMotion?: boolean
}) {
  const root = useRef<Group>(null)
  const clone = useRef<Group>(null)
  const gltf = useGLTF(SRC[role])
  const lean = LEAN[pose] * (role === 'woman' ? -1 : 1)
  const figureScale = role === 'man' ? 0.9 : 0.88

  useFrame(({ clock }) => {
    const group = root.current
    if (!group) return
    const hidden = fade < 0.04
    group.visible = !hidden
    if (hidden) return
    const t = reducedMotion ? 0 : clock.elapsedTime
    const phase = role === 'man' ? 0 : Math.PI * 0.7
    const walking = pose === 'depart'
    const breath = Math.sin(t * 1.15 + phase) * 0.006
    const step = walking ? Math.abs(Math.sin(t * 3.05 + phase)) * 0.03 : 0
    group.position.set(position[0], position[1] + breath + step, position[2])
    group.rotation.set(0, rotationY + (walking ? Math.sin(t * 1.55 + phase) * 0.04 : 0), lean)
    if (clone.current && !reducedMotion) applyJoints(clone.current, pose, role, t)
  })

  return (
    <group ref={root} position={position} rotation={[0, rotationY, lean]} scale={figureScale} visible={fade >= 0.04}>
      <group ref={clone} scale={fade}>
        <Clone object={gltf.scene} />
      </group>
      {holdFruit ? (
        <mesh position={[role === 'woman' ? 0.16 : 0.18, pose === 'eat' ? 1.12 : 0.92, 0.1]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={fruitColor} roughness={0.42} />
        </mesh>
      ) : null}
    </group>
  )
}

useGLTF.preload(SRC.man)
useGLTF.preload(SRC.woman)
