import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, Color, ExtrudeGeometry, type MeshPhysicalMaterial, Shape, Vector3 } from 'three'
import { Figure, type FigurePoseId } from '../models/Figure.tsx'
import { EDEN, edenPairStory, lerp3 } from '../models/eden.ts'
import { Grove, Herbs, TreeOfKnowledge, TreeOfLife } from '../models/Trees.tsx'
import type { SceneClock } from '../types.ts'

export function Garden({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.garden, clock.presence.day6 * 0.45)
  const creationPair = Math.max(clock.presence.day6, clock.presence.day7 * 0.72) * (1 - clock.presence.garden)
  const fall = clock.presence.fall
  const { beat, leave, fade } = edenPairStory(clock.progress)
  const pairFade = fade
  const womanPose: FigurePoseId = leave > 0.2 ? 'depart' : beat > 0.32 ? 'eat' : beat > 0.06 ? 'reach' : 'stand'
  const manPose: FigurePoseId = leave > 0.2 ? 'depart' : beat > 0.18 ? 'offer' : 'stand'
  const womanHome = beat > 0.06 ? EDEN.woman.reach : EDEN.woman.garden

  if (strength <= 0) return null

  return (
    <group position={EDEN.origin} visible={strength > 0.04}>
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
        reducedMotion={clock.reducedMotion}
      />
      <Figure
        role="woman"
        pose={womanPose}
        position={creationPair > 0.08 ? [0.42, 0, 1.82] : lerp3(womanHome, EDEN.woman.depart, leave)}
        rotationY={Math.PI - 0.42 + leave * 0.55}
        fade={Math.max(creationPair, pairFade * strength)}
        reducedMotion={clock.reducedMotion}
      />
    </group>
  )
}

function PlantedGround({ fall }: { fall: number }) {
  const soil = new Color('#2c3d22').lerp(new Color('#352619'), fall * 0.82)
  const bed = new Color('#35502a').lerp(new Color('#2c2114'), fall * 0.86)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[EDEN.groundRadius, 48]} />
        <meshStandardMaterial color={soil} roughness={0.98} emissive="#10160d" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[-1.7, 0.035, 1.35]} rotation={[-Math.PI / 2, 0, 0.35]}>
        <planeGeometry args={[1.35, 0.7]} />
        <meshStandardMaterial color={bed} roughness={0.96} />
      </mesh>
      <mesh position={[2.05, 0.035, -1.15]} rotation={[-Math.PI / 2, 0, -0.4]}>
        <planeGeometry args={[1.2, 0.62]} />
        <meshStandardMaterial color={bed} roughness={0.96} />
      </mesh>
      <mesh position={[-2.2, 0.035, -1.4]} rotation={[-Math.PI / 2, 0, 0.15]}>
        <planeGeometry args={[0.95, 0.55]} />
        <meshStandardMaterial color={bed} roughness={0.96} />
      </mesh>
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
    shape.lineTo(half, 0.035)
    shape.lineTo(-half, 0.035)
    shape.closePath()
    const path = new CatmullRomCurve3(EDEN.river.points.map((p) => new Vector3(...p)))
    return new ExtrudeGeometry(shape, { steps: 36, bevelEnabled: false, extrudePath: path })
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock: r3f }) => {
    if (!material.current || reducedMotion) return
    material.current.emissiveIntensity = 0.12 + Math.sin(r3f.elapsedTime * 0.65) * 0.045
  })

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        ref={material}
        color="#3a6a88"
        roughness={0.18}
        metalness={0.02}
        clearcoat={0.72}
        clearcoatRoughness={0.2}
        emissive="#1a3044"
        emissiveIntensity={0.14}
      />
    </mesh>
  )
}
