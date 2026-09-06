import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type Group, type Object3D } from 'three'
import type { Vec3 } from './eden.ts'
import {
  figureJointPose,
  figureJointShift,
  heldFruitJoint,
  type FigurePoseId,
  type FigureRole,
} from './figurePose.ts'

export type { FigurePoseId, FigureRole } from './figurePose.ts'
export { figureJointPose, figureJointShift, heldFruitJoint } from './figurePose.ts'

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

const REST = new WeakMap<Object3D, Vector3>()
const WORLD = new Vector3()

function applyJoints(root: Object3D, pose: FigurePoseId, role: FigureRole, time: number): void {
  const joints = figureJointPose(pose, role, time)
  const shifts = figureJointShift(pose, role)
  for (const [name, rot] of Object.entries(joints)) {
    const node = root.getObjectByName(name)
    if (!node) continue
    node.rotation.set(rot.x, rot.y, rot.z)
    let rest = REST.get(node)
    if (!rest) {
      rest = node.position.clone()
      REST.set(node, rest)
    }
    const shift = shifts[name]
    if (shift) node.position.set(rest.x + shift.x, rest.y + shift.y, rest.z + shift.z)
    else node.position.copy(rest)
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
  const fruit = useRef<Group>(null)
  const gltf = useGLTF(SRC[role], false, false)
  const lean = LEAN[pose] * (role === 'woman' ? -1 : 1)
  const figureScale = role === 'man' ? 1.02 : 0.98

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
    if (clone.current) applyJoints(clone.current, pose, role, t)
    const held = fruit.current
    if (held) {
      held.visible = holdFruit
      const hand = clone.current?.getObjectByName(heldFruitJoint(role))
      if (holdFruit && hand) {
        hand.getWorldPosition(WORLD)
        group.worldToLocal(WORLD)
        WORLD.y += pose === 'eat' ? 0.04 : 0.055
        if (pose === 'eat') WORLD.z -= 0.03
        held.position.copy(WORLD)
      }
    }
  })

  return (
    <group ref={root} position={position} rotation={[0, rotationY, lean]} scale={figureScale} visible={fade >= 0.04}>
      <group ref={clone} scale={fade}>
        <Clone object={gltf.scene} />
      </group>
      <group ref={fruit} visible={holdFruit}>
        <mesh>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={fruitColor} roughness={0.38} emissive="#3a0c08" emissiveIntensity={0.42} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload(SRC.man, false, false)
useGLTF.preload(SRC.woman, false, false)
