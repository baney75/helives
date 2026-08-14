import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3, type Mesh } from 'three'
import { Figure } from '../models/Figure.tsx'
import { EDEN, knowledgeFruitWorld, serpentPoints } from '../models/eden.ts'
import { createTaperedTube } from '../models/geometry.ts'
import type { SceneClock } from '../types.ts'

export function TheFall({ clock }: { clock: SceneClock }) {
  const strength = clock.presence.fall
  if (strength <= 0) return null

  const leave = Math.min(1, Math.max(0, (strength - 0.22) / 0.5))

  return (
    <group position={EDEN.origin} visible={strength > 0.04}>
      <Serpent strength={strength} reducedMotion={clock.reducedMotion} />
      <TakenFruit strength={strength} />
      <Figure role="man" pose="depart" position={EDEN.man.depart} rotationY={Math.PI + 0.55} fade={leave} />
      <Figure
        role="woman"
        pose="depart"
        position={EDEN.woman.depart}
        rotationY={Math.PI + 0.35}
        fade={leave}
        holdFruit={strength > 0.35}
        fruitColor={EDEN.knowledge.fruitColor}
      />
      <EastFlame strength={strength} />
      <pointLight position={[1.2, 1.7, 1.4]} intensity={1.6 * strength} color="#ffe7b8" distance={8} />
    </group>
  )
}

function Serpent({ strength, reducedMotion }: { strength: number; reducedMotion: boolean }) {
  const mesh = useRef<Mesh>(null)
  const head = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const pts = serpentPoints(2.7, 36).map((p) => new Vector3(...p))
    return createTaperedTube(pts, 0.085, 0.032, 9)
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const fruit = knowledgeFruitWorld()

  useFrame(({ clock: r3f }) => {
    if (!mesh.current) return
    mesh.current.visible = strength > 0.05
    if (!reducedMotion) mesh.current.rotation.y = Math.sin(r3f.elapsedTime * 0.28) * 0.03
    if (head.current && !reducedMotion) {
      head.current.rotation.z = Math.sin(r3f.elapsedTime * 0.9) * 0.08
    }
  })

  return (
    <group>
      <mesh ref={mesh} geometry={geometry}>
        <meshStandardMaterial color="#1e1a14" roughness={0.38} metalness={0.12} />
      </mesh>
      <group position={[fruit[0] - 0.05, fruit[1] + 0.1, fruit[2] + 0.05]} rotation={[0.15, -0.85, 0]}>
        <mesh ref={head} scale={[1.35, 0.62, 0.62]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#2a2418" roughness={0.36} />
        </mesh>
        <mesh position={[0.08, 0.02, 0.035]}>
          <sphereGeometry args={[0.014, 6, 6]} />
          <meshStandardMaterial color="#e8b86d" emissive="#e8b86d" emissiveIntensity={0.85} />
        </mesh>
        <mesh position={[0.08, 0.02, -0.03]}>
          <sphereGeometry args={[0.014, 6, 6]} />
          <meshStandardMaterial color="#e8b86d" emissive="#e8b86d" emissiveIntensity={0.85} />
        </mesh>
      </group>
    </group>
  )
}

function TakenFruit({ strength }: { strength: number }) {
  const fruit = knowledgeFruitWorld()
  return (
    <group>
      <mesh position={[fruit[0] - 0.22, fruit[1] - 0.28, fruit[2] + 0.18]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial
          color="#6a2018"
          roughness={0.4}
          emissive="#3a0c08"
          emissiveIntensity={0.22 + strength * 0.28}
        />
      </mesh>
      <pointLight
        position={[fruit[0], fruit[1], fruit[2]]}
        intensity={1.7 * strength}
        color="#c45a3a"
        distance={7}
      />
    </group>
  )
}

function EastFlame({ strength }: { strength: number }) {
  const flame = EDEN.east.flame
  return (
    <group position={flame} visible={strength > 0.18}>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.018, 0.045, 1.85, 6]} />
        <meshStandardMaterial
          color="#e8b86d"
          emissive="#fff4d6"
          emissiveIntensity={1.1 + strength * 0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <coneGeometry args={[0.06, 0.45, 6]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[0, 0.6, 0]}>
        <planeGeometry args={[0.16, 2.1]} />
        <meshBasicMaterial color="#e8b86d" transparent opacity={0.35 * strength} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} intensity={2.6 * strength} color="#e8b86d" distance={9} />
    </group>
  )
}
