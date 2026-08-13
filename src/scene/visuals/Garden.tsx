import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { writeInstanceMatrices } from '../../lib/instances.ts'
import { fillDisk, mulberry32 } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'

const bark = new Color('#4a3420')
const leaf = new Color('#5f8a48')
const color = new Color()

export function Garden({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.garden, clock.presence.day6 * 0.45)
  const fall = clock.presence.fall
  const count = BUDGET[clock.quality].trees
  const positions = useMemo(() => fillDisk(count, 3.4, 19, 0), [count])
  const kinds = useMemo(() => {
    const rng = mulberry32(27)
    return Float32Array.from({ length: count }, () => rng())
  }, [count])
  const trunks = useRef<InstancedMesh>(null)
  const canopies = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (trunks.current) {
      writeInstanceMatrices(trunks.current, positions, count, (i) => 0.08 + (kinds[i] ?? 0) * 0.05)
    }
    if (canopies.current) {
      writeInstanceMatrices(canopies.current, positions, count, (i) => 0.28 + (kinds[i] ?? 0) * 0.22)
      for (let i = 0; i < count; i += 1) {
        color.copy(leaf).lerp(bark, fall * 0.55)
        canopies.current.setColorAt(i, color)
      }
      if (canopies.current.instanceColor) canopies.current.instanceColor.needsUpdate = true
    }
  }, [count, fall, kinds, positions])

  if (strength <= 0) return null

  return (
    <group position={[0, -0.15, 0]} visible={strength > 0.04}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[4.2, 40]} />
        <meshStandardMaterial color={fall > 0.4 ? '#3a2a18' : '#2f4a28'} roughness={0.92} />
      </mesh>
      <mesh position={[0.2, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <ringGeometry args={[0.12, 0.38, 24]} />
        <meshStandardMaterial color="#3a6a88" roughness={0.4} metalness={0.05} />
      </mesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.35, 0.45, 2.4, 6]} />
        <meshStandardMaterial color="#4a3420" roughness={0.9} />
      </instancedMesh>
      <group position={[0, 1.4, 0]}>
        <instancedMesh ref={canopies} args={[undefined, undefined, count]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial vertexColors roughness={0.75} />
        </instancedMesh>
      </group>
      <Figure x={-0.55} hue="#c9a882" />
      <Figure x={0.55} hue="#d4b494" />
    </group>
  )
}

function Figure({ x, hue }: { x: number; hue: string }) {
  return (
    <group position={[x, 0.55, 1.4]}>
      <mesh position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.12, 0.42, 4, 8]} />
        <meshStandardMaterial color={hue} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color={hue} roughness={0.65} />
      </mesh>
    </group>
  )
}
