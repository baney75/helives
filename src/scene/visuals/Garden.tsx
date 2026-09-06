import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, type MeshPhysicalMaterial, Vector3 } from 'three'
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
        rotationY={Math.PI - 0.42 + leave * 0.55}
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

  return (
    <group>
      <mesh receiveShadow geometry={island} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <meshStandardMaterial attach="material-0" color={grass} roughness={0.96} emissive="#10160d" emissiveIntensity={0.07} />
        <meshStandardMaterial attach="material-1" color={soil} roughness={0.98} />
      </mesh>
    </group>
  )
}

function River({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<MeshPhysicalMaterial>(null)
  const geometry = useMemo(() => {
    const path = new CatmullRomCurve3(EDEN.river.points.map((p) => new Vector3(...p)))
    const positions: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= 96; i += 1) {
      const t = i / 96, p = path.getPoint(t), tangent = path.getTangent(t)
      const half = EDEN.river.width * (0.5 + Math.sin(t * 18) * 0.055)
      const length = Math.hypot(tangent.x, tangent.z)
      for (const side of [-1, 1]) positions.push(p.x - tangent.z / length * half * side, p.y + 0.012, p.z + tangent.x / length * half * side)
      if (i < 96) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    }
    const ribbon = new BufferGeometry()
    ribbon.setAttribute('position', new Float32BufferAttribute(positions, 3))
    ribbon.setIndex(indices)
    ribbon.computeVertexNormals()
    return ribbon
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
        color="#668579"
        roughness={0.18}
        metalness={0.28}
        clearcoat={0.72}
        clearcoatRoughness={0.2}
        emissive="#1a3044"
        emissiveIntensity={0.14}
      />
    </mesh>
  )
}
