import { useGLTF } from '@react-three/drei'
import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, type Group, type InstancedMesh } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { writeOrientedInstances } from '../../lib/instances.ts'
import { fillDisk, fillHemisphere } from '../../lib/rng.ts'
import { createBirdGeometry, createFishGeometry } from '../models/creatures.ts'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'

export function LivingCreatures({ clock }: { clock: SceneClock }) {
  const fish = useRef<InstancedMesh>(null)
  const birds = useRef<InstancedMesh>(null)
  const heroFish = useRef<Group>(null)
  const heroBirds = useRef<Group>(null)
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const fishStrength = (current === 'day5' ? clock.presence.day5 : current === 'day6' ? 0.16 : current === 'day7' ? 0.05 : 0) * (1 - garden)
  const birdStrength = (current === 'day5' ? clock.presence.day5 : current === 'day6' ? 0.2 : current === 'day7' ? 0.07 : 0) * (1 - garden)
  const fishCount = BUDGET[clock.quality].fish
  const birdCount = BUDGET[clock.quality].birds
  const fishPos = useMemo(() => fillDisk(fishCount, 2.4, 71, -0.4), [fishCount])
  const birdPos = useMemo(() => fillHemisphere(birdCount, 4.2, 83), [birdCount])
  const fishGeo = useMemo(() => createFishGeometry(), [])
  const birdGeo = useMemo(() => createBirdGeometry(), [])

  useEffect(
    () => () => {
      fishGeo.dispose()
      birdGeo.dispose()
    },
    [birdGeo, fishGeo],
  )

  useLayoutEffect(() => {
    if (fish.current) {
      writeOrientedInstances(fish.current, fishPos, fishCount, (i) => {
        const x = fishPos[i * 3] ?? 0
        const z = fishPos[i * 3 + 2] ?? 0
        const scale = 0.13 + (i % 5) * 0.009
        return { scale: [scale, scale, scale], rotation: [0, Math.atan2(-x, -z), (i % 3 - 1) * 0.04] }
      })
    }
    if (birds.current) {
      writeOrientedInstances(birds.current, birdPos, birdCount, (i) => {
        const x = birdPos[i * 3] ?? 0
        const z = birdPos[i * 3 + 2] ?? 0
        const scale = 0.18 + (i % 4) * 0.014
        return { scale: [scale, scale, scale], rotation: [0, Math.atan2(-x, -z), (i % 5 - 2) * 0.055] }
      })
    }
  }, [birdCount, birdPos, fishCount, fishPos])

  useStoryFrame((seconds) => {
    const t = clock.reducedMotion ? 0 : seconds
    if (fish.current) {
      fish.current.visible = fishStrength > 0.04
      fish.current.rotation.y = t * 0.12
    }
    if (birds.current) {
      birds.current.visible = birdStrength > 0.04
      birds.current.rotation.y = t * 0.08
    }
    if (heroFish.current) {
      heroFish.current.position.y = -0.08 + Math.sin(t * 0.8) * 0.06
      heroFish.current.rotation.y = Math.sin(t * 0.18) * 0.2
      heroFish.current.scale.setScalar(Math.max(0.001, fishStrength))
      heroFish.current.visible = fishStrength > 0.05
    }
    if (heroBirds.current) {
      heroBirds.current.position.y = 0.65 + Math.sin(t * 0.65) * 0.08
      heroBirds.current.rotation.y = Math.sin(t * 0.15) * 0.18
      heroBirds.current.scale.setScalar(Math.max(0.001, birdStrength))
      heroBirds.current.visible = birdStrength > 0.05
    }
  })

  if (fishStrength <= 0 && birdStrength <= 0) return null

  return (
    <group>
      <instancedMesh ref={fish} args={[fishGeo, undefined, fishCount]} position={[0, -0.55, 0]}>
        <meshStandardMaterial color="#6f9cad" roughness={0.48} metalness={0.04} flatShading />
      </instancedMesh>
      <instancedMesh ref={birds} args={[birdGeo, undefined, birdCount]} position={[0, 1.6, 0]}>
        <meshStandardMaterial color="#c9ad7d" roughness={0.72} flatShading side={DoubleSide} />
      </instancedMesh>
      <group ref={heroFish} position={[0, -0.08, 0.65]}>
        {[-0.95, 0, 0.95].map((x, index) => (
          <HeroFish
            key={x}
            index={index}
            reducedMotion={clock.reducedMotion}
            position={[x, index * 0.18 - 0.12, 1.25 + (index % 2) * 0.32]}
            rotation={[0, index % 2 ? 0.25 : -0.2, (index - 2) * 0.05]}
            scale={0.48 + index * 0.035}
          />
        ))}
      </group>
      <group ref={heroBirds} position={[0, 0.65, 0.25]}>
        {[-1.05, 0, 1.05].map((x, index) => (
          <HeroBird
            key={x}
            index={index}
            reducedMotion={clock.reducedMotion}
            position={[x, 0.58 + (index % 3) * 0.34, 0.35 + (index % 2) * 0.34]}
            rotation={[index % 2 ? 0.48 : -0.42, index % 2 ? 0.22 : -0.2, (index - 2) * 0.04]}
            scale={0.48 + index * 0.04}
          />
        ))}
      </group>
    </group>
  )
}

function HeroFish({
  index,
  reducedMotion,
  position,
  rotation,
  scale,
}: {
  index: number
  reducedMotion: boolean
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}) {
  const root = useRef<Group>(null)
  const { scene } = useGLTF('/models/genesis/fish.glb', false, false)
  const model = useMemo(() => scene.clone(true), [scene])
  const tail = useMemo(() => model.getObjectByName('Tail'), [model])
  const dorsal = useMemo(() => model.getObjectByName('DorsalFin'), [model])
  const leftFin = useMemo(() => model.getObjectByName('Pectoral1'), [model])
  const rightFin = useMemo(() => model.getObjectByName('Pectoral-1'), [model])
  useStoryFrame((seconds) => {
    const t = reducedMotion ? 0 : seconds
    const phase = index * 1.37
    const stroke = Math.sin(t * 4.2 + phase)
    if (root.current) {
      root.current.position.x = position[0] + Math.sin(t * 0.34 + phase) * 0.24
      root.current.position.y = position[1] + Math.sin(t * 0.72 + phase) * 0.055
      root.current.position.z = position[2] + Math.cos(t * 0.28 + phase) * 0.18
      root.current.rotation.set(
        rotation[0] + stroke * 0.045,
        rotation[1] + Math.cos(t * 0.34 + phase) * 0.16,
        rotation[2] + Math.cos(t * 2.1 + phase) * 0.035,
      )
    }
    if (tail) tail.rotation.y = stroke * 0.42
    if (dorsal) dorsal.rotation.y = stroke * 0.045
    if (leftFin) leftFin.rotation.x = -0.16 + Math.sin(t * 3.2 + phase) * 0.12
    if (rightFin) rightFin.rotation.x = 0.16 - Math.sin(t * 3.2 + phase) * 0.12
  })
  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

function HeroBird({
  index,
  reducedMotion,
  position,
  rotation,
  scale,
}: {
  index: number
  reducedMotion: boolean
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}) {
  const root = useRef<Group>(null)
  const { scene } = useGLTF('/models/genesis/bird.glb', false, false)
  const model = useMemo(() => scene.clone(true), [scene])
  const leftWing = useMemo(() => model.getObjectByName('LeftWing'), [model])
  const rightWing = useMemo(() => model.getObjectByName('RightWing'), [model])
  const tail = useMemo(() => model.getObjectByName('TailFeather4'), [model])
  useStoryFrame((seconds) => {
    const t = reducedMotion ? 0 : seconds
    const phase = index * 1.61
    // Wing motion has a brief glide at the top of each beat, instead of a
    // symmetrical metronome flap. With reduced motion t is exactly zero.
    const wingBeat = Math.sin(t * 3.15 + phase)
    const flap = wingBeat > 0 ? wingBeat * wingBeat * 0.62 : wingBeat * 0.26
    if (leftWing) leftWing.rotation.x = -0.12 + flap
    if (rightWing) rightWing.rotation.x = 0.12 - flap
    if (tail) tail.rotation.y = Math.sin(t * 1.1 + phase) * 0.07
    if (root.current) {
      root.current.position.x = position[0] + Math.cos(t * 0.24 + phase) * 0.25
      root.current.position.y = position[1] + Math.sin(t * 0.42 + phase) * 0.12
      root.current.position.z = position[2] + Math.sin(t * 0.2 + phase) * 0.2
      root.current.rotation.set(
        rotation[0] + Math.sin(t * 0.42 + phase) * 0.06,
        rotation[1] + Math.sin(t * 0.22 + phase) * 0.17,
        rotation[2] + Math.cos(t * 0.22 + phase) * 0.08,
      )
    }
  })
  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      <primitive object={model} />
    </group>
  )
}
