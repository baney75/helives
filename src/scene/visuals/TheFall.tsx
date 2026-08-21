import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, type BufferGeometry, Vector3, type Group } from 'three'
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
  const geometry = useMemo(() => {
    const pts = serpentPoints(2.7, 36).map((p) => new Vector3(...p))
    return createTaperedTube(pts, 0.085, 0.032, 9)
  }, [])
  const dorsal = useMemo(() => {
    const pts = serpentPoints(2.7, 36).map((p) => new Vector3(p[0], p[1] + 0.055, p[2]))
    return createTaperedTube(pts, 0.018, 0.006, 7)
  }, [])
  const bodyBase = useMemo(() => Float32Array.from(geometry.getAttribute('position').array), [geometry])
  const dorsalBase = useMemo(() => Float32Array.from(dorsal.getAttribute('position').array), [dorsal])

  useEffect(
    () => () => {
      geometry.dispose()
      dorsal.dispose()
    },
    [dorsal, geometry],
  )

  const fruit = knowledgeFruitWorld()

  useFrame(({ clock: r3f }) => {
    if (!mesh.current) return
    mesh.current.visible = strength > 0.05
    const t = reducedMotion ? 0 : r3f.elapsedTime
    if (!reducedMotion) {
      mesh.current.rotation.y = Math.sin(t * 0.42) * 0.045
      animateTube(geometry, bodyBase, t, 0.018)
      animateTube(dorsal, dorsalBase, t + 0.08, 0.014)
    }
    if (head.current && !reducedMotion) {
      head.current.rotation.z = Math.sin(t * 1.15) * 0.1
      head.current.position.y = fruit[1] - 0.1 + Math.sin(t * 0.85) * 0.035
      head.current.position.x = fruit[0] - 0.27 - Math.sin(Math.min(1, beat / 0.34) * Math.PI) * 0.1
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
          color="#202719"
          roughness={0.4}
          metalness={0.06}
          emissive="#29220f"
          emissiveIntensity={0.12 + strength * 0.12}
          clearcoat={0.32}
          clearcoatRoughness={0.46}
        />
      </mesh>
      <mesh geometry={dorsal}>
        <meshStandardMaterial color="#77613a" emissive="#3a2b13" emissiveIntensity={0.16} roughness={0.54} />
      </mesh>
      <group ref={head} position={[fruit[0] - 0.27, fruit[1] - 0.1, fruit[2] + 0.42]} rotation={[0.02, -0.45, -0.08]} scale={1.3}>
        <mesh scale={[1.25, 0.68, 0.88]}>
          <dodecahedronGeometry args={[0.1, 1]} />
          <meshPhysicalMaterial color="#34301d" roughness={0.34} clearcoat={0.4} clearcoatRoughness={0.42} />
        </mesh>
        <mesh position={[0.075, -0.025, 0]} scale={[0.92, 0.4, 0.7]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshPhysicalMaterial color="#191c12" roughness={0.4} clearcoat={0.24} />
        </mesh>
        <mesh position={[0.083, 0.024, 0.046]} scale={[1, 1, 0.8]}>
          <sphereGeometry args={[0.017, 10, 8]} />
          <meshStandardMaterial color="#d8c46f" emissive="#b88932" emissiveIntensity={0.72} />
        </mesh>
        <mesh position={[0.083, 0.024, -0.041]} scale={[1, 1, 0.8]}>
          <sphereGeometry args={[0.017, 10, 8]} />
          <meshStandardMaterial color="#d8c46f" emissive="#b88932" emissiveIntensity={0.72} />
        </mesh>
        <mesh position={[0.098, 0.024, 0.048]} scale={[0.35, 1.1, 0.3]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#07060a" />
        </mesh>
        <mesh position={[0.098, 0.024, -0.043]} scale={[0.35, 1.1, 0.3]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#07060a" />
        </mesh>
        <mesh position={[0.13, -0.043, 0]} scale={[0.72, 0.06, 0.5]}>
          <sphereGeometry args={[0.075, 12, 8]} />
          <meshStandardMaterial color="#6d1717" roughness={0.68} />
        </mesh>
        {[-0.036, 0.036].map((z) => (
          <mesh key={z} position={[0.135, -0.055, z]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.006, 0.035, 7]} />
            <meshStandardMaterial color="#e9dfbd" roughness={0.4} />
          </mesh>
        ))}
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
  strength,
  beat,
  reducedMotion,
}: {
  strength: number
  beat: number
  reducedMotion: boolean
}) {
  const fruit = knowledgeFruitWorld()
  const root = useRef<Group>(null)

  useFrame(({ clock }) => {
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
    if (!reducedMotion) group.rotation.y = clock.elapsedTime * 1.2
  })
  return (
    <group ref={root} position={fruit}>
      <AppleFruit scale={0.68} glow={0.28 + strength * 0.34} />
      <pointLight intensity={0.52 * strength} color="#c45a3a" distance={2.4} />
    </group>
  )
}

function animateTube(geometry: BufferGeometry, base: Float32Array, time: number, amplitude: number): void {
  const position = geometry.getAttribute('position') as BufferAttribute
  for (let index = 0; index < position.count; index += 1) {
    const i3 = index * 3
    const x = base[i3] ?? 0
    const y = base[i3 + 1] ?? 0
    const z = base[i3 + 2] ?? 0
    const wave = Math.sin(time * 1.8 + y * 5.2) * amplitude
    position.setXYZ(index, x + wave, y, z + Math.cos(time * 1.55 + y * 4.6) * amplitude * 0.7)
  }
  position.needsUpdate = true
}

function EastFlame({ strength, beat, reducedMotion }: { strength: number; beat: number; reducedMotion: boolean }) {
  const flame = EDEN.east.flame
  const width = useThree((state) => state.size.width)
  const guard = useRef<Group>(null)
  const fire = useRef<Group>(null)
  const reveal = Math.min(1, Math.max(0, (beat - 0.68) / 0.12))

  useFrame(({ clock: r3f }) => {
    if (!guard.current) return
    const t = reducedMotion ? 0 : r3f.elapsedTime
    guard.current.rotation.y = -0.22 + Math.sin(t * 0.72) * 0.22
    guard.current.rotation.z = -0.08 + Math.sin(t * 0.48) * 0.035
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
        <boxGeometry args={[0.075, 1.3, 0.035]} />
        <meshStandardMaterial
          color="#ddd7c1"
          emissive="#9d6b35"
          emissiveIntensity={0.18 + strength * 0.16}
          roughness={0.28}
          metalness={0.36}
        />
      </mesh>
      <mesh position={[0, 1.76, 0.08]}>
        <coneGeometry args={[0.055, 0.18, 5]} />
        <meshStandardMaterial color="#ddd7c1" emissive="#9d6b35" emissiveIntensity={0.25} metalness={0.42} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.38, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 0.48, 10]} />
        <meshStandardMaterial color="#8a5a2b" emissive="#6f3f18" emissiveIntensity={0.25} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.045, 0.035, 0.34, 9]} />
        <meshStandardMaterial color="#51351f" roughness={0.72} />
      </mesh>
      <group ref={fire}>
        {[
          [-0.1, 0.92, 0.03, 0.22, '#d85d24'],
          [0.07, 1.2, -0.01, -0.14, '#f0a33e'],
          [-0.03, 1.5, 0.025, 0.08, '#ffe079'],
        ].map(([x, y, z, tilt, color], index) => (
          <mesh key={index} position={[x as number, y as number, z as number]} rotation={[0, 0, tilt as number]} scale={[0.055, 0.26 + index * 0.035, 0.045]}>
            <sphereGeometry args={[1, 12, 9]} />
            <meshBasicMaterial
              color={color as string}
              transparent
              opacity={(0.16 + index * 0.06) * strength}
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
