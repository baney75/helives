import { useThree } from '@react-three/fiber'
import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, Float32BufferAttribute, Vector3 } from 'three'
import { createScaleTexture } from '../models/natural.ts'
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
      <pointLight position={[0.55, 1.32, 2.25]} intensity={1.25 * storyStrength} color="#d8e6ff" distance={6.5} />
      <pointLight position={[2.65, 1.05, 1.35]} intensity={1.45 * storyStrength} color="#f0a35e" distance={5.5} />
    </group>
  )
}

function Serpent({ strength, beat, reducedMotion }: { strength: number; beat: number; reducedMotion: boolean }) {
  const mesh = useRef<Group>(null)
  const head = useRef<Group>(null)
  const tongue = useRef<Group>(null)
  const scaleMap = useMemo(() => createScaleTexture(), [])
  const geometry = useMemo(() => {
    const points = serpentPoints(2.85, 56).map((p) => new Vector3(...p))
    const fruit = knowledgeFruitWorld()
    points[points.length - 1] = new Vector3(fruit[0] + 0.45, fruit[1] + 0.48, fruit[2] - 0.12)
    const body = createTaperedTube(points, 0.014, 0.045, 20)
    const count = body.getAttribute('position').count
    const uv = Array.from({ length: count }, (_, i) => [(i % 20) / 20, Math.floor(i / 20) / (count / 20 - 1) * 10]).flat()
    body.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    return body
  }, [])
  useEffect(() => () => { geometry.dispose(); scaleMap.dispose() }, [geometry, scaleMap])

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
          color="#77764e"
          roughness={0.52}
          metalness={0.08}
          emissive="#3a2e14"
          emissiveIntensity={0.04}
          clearcoat={0.42}
          clearcoatRoughness={0.4}
        />
      </mesh>
      <group ref={head} position={[fruit[0] + 0.45, fruit[1] + 0.48, fruit[2] - 0.12]} rotation={[0.02, -0.45, -0.08]} scale={0.72}>
        <mesh scale={[1.3, 0.62, 0.84]}>
          <sphereGeometry args={[0.1, 32, 20]} />
          <meshPhysicalMaterial color="#2c2816" roughness={0.62} clearcoat={0.12} clearcoatRoughness={0.38} />
        </mesh>
        <mesh position={[0.078, -0.02, 0]} scale={[0.95, 0.38, 0.68]}>
          <sphereGeometry args={[0.07, 24, 16]} />
          <meshPhysicalMaterial color="#16180f" roughness={0.4} />
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
  const width = useThree((state) => state.size.width)
  const guard = useRef<Group>(null)
  const fire = useRef<Group>(null)
  const reveal = Math.min(1, Math.max(0, (beat - 0.68) / 0.12))

  useStoryFrame((seconds) => {
    if (!guard.current) return
    const t = reducedMotion ? 0 : seconds
    guard.current.rotation.y = -0.22 + Math.sin(t * 0.72) * 0.18
    if (fire.current) {
      fire.current.scale.y = 0.9 + Math.sin(t * 4.1) * 0.1
      fire.current.rotation.y = Math.sin(t * 1.3) * 0.16
    }
  })

  return (
    <group
      ref={guard}
      position={width < 700 ? [2.2, 0, 1.15] : flame}
      scale={0.72 * reveal}
      visible={strength > 0.18 && reveal > 0.02}
    >
      <mesh position={[0, 1.04, 0.08]}>
        <boxGeometry args={[0.07, 1.35, 0.032]} />
        <meshStandardMaterial
          color="#ddd7c1"
          emissive="#9d6b35"
          emissiveIntensity={0.18 + strength * 0.16}
          roughness={0.28}
          metalness={0.36}
        />
      </mesh>
      <mesh position={[0, 1.78, 0.08]}>
        <coneGeometry args={[0.05, 0.2, 6]} />
        <meshStandardMaterial color="#ddd7c1" emissive="#9d6b35" emissiveIntensity={0.25} metalness={0.42} roughness={0.28} />
      </mesh>
      <group ref={fire}>
        {[
          [-0.08, 0.95, 0.03, 0.2, '#d85d24'],
          [0.06, 1.22, -0.01, -0.12, '#f0a33e'],
          [-0.02, 1.52, 0.02, 0.06, '#ffe079'],
        ].map(([x, y, z, tilt, color], index) => (
          <mesh key={index} position={[x as number, y as number, z as number]} rotation={[0, 0, tilt as number]} scale={[0.05, 0.28 + index * 0.04, 0.04]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial
              color={color as string}
              transparent
              opacity={(0.18 + index * 0.06) * strength}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 1.18, 0]} intensity={0.9 * strength * reveal} color="#e89442" distance={4} />
    </group>
  )
}

