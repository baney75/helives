import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, type Mesh } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { writeInstanceMatrices } from '../../lib/instances.ts'
import { fillDisk, mulberry32 } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'

const land = new Color('#6d8a4e')
const soil = new Color('#8a6b3d')
const color = new Color()

export function DryLand({ clock }: { clock: SceneClock }) {
  const globe = useRef<Mesh>(null)
  const plants = useRef<InstancedMesh>(null)
  const strength = Math.max(
    clock.presence.day3,
    clock.presence.day5 * 0.7,
    clock.presence.day6 * 0.55,
    clock.presence.garden * 0.4,
  )
  const count = BUDGET[clock.quality].earth
  const positions = useMemo(() => fillDisk(count, 2.6, 88, 0.02), [count])
  const kinds = useMemo(() => {
    const rng = mulberry32(51)
    return Float32Array.from({ length: count }, () => rng())
  }, [count])

  useLayoutEffect(() => {
    const inst = plants.current
    if (!inst) return
    writeInstanceMatrices(inst, positions, count, (i) => 0.04 + (kinds[i] ?? 0) * 0.12)
    for (let i = 0; i < count; i += 1) {
      color.copy((kinds[i] ?? 0) > 0.62 ? land : soil)
      inst.setColorAt(i, color)
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [count, kinds, positions])

  useFrame(({ clock: r3f }) => {
    if (globe.current) {
      globe.current.visible = strength > 0.03
      globe.current.scale.setScalar(2.2 + clock.presence.day3 * 0.15)
      if (!clock.reducedMotion) globe.current.rotation.y = r3f.elapsedTime * 0.03
    }
    const inst = plants.current
    if (!inst) return
    inst.visible = strength > 0.08
    inst.scale.setScalar(0.85 + clock.presence.day3 * 0.3)
  })

  if (strength <= 0) return null

  return (
    <group position={[0, -1.35, 0]}>
      <mesh ref={globe} rotation={[0.18, 0.4, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#1d4d6e" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.7, 40]} />
        <meshStandardMaterial color="#3d5c32" roughness={0.9} />
      </mesh>
      <instancedMesh ref={plants} args={[undefined, undefined, count]}>
        <coneGeometry args={[1, 3.2, 5]} />
        <meshStandardMaterial vertexColors roughness={0.85} />
      </instancedMesh>
    </group>
  )
}
