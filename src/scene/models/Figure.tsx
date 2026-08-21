import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { Vec3 } from './eden.ts'

export type FigureRole = 'man' | 'woman'
export type FigurePoseId = 'stand' | 'reach' | 'eat' | 'offer' | 'depart'

const SRC = {
  man: '/models/genesis/man.glb',
  woman: '/models/genesis/woman.glb',
} as const

const LEAN: Record<FigurePoseId, number> = {
  stand: 0,
  offer: 0.06,
  reach: 0.16,
  eat: 0.22,
  depart: 0.08,
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
  const gltf = useGLTF(SRC[role])
  if (fade < 0.04) return null
  const lean = LEAN[pose] * (role === 'woman' ? -1 : 1)
  const figureScale = role === 'man' ? 0.9 : 0.88
  useFrame(({ clock }) => {
    const group = root.current
    if (!group) return
    const t = reducedMotion ? 0 : clock.elapsedTime
    const phase = role === 'man' ? 0 : Math.PI * 0.7
    const walking = pose === 'depart'
    const breath = Math.sin(t * 1.15 + phase) * 0.006
    const step = walking ? Math.abs(Math.sin(t * 3.2 + phase)) * 0.028 : 0
    group.position.set(position[0], position[1] + breath + step, position[2])
    group.rotation.set(0, rotationY + (walking ? Math.sin(t * 1.6 + phase) * 0.035 : 0), lean + Math.sin(t * 0.9 + phase) * 0.012)
  })
  return (
    <group ref={root} position={position} rotation={[0, rotationY, lean]} scale={figureScale}>
      <group scale={fade}>
        <Clone object={gltf.scene} />
      </group>
      {holdFruit ? (
        <mesh position={[role === 'woman' ? 0.16 : 0.18, 0.92, 0.1]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={fruitColor} roughness={0.42} />
        </mesh>
      ) : null}
    </group>
  )
}

useGLTF.preload(SRC.man)
useGLTF.preload(SRC.woman)
