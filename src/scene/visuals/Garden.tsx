import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, ExtrudeGeometry, Shape, Vector3 } from 'three'
import { Figure, type FigurePoseId } from '../models/Figure.tsx'
import { EDEN } from '../models/eden.ts'
import { Grove, Herbs, TreeOfKnowledge, TreeOfLife } from '../models/Trees.tsx'
import type { SceneClock } from '../types.ts'

export function Garden({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.garden, clock.presence.day6 * 0.45)
  const fall = clock.presence.fall
  const pairFade = 1 - Math.min(1, Math.max(0, (fall - 0.78) / 0.22))
  const womanPose: FigurePoseId = fall > 0.45 ? 'eat' : fall > 0.12 ? 'reach' : 'stand'
  const manPose: FigurePoseId = fall > 0.28 ? 'offer' : 'stand'

  if (strength <= 0) return null

  return (
    <group position={EDEN.origin} visible={strength > 0.04}>
      <PlantedGround fall={fall} />
      <River />
      <TreeOfLife fall={fall} quality={clock.quality} />
      <TreeOfKnowledge fall={fall} quality={clock.quality} />
      <Grove quality={clock.quality} fall={fall} />
      <Herbs quality={clock.quality} />
      <Figure
        role="man"
        pose={manPose}
        position={EDEN.man.garden}
        rotationY={Math.PI + 0.42}
        fade={pairFade * strength}
      />
      <Figure
        role="woman"
        pose={womanPose}
        position={fall > 0.1 ? EDEN.woman.reach : EDEN.woman.garden}
        rotationY={Math.PI - 0.42}
        fade={pairFade * strength}
        holdFruit={fall > 0.18}
        fruitColor={EDEN.knowledge.fruitColor}
      />
    </group>
  )
}

function PlantedGround({ fall }: { fall: number }) {
  const soil = fall > 0.4 ? '#3a2a18' : '#2c3d22'
  const bed = fall > 0.4 ? '#2a2214' : '#35502a'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[EDEN.groundRadius, 48]} />
        <meshStandardMaterial color={soil} roughness={0.94} />
      </mesh>
      <mesh position={[-1.7, 0.035, 1.35]} rotation={[-Math.PI / 2, 0, 0.35]}>
        <planeGeometry args={[1.35, 0.7]} />
        <meshStandardMaterial color={bed} roughness={0.9} />
      </mesh>
      <mesh position={[2.05, 0.035, -1.15]} rotation={[-Math.PI / 2, 0, -0.4]}>
        <planeGeometry args={[1.2, 0.62]} />
        <meshStandardMaterial color={bed} roughness={0.9} />
      </mesh>
      <mesh position={[-2.2, 0.035, -1.4]} rotation={[-Math.PI / 2, 0, 0.15]}>
        <planeGeometry args={[0.95, 0.55]} />
        <meshStandardMaterial color={bed} roughness={0.9} />
      </mesh>
    </group>
  )
}

function River() {
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

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#3a6a88"
        roughness={0.22}
        metalness={0.18}
        emissive="#1a3044"
        emissiveIntensity={0.2}
      />
    </mesh>
  )
}
