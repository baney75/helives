import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, type MeshBasicMaterial, type MeshPhysicalMaterial, Vector3 } from 'three'
import { Figure, type FigurePoseId } from '../models/Figure.tsx'
import { EDEN, edenPairStory, fallFruitStory, knowledgeFruitWorld, lerp3 } from '../models/eden.ts'
import { createGardenBedGeometry, createGardenRidgeGeometry, createPlantedIsland, createRiverGlintGeometry } from '../models/gardenTerrain.ts'
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
  const womanPose: FigurePoseId = leave > 0.2 ? 'depart' : fruit.holder === 'woman' ? 'eat' : beat > 0.06 && beat < 0.3 ? 'reach' : 'stand'
  const manPose: FigurePoseId = leave > 0.2 ? 'depart' : fruit.holder === 'man' ? 'eat' : beat > 0.3 && beat < 0.52 ? 'offer' : 'stand'
  const womanHome = lerp3(EDEN.woman.garden, EDEN.woman.reach, Math.min(1, Math.max(0, (beat - 0.06) / 0.06)))

  if (strength <= 0) return null

  return (
    <group position={EDEN.origin} visible={strength > 0.04}>
      <GardenHorizon fall={fall} />
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
        rotationY={Math.PI + 0.82 + leave * 0.35}
        fade={Math.max(creationPair, pairFade * strength)}
        holdFruit={fruit.holder === 'man'}
        reducedMotion={clock.reducedMotion}
      />
      <Figure
        role="woman"
        reachTarget={knowledgeFruitWorld()}
        pose={womanPose}
        position={creationPair > 0.08 ? [0.42, 0, 1.82] : lerp3(womanHome, EDEN.woman.depart, leave)}
        rotationY={Math.PI - 0.82 + leave * 0.55}
        fade={Math.max(creationPair, pairFade * strength)}
        holdFruit={fruit.holder === 'woman'}
        reducedMotion={clock.reducedMotion}
      />
    </group>
  )
}

function PlantedGround({ fall }: { fall: number }) {
  const island = useMemo(() => createPlantedIsland(), [])
  const beds = useMemo(() => createGardenBedGeometry(), [])
  useEffect(() => () => { island.dispose(); beds.dispose() }, [beds, island])
  const grass = new Color('#314a2a').lerp(new Color('#342619'), fall * 0.82)
  const soil = new Color('#2a1c10').lerp(new Color('#1a120c'), fall * 0.5)
  const bed = new Color('#554126').lerp(new Color('#29170f'), fall * 0.7)

  return (
    <group>
      <mesh receiveShadow geometry={island} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <meshStandardMaterial attach="material-0" color={grass} roughness={0.94} emissive="#111b10" emissiveIntensity={0.09} />
        <meshStandardMaterial attach="material-1" color={soil} roughness={0.98} />
      </mesh>
      <mesh receiveShadow geometry={beds}>
        <meshStandardMaterial color={bed} roughness={0.96} emissive="#160e08" emissiveIntensity={0.08} />
      </mesh>
    </group>
  )
}

function GardenHorizon({ fall }: { fall: number }) {
  const near = useMemo(() => createGardenRidgeGeometry(0.4), [])
  const far = useMemo(() => createGardenRidgeGeometry(2.1), [])
  useEffect(() => () => { near.dispose(); far.dispose() }, [far, near])
  const nearColor = new Color('#233822').lerp(new Color('#2b2118'), fall * 0.78)
  const farColor = new Color('#142518').lerp(new Color('#1d1713'), fall * 0.72)
  return (
    <group>
      <mesh geometry={far} position={[0, 0.08, -1.25]} scale={[1.16, 0.82, 1]}>
        <meshStandardMaterial color={farColor} roughness={1} emissive="#08100a" emissiveIntensity={0.16} />
      </mesh>
      <mesh geometry={near}>
        <meshStandardMaterial color={nearColor} roughness={0.98} emissive="#0d160d" emissiveIntensity={0.12} />
      </mesh>
    </group>
  )
}

function River({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<MeshPhysicalMaterial>(null)
  const glintMaterial = useRef<MeshBasicMaterial>(null)
  const riverbed = useMemo(() => {
    const path = new CatmullRomCurve3(EDEN.river.points.map((p) => new Vector3(...p)))
    return {
      water: createRiverRibbon(path, EDEN.river.width * 0.5, 0.016),
      margin: createRiverRibbon(path, EDEN.river.width * 0.5 + 0.16, 0.004),
      glints: createRiverGlintGeometry(EDEN.river.points),
      warmGlints: createRiverGlintGeometry(EDEN.river.points, true),
    }
  }, [])

  useEffect(() => () => { riverbed.water.dispose(); riverbed.margin.dispose(); riverbed.glints.dispose(); riverbed.warmGlints.dispose() }, [riverbed])

  useStoryFrame((seconds) => {
    if (!material.current || reducedMotion) return
    material.current.emissiveIntensity = 0.12 + Math.sin(seconds * 0.65) * 0.045
    if (glintMaterial.current) glintMaterial.current.opacity = 0.3 + Math.sin(seconds * 0.72) * 0.08
  })

  return (
    <group>
      <mesh geometry={riverbed.margin}>
        <meshStandardMaterial color="#263420" roughness={0.96} emissive="#0b120a" emissiveIntensity={0.12} />
      </mesh>
      <mesh geometry={riverbed.water}>
        <meshPhysicalMaterial
          ref={material}
          color="#376f78"
          roughness={0.1}
          metalness={0.08}
          clearcoat={0.86}
          clearcoatRoughness={0.14}
          emissive="#10394a"
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh geometry={riverbed.glints}>
        <meshBasicMaterial ref={glintMaterial} color="#d9e8cf" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <mesh geometry={riverbed.warmGlints}>
        <meshBasicMaterial color="#f0c46e" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
}

function createRiverRibbon(path: CatmullRomCurve3, width: number, y: number): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= 96; i += 1) {
    const t = i / 96, p = path.getPoint(t), tangent = path.getTangent(t)
    const half = width * (1 + Math.sin(t * 18) * 0.055)
    const length = Math.hypot(tangent.x, tangent.z)
    for (const side of [-1, 1]) positions.push(p.x - tangent.z / length * half * side, p.y + y, p.z + tangent.x / length * half * side)
    if (i < 96) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const ribbon = new BufferGeometry()
  ribbon.setAttribute('position', new Float32BufferAttribute(positions, 3))
  ribbon.setIndex(indices)
  ribbon.computeVertexNormals()
  return ribbon
}
