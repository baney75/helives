import { Clone, useGLTF } from '@react-three/drei'
import { useStoryFrame } from '../StoryTime.tsx'
import { useLayoutEffect, useRef } from 'react'
import { MathUtils, Mesh, MeshStandardMaterial, Vector3, type Group, type Object3D } from 'three'
import type { Vec3 } from './eden.ts'
import { solveReach } from './reach.ts'
import { AppleFruit } from './Trees.tsx'
import {
  figureJointPose,
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

const WORLD = new Vector3()

function applyJoints(root: Object3D, pose: FigurePoseId, role: FigureRole, time: number, delta: number): void {
  for (const [name, rot] of Object.entries(figureJointPose(pose, role, time))) {
    const node = root.getObjectByName(name)
    if (!node) continue
    node.rotation.set(
      MathUtils.damp(node.rotation.x, rot.x, 9, delta),
      MathUtils.damp(node.rotation.y, rot.y, 9, delta),
      MathUtils.damp(node.rotation.z, rot.z, 9, delta),
    )
  }
}

export function Figure({
  role,
  pose,
  position,
  rotationY = 0,
  fade = 1,
  holdFruit = false,
  reducedMotion = false,
  reachTarget,
}: {
  role: FigureRole
  pose: FigurePoseId
  position: Vec3
  rotationY?: number
  fade?: number
  holdFruit?: boolean
  reducedMotion?: boolean
  reachTarget?: Vec3
}) {
  const root = useRef<Group>(null)
  const clone = useRef<Group>(null)
  const fruit = useRef<Group>(null)
  const gltf = useGLTF(SRC[role], false, false)
  const lean = LEAN[pose] * (role === 'woman' ? -1 : 1)
  const figureScale = role === 'man' ? 1.02 : 0.98

  useLayoutEffect(() => {
    clone.current?.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue
        if (material.name.includes('woven linen')) {
          material.roughness = 0.78
          material.color.offsetHSL(0, -0.025, 0.07)
        } else if (material.name.includes('warm skin')) {
          material.roughness = 0.58
          material.color.offsetHSL(0.012, -0.015, 0.045)
        } else if (material.name.includes('hair')) {
          material.roughness = 0.72
        }
        material.needsUpdate = true
      }
    })
  }, [gltf.scene])

  useStoryFrame((seconds, delta) => {
    const group = root.current
    if (!group) return
    const hidden = fade < 0.04
    group.visible = !hidden
    if (hidden) return
    const t = reducedMotion ? 0 : seconds
    const phase = role === 'man' ? 0 : Math.PI * 0.7
    const walking = pose === 'depart'
    const breath = Math.sin(t * 1.15 + phase) * 0.006
    const step = walking ? Math.abs(Math.sin(t * 3.05 + phase)) * 0.03 : 0
    group.position.set(position[0], position[1] + breath + step, position[2])
    group.rotation.set(0, rotationY + (walking ? Math.sin(t * 1.55 + phase) * 0.04 : 0), lean)
    if (clone.current) applyJoints(clone.current, pose, role, t, reducedMotion ? 1 : delta)
    if (pose === 'reach' && reachTarget && clone.current && group.parent) {
      group.parent.updateWorldMatrix(true, false)
      WORLD.set(...reachTarget).applyMatrix4(group.parent.matrixWorld)
      solveReach(clone.current, role === 'woman' ? 'L' : 'R', WORLD)
    }
    const held = fruit.current
    if (held) {
      held.visible = holdFruit
      const hand = clone.current?.getObjectByName(heldFruitJoint(role))
      if (holdFruit && hand) {
        group.updateWorldMatrix(true, true)
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} scale={[1.18, 0.66, 1]}>
        <circleGeometry args={[0.17, 24]} />
        <meshBasicMaterial color="#080704" transparent opacity={0.32 * fade} depthWrite={false} />
      </mesh>
      <group ref={clone} scale={fade}>
        <Clone object={gltf.scene} deep="materialsOnly" castShadow receiveShadow />
      </group>
      <group ref={fruit} visible={holdFruit}>
        <AppleFruit scale={0.75} glow={0.015} />
      </group>
    </group>
  )
}
