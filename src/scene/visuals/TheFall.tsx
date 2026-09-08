import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, ExtrudeGeometry, type Group, Float32BufferAttribute, Shape, Vector3 } from 'three'
import { createScaleTexture } from '../models/natural.ts'
import { createSerpentHeadGeometry } from '../models/creatures.ts'
import { EDEN, edenPairStory, fallFruitStory, knowledgeFruitWorld, serpentPoints } from '../models/eden.ts'
import { createTaperedTube } from '../models/geometry.ts'
import { AppleFruit } from '../models/Trees.tsx'
import type { SceneClock } from '../types.ts'

export function TheFall({ clock }: { clock: SceneClock }) {
  const strength = clock.presence.fall
  const { beat } = edenPairStory(clock.progress)
  const nextScene = Math.max(clock.presence.closing, clock.presence.doubt, clock.presence.measure)
  const storyStrength = strength * (1 - nextScene)
  if (storyStrength <= 0) return null

  return (
    <group position={EDEN.origin} visible={storyStrength > 0.04}>
      <Serpent strength={storyStrength} beat={beat} reducedMotion={clock.reducedMotion} />
      <TakenFruit strength={storyStrength} beat={beat} reducedMotion={clock.reducedMotion} />
      <EastFlame strength={storyStrength} beat={beat} reducedMotion={clock.reducedMotion} />
      <pointLight position={[0.2, 2.8, 3.4]} intensity={0.68 * storyStrength} color="#b7c9d7" distance={7.5} decay={2} />
      <pointLight position={[1.05, 2.45, 1.22]} intensity={2.1 * storyStrength} color="#edab5c" distance={5.2} decay={2} />
    </group>
  )
}

function Serpent({ strength, beat, reducedMotion }: { strength: number; beat: number; reducedMotion: boolean }) {
  const mesh = useRef<Group>(null)
  const head = useRef<Group>(null)
  const tongue = useRef<Group>(null)
  const scaleMap = useMemo(() => createScaleTexture(), [])
  const headGeometry = useMemo(() => createSerpentHeadGeometry(), [])
  const geometry = useMemo(() => {
    const points = serpentPoints(2.85, 56).map((p) => new Vector3(...p))
    const fruit = knowledgeFruitWorld()
    points[points.length - 1] = new Vector3(fruit[0] + 0.24, fruit[1] + 0.23, fruit[2] - 0.08)
    const body = createTaperedTube(points, 0.014, 0.045, 20)
    const count = body.getAttribute('position').count
    const uv = Array.from({ length: count }, (_, i) => [(i % 20) / 20, Math.floor(i / 20) / (count / 20 - 1) * 10]).flat()
    body.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    return body
  }, [])
  useEffect(() => () => { geometry.dispose(); headGeometry.dispose(); scaleMap.dispose() }, [geometry, headGeometry, scaleMap])

  const fruit = knowledgeFruitWorld()

  useStoryFrame((seconds) => {
    if (!mesh.current) return
    mesh.current.visible = strength > 0.05
    const t = reducedMotion ? 0 : seconds
    if (!reducedMotion) {
      mesh.current.rotation.y = Math.sin(t * 0.38) * 0.05
      mesh.current.position.y = Math.sin(t * 0.9) * 0.012
    }
    if (head.current) {
      if (!reducedMotion) head.current.rotation.z = Math.sin(t * 1.05) * 0.1
    }
    if (tongue.current) {
      const flick = reducedMotion ? 0.35 : 0.18 + Math.max(0, Math.sin(t * 5.4)) * 0.82
      tongue.current.scale.x = beat < 0.4 ? flick : flick * 0.55
    }
  })

  return (
    <group ref={mesh}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          map={scaleMap}
          color="#45482c"
          roughness={0.46}
          metalness={0.05}
          emissive="#211b0c"
          emissiveIntensity={0.025}
          clearcoat={0.32}
          clearcoatRoughness={0.46}
        />
      </mesh>
      <group ref={head} position={[fruit[0] + 0.24, fruit[1] + 0.23, fruit[2] - 0.08]} rotation={[0.02, -0.45, -0.08]} scale={0.88}>
        <mesh geometry={headGeometry} rotation={[0, 0.08, 0]}>
          <meshPhysicalMaterial color="#272718" roughness={0.52} clearcoat={0.18} clearcoatRoughness={0.38} />
        </mesh>
        <mesh position={[0.083, 0.024, 0.046]}>
          <sphereGeometry args={[0.016, 10, 8]} />
          <meshStandardMaterial color="#d8c46f" emissive="#b88932" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0.083, 0.024, -0.041]}>
          <sphereGeometry args={[0.016, 10, 8]} />
          <meshStandardMaterial color="#d8c46f" emissive="#b88932" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0.098, 0.024, 0.048]} scale={[0.35, 1.1, 0.3]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#07060a" />
        </mesh>
        <mesh position={[0.098, 0.024, -0.043]} scale={[0.35, 1.1, 0.3]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#07060a" />
        </mesh>
        <group ref={tongue} position={[0.145, -0.012, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.08, 6]} />
            <meshStandardMaterial color="#6d1717" roughness={0.62} />
          </mesh>
          {[-0.012, 0.012].map((z) => (
            <mesh key={z} position={[0.055, 0, z]} rotation={[z > 0 ? 0.25 : -0.25, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.003, 0.002, 0.06, 6]} />
              <meshStandardMaterial color="#7d1d1d" roughness={0.62} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

function TakenFruit({
  beat,
  reducedMotion,
}: {
  strength: number
  beat: number
  reducedMotion: boolean
}) {
  const fruit = knowledgeFruitWorld()
  const root = useRef<Group>(null)

  useStoryFrame((seconds) => {
    const group = root.current
    if (!group) return
    const story = fallFruitStory(beat)
    const { from, to, phase } = story
    group.visible = story.visible
    group.position.set(
      from[0] + (to[0] - from[0]) * phase,
      from[1] + (to[1] - from[1]) * phase + (reducedMotion ? 0 : Math.sin(phase * Math.PI) * 0.1),
      from[2] + (to[2] - from[2]) * phase,
    )
    group.scale.setScalar(story.eatenScale)
    if (!reducedMotion) group.rotation.y = seconds * 0.7
  })
  return (
    <group ref={root} position={fruit}>
      <AppleFruit scale={0.75} glow={0.015} />
    </group>
  )
}

function EastFlame({ strength, beat, reducedMotion }: { strength: number; beat: number; reducedMotion: boolean }) {
  const flame = EDEN.east.flame
  const guard = useRef<Group>(null)
  const fire = useRef<Group>(null)
  const outer = useMemo(() => createFlameGeometry(0.18, 1.35, -0.09), [])
  const middle = useMemo(() => createFlameGeometry(0.12, 1.08, 0.08), [])
  const core = useMemo(() => createFlameGeometry(0.065, 0.78, -0.04), [])
  const reveal = Math.min(1, Math.max(0, (beat - 0.68) / 0.12))

  useEffect(() => () => { outer.dispose(); middle.dispose(); core.dispose() }, [core, middle, outer])

  useStoryFrame((seconds) => {
    if (!guard.current) return
    const t = reducedMotion ? 0 : seconds
    guard.current.rotation.y = -0.22 + (reducedMotion ? 0 : Math.sin(t * 0.72) * 0.09)
    if (fire.current) {
      fire.current.scale.y = 0.95 + (reducedMotion ? 0 : Math.sin(t * 4.1) * 0.055)
      fire.current.rotation.y = reducedMotion ? 0 : Math.sin(t * 1.3) * 0.08
    }
  })

  return (
    <group
      ref={guard}
      position={flame}
      scale={0.72 * reveal}
      visible={strength > 0.18 && reveal > 0.02}
    >
      <group ref={fire}>
        <FlameTongue geometry={outer} color="#bd4a22" opacity={0.72 * strength} />
        <FlameTongue geometry={middle} color="#e89538" opacity={0.78 * strength} position={[0.012, 0.03, 0.028]} />
        <FlameTongue geometry={core} color="#fff0ad" opacity={0.86 * strength} position={[-0.006, 0.05, 0.055]} />
      </group>
      <pointLight position={[0, 0.86, 0.08]} intensity={0.68 * strength * reveal} color="#e89442" distance={3.6} />
    </group>
  )
}

function FlameTongue({ geometry, color, opacity, position = [0, 0, 0] }: {
  geometry: ExtrudeGeometry
  color: string
  opacity: number
  position?: [number, number, number]
}) {
  return <mesh geometry={geometry} position={position}>
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0.75}
      transparent
      opacity={opacity}
      blending={AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  </mesh>
}

function createFlameGeometry(width: number, height: number, lean: number): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-width * 0.78, height * 0.16, -width, height * 0.43, -width * 0.42 + lean, height * 0.66)
  shape.bezierCurveTo(-width * 0.12 + lean, height * 0.86, lean * 1.12, height, lean, height * 1.06)
  shape.bezierCurveTo(width * 0.35 + lean, height * 0.77, width * 0.72, height * 0.44, width * 0.48, height * 0.2)
  shape.quadraticCurveTo(width * 0.22, height * 0.05, 0, 0)
  return new ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 })
}
