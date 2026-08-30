import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, Color, ExtrudeGeometry, type MeshPhysicalMaterial, Shape, Vector3 } from 'three'
import { Figure, type FigurePoseId } from '../models/Figure.tsx'
import { EDEN, edenPairStory, fallFruitStory, lerp3 } from '../models/eden.ts'
import { createPlantedIsland } from '../models/gardenTerrain.ts'
import { Grove, Herbs, TreeOfKnowledge, TreeOfLife } from '../models/Trees.tsx'
import type { SceneClock } from '../types.ts'

export function Garden({ clock }: { clock: SceneClock }) {
  const after = Math.max(clock.presence.closing, clock.presence.doubt, clock.presence.measure)
  const strength = Math.max(clock.presence.garden, clock.presence.day6 * 0.45) * (1 - after)
  const creationPair = Math.max(clock.presence.day6, clock.presence.day7 * 0.72) * (1 - clock.presence.garden)
  const fall = clock.presence.fall
  const { beat, leave, fade } = edenPairStory(clock.progress)
  const pairFade = fade
  const fruit = fallFruitStory(beat)
  const womanPose: FigurePoseId = leave > 0.2 ? 'depart' : fruit.holder === 'woman' ? 'eat' : beat > 0.06 ? 'reach' : 'stand'
  const manPose: FigurePoseId = leave > 0.2 ? 'depart' : fruit.holder === 'man' ? 'eat' : beat > 0.18 ? 'offer' : 'stand'
  const womanHome = beat > 0.06 ? EDEN.woman.reach : EDEN.woman.garden

  if (strength <= 0) return null

  return (
    <group position={EDEN.origin} visible={strength > 0.04}>
      {clock.quality !== 'low' ? (
        <ContactShadows
          position={[0, 0.05, 0.4]}
          scale={13}
          resolution={512}
          blur={2.8}
          opacity={0.52}
          far={3.2}
          color="#050308"
          frames={clock.reducedMotion ? 1 : Infinity}
        />
      ) : null}
      <PlantedGround fall={fall} />
      <River reducedMotion={clock.reducedMotion} />
      <TreeOfLife fall={fall} quality={clock.quality} reducedMotion={clock.reducedMotion} />
      <TreeOfKnowledge fall={fall} quality={clock.quality} fruitTaken={beat > 0.12} reducedMotion={clock.reducedMotion} />
      <Grove quality={clock.quality} fall={fall} reducedMotion={clock.reducedMotion} />
      <Herbs quality={clock.quality} />
      <Figure
        role="man"
        pose={manPose}
        position={creationPair > 0.08 ? [-0.42, 0, 1.82] : lerp3(EDEN.man.garden, EDEN.man.depart, leave)}
        rotationY={Math.PI + 0.42 + leave * 0.35}
        fade={Math.max(creationPair, pairFade * strength)}
        holdFruit={fruit.holder === 'man'}
        reducedMotion={clock.reducedMotion}
      />
      <Figure
        role="woman"
        pose={womanPose}
        position={creationPair > 0.08 ? [0.42, 0, 1.82] : lerp3(womanHome, EDEN.woman.depart, leave)}
        rotationY={Math.PI - 0.95 + leave * 0.55}
        fade={Math.max(creationPair, pairFade * strength)}
        holdFruit={fruit.holder === 'woman'}
        reducedMotion={clock.reducedMotion}
      />
    </group>
  )
}

function PlantedGround({ fall }: { fall: number }) {
  const island = useMemo(() => createPlantedIsland(), [])
  useEffect(() => () => island.dispose(), [island])
  const grass = new Color('#35502a').lerp(new Color('#352619'), fall * 0.82)
  const soil = new Color('#2a1c10').lerp(new Color('#1a120c'), fall * 0.5)
  const bed = new Color('#4a5c32').lerp(new Color('#3a2a16'), fall * 0.8)
  return (
    <group>
      <mesh geometry={island} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <meshStandardMaterial attach="material-0" color={grass} roughness={0.96} emissive="#10160d" emissiveIntensity={0.07} />
        <meshStandardMaterial attach="material-1" color={soil} roughness={0.98} />
      </mesh>
      <mesh position={[-1.7, 0.08, 1.35]} rotation={[-Math.PI / 2, 0, 0.35]}>
        <planeGeometry args={[1.35, 0.7]} />
        <meshStandardMaterial color={bed} roughness={0.96} />
      </mesh>
      <mesh position={[2.05, 0.08, -1.15]} rotation={[-Math.PI / 2, 0, -0.4]}>
        <planeGeometry args={[1.2, 0.62]} />
        <meshStandardMaterial color={bed} roughness={0.96} />
      </mesh>
      <mesh position={[-2.2, 0.08, -1.4]} rotation={[-Math.PI / 2, 0, 0.15]}>
        <planeGeometry args={[0.95, 0.55]} />
        <meshStandardMaterial color={bed} roughness={0.96} />
      </mesh>
      {EDEN.river.points.slice(0, -1).map((point, index) => (
        <mesh key={index} position={[point[0], 0.05, point[2]]} rotation={[-Math.PI / 2, 0, index * 0.2]}>
          <planeGeometry args={[0.72, 0.28]} />
          <meshStandardMaterial color="#3a4a28" roughness={0.97} />
        </mesh>
      ))}
    </group>
  )
}

function River({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<MeshPhysicalMaterial>(null)
  const geometry = useMemo(() => {
    const shape = new Shape()
    const half = EDEN.river.width / 2
    shape.moveTo(-half, 0)
    shape.lineTo(half, 0)
    shape.lineTo(half, 0.016)
    shape.lineTo(-half, 0.016)
    shape.closePath()
    const path = new CatmullRomCurve3(EDEN.river.points.map((p) => new Vector3(...p)))
    return new ExtrudeGeometry(shape, { steps: 48, bevelEnabled: false, extrudePath: path })
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock: r3f }) => {
    if (!material.current || reducedMotion) return
    material.current.emissiveIntensity = 0.05 + Math.sin(r3f.elapsedTime * 0.65) * 0.03
  })

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        ref={material}
        color="#1e3242"
        roughness={0.1}
        metalness={0.02}
        clearcoat={0.72}
        clearcoatRoughness={0.2}
        emissive="#132234"
        emissiveIntensity={0.06}
      />
    </mesh>
  )
}
