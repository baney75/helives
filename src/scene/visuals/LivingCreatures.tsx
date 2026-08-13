import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { InstancedMesh } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { writeInstanceMatrices } from '../../lib/instances.ts'
import { fillDisk, fillHemisphere } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'

export function LivingCreatures({ clock }: { clock: SceneClock }) {
  const fish = useRef<InstancedMesh>(null)
  const birds = useRef<InstancedMesh>(null)
  const fishStrength = Math.max(clock.presence.day5, clock.presence.day6 * 0.35)
  const birdStrength = Math.max(clock.presence.day5, clock.presence.day6 * 0.4)
  const fishCount = BUDGET[clock.quality].fish
  const birdCount = BUDGET[clock.quality].birds
  const fishPos = useMemo(() => fillDisk(fishCount, 2.4, 71, -0.4), [fishCount])
  const birdPos = useMemo(() => fillHemisphere(birdCount, 4.2, 83), [birdCount])

  useLayoutEffect(() => {
    if (fish.current) writeInstanceMatrices(fish.current, fishPos, fishCount, () => 0.045)
    if (birds.current) writeInstanceMatrices(birds.current, birdPos, birdCount, () => 0.06)
  }, [birdCount, birdPos, fishCount, fishPos])

  useFrame(({ clock: r3f }) => {
    const t = clock.reducedMotion ? 0 : r3f.elapsedTime
    if (fish.current) {
      fish.current.visible = fishStrength > 0.04
      fish.current.rotation.y = t * 0.12
    }
    if (birds.current) {
      birds.current.visible = birdStrength > 0.04
      birds.current.rotation.y = t * 0.08
    }
  })

  if (fishStrength <= 0 && birdStrength <= 0) return null

  return (
    <group>
      <instancedMesh ref={fish} args={[undefined, undefined, fishCount]} position={[0, -0.6, 0]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshStandardMaterial color="#7eb0c9" roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={birds} args={[undefined, undefined, birdCount]} position={[0, 1.6, 0]}>
        <coneGeometry args={[0.6, 1.6, 3]} />
        <meshStandardMaterial color="#d8c4a0" roughness={0.6} />
      </instancedMesh>
    </group>
  )
}
