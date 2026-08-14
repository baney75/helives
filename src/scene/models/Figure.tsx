import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { DoubleSide, SRGBColorSpace, type Mesh } from 'three'
import type { Vec3 } from './eden.ts'

export type FigureRole = 'man' | 'woman'
export type FigurePoseId = 'stand' | 'reach' | 'eat' | 'offer' | 'depart'

const MAPS = {
  man: '/models/genesis/man.png',
  woman: '/models/genesis/woman.png',
} as const

const SIZE: Record<FigureRole, readonly [number, number]> = {
  man: [0.58, 1.62],
  woman: [0.54, 1.54],
}

export function Figure({
  role,
  position,
  fade = 1,
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
  return <PhotoPerson role={role} position={position} />
}

function PhotoPerson({ role, position }: { role: FigureRole; position: Vec3 }) {
  const map = useTexture(MAPS[role])
  const mesh = useRef<Mesh>(null)
  const [width, height] = SIZE[role]

  useLayoutEffect(() => {
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    map.needsUpdate = true
  }, [map])

  useFrame(({ camera }) => {
    const node = mesh.current
    if (!node) return
    node.rotation.y = Math.atan2(camera.position.x - node.position.x, camera.position.z - node.position.z)
  })

  return (
    <mesh ref={mesh} position={[position[0], position[1] + height * 0.5, position[2]]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.28} side={DoubleSide} toneMapped={false} />
    </mesh>
  )
}

useTexture.preload(MAPS.man)
useTexture.preload(MAPS.woman)
