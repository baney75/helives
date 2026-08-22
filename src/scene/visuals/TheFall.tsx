import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, InstancedMesh, Vector3 } from 'three'
import { writeOrientedInstances } from '../../lib/instances.ts'
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
      <Cherubim strength={storyStrength} beat={beat} />
      <pointLight position={[0.55, 1.32, 2.25]} intensity={1.25 * storyStrength} color="#d8e6ff" distance={6.5} />
      <pointLight position={[2.65, 1.05, 1.35]} intensity={1.45 * storyStrength} color="#f0a35e" distance={5.5} />
    </group>
  )
}

function Serpent({ strength, beat, reducedMotion }: { strength: number; beat: number; reducedMotion: boolean }) {
  const mesh = useRef<Group>(null)
  const head = useRef<Group>(null)
  const tongue = useRef<Group>(null)
  const scales = useRef<InstancedMesh>(null)
  const pts = useMemo(() => serpentPoints(2.85, 40).map((p) => new Vector3(...p)), [])
  const geometry = useMemo(() => createTaperedTube(pts, 0.09, 0.03, 8), [pts])
  const dorsal = useMemo(() => {
    const lifted = pts.map((p) => new Vector3(p.x, p.y + 0.05, p.z))
    return createTaperedTube(lifted, 0.02, 0.006, 6)
  }, [pts])
  const scalePos = useMemo(() => {
    const out = new Float32Array((pts.length - 2) * 3)
    for (let i = 1; i < pts.length - 1; i += 1) {
      const p = pts[i]
      if (!p) continue
      const i3 = (i - 1) * 3
      out[i3] = p.x
      out[i3 + 1] = p.y
      out[i3 + 2] = p.z
    }
    return out
  }, [pts])

  useEffect(
    () => () => {
      geometry.dispose()
      dorsal.dispose()
    },
    [dorsal, geometry],
  )

  useLayoutEffect(() => {
    if (!scales.current) return
    writeOrientedInstances(scales.current, scalePos, scalePos.length / 3, (i) => ({
      scale: [0.085, 0.035, 0.07],
      rotation: [0.4, i * 0.55, 0.15],
    }))
  }, [scalePos])

  const fruit = knowledgeFruitWorld()

  useFrame(({ clock: r3f }) => {
    if (!mesh.current) return
    mesh.current.visible = strength > 0.05
    const t = reducedMotion ? 0 : r3f.elapsedTime
    if (!reducedMotion) {
      mesh.current.rotation.y = Math.sin(t * 0.38) * 0.05
      mesh.current.position.y = Math.sin(t * 0.9) * 0.012
    }
    if (head.current) {
      const strike = Math.sin(Math.min(1, beat / 0.34) * Math.PI)
      head.current.position.set(fruit[0] - 0.24 - strike * 0.08, fruit[1] - 0.08 + Math.sin(t * 0.85) * 0.03, fruit[2] + 0.38)
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
          color="#202719"
          roughness={0.38}
          metalness={0.08}
          emissive="#3a2e14"
          emissiveIntensity={0.14 + strength * 0.12}
          clearcoat={0.42}
          clearcoatRoughness={0.4}
        />
      </mesh>
      <mesh geometry={dorsal}>
        <meshStandardMaterial color="#8a6a32" emissive="#3a2b13" emissiveIntensity={0.2} roughness={0.5} />
      </mesh>
      <instancedMesh ref={scales} args={[undefined, undefined, scalePos.length / 3]}>
        <sphereGeometry args={[1, 7, 5]} />
        <meshStandardMaterial color="#2c2818" roughness={0.36} metalness={0.12} emissive="#e8b86d" emissiveIntensity={0.08} />
      </instancedMesh>
      <group ref={head} position={[fruit[0] - 0.24, fruit[1] - 0.08, fruit[2] + 0.38]} rotation={[0.02, -0.45, -0.08]} scale={1.28}>
        <mesh scale={[1.3, 0.62, 0.84]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshPhysicalMaterial color="#2c2816" roughness={0.32} clearcoat={0.45} clearcoatRoughness={0.38} />
        </mesh>
        <mesh position={[0.078, -0.02, 0]} scale={[0.95, 0.38, 0.68]}>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshPhysicalMaterial color="#16180f" roughness={0.4} />
        </mesh>
        <mesh position={[0.083, 0.024, 0.046]}>
          <sphereGeometry args={[0.016, 10, 8]} />
          <meshStandardMaterial color="#d8c46f" emissive="#b88932" emissiveIntensity={0.72} />
        </mesh>
        <mesh position={[0.083, 0.024, -0.041]}>
          <sphereGeometry args={[0.016, 10, 8]} />
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
    if (!reducedMotion) group.rotation.y = clock.elapsedTime * 0.7
  })
  return (
    <group ref={root} position={fruit}>
      <AppleFruit scale={0.68} glow={0.28 + strength * 0.34} />
      <pointLight intensity={0.52 * strength} color="#c45a3a" distance={2.4} />
    </group>
  )
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

function Cherubim({ strength, beat }: { strength: number; beat: number }) {
  const reveal = Math.min(1, Math.max(0, (beat - 0.7) / 0.12))
  if (reveal <= 0.02) return null
  return (
    <group visible={strength > 0.18} scale={reveal}>
      <SeatedGuard position={[2.28, 0, 0.22]} yaw={-0.55} />
      <SeatedGuard position={[3.12, 0, 1.18]} yaw={0.35} />
    </group>
  )
}

function SeatedGuard({ position, yaw }: { position: [number, number, number]; yaw: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.28, 0.04]} rotation={[0.55, 0, 0]}>
        <boxGeometry args={[0.22, 0.34, 0.42]} />
        <meshStandardMaterial color="#161310" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.62, 0.02]}>
        <boxGeometry args={[0.34, 0.48, 0.2]} />
        <meshStandardMaterial color="#1b1712" roughness={0.94} />
      </mesh>
      <mesh position={[0, 0.96, 0.03]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#12100c" roughness={0.9} />
      </mesh>
    </group>
  )
}
