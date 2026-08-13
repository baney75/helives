import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3, type Mesh } from 'three'
import { Figure } from '../models/Figure.tsx'
import { EDEN, knowledgeFruitWorld, serpentPoints } from '../models/eden.ts'
import type { SceneClock } from '../types.ts'

export function TheFall({ clock }: { clock: SceneClock }) {
  const strength = clock.presence.fall
  if (strength <= 0) return null

  const leave = Math.min(1, Math.max(0, (strength - 0.28) / 0.55))

  return (
    <group position={EDEN.origin} visible={strength > 0.04}>
      <Serpent strength={strength} reducedMotion={clock.reducedMotion} />
      <TakenFruit strength={strength} />
      <Figure
        role="man"
        pose="depart"
        position={EDEN.man.depart}
        rotationY={1.15}
        fade={leave}
      />
      <Figure
        role="woman"
        pose="depart"
        position={EDEN.woman.depart}
        rotationY={1.05}
        fade={leave}
        holdFruit={strength > 0.4}
        fruitColor={EDEN.knowledge.fruitColor}
      />
      <EastFlame strength={strength} />
      <pointLight position={[2.6, 1.6, 1.6]} intensity={1.8 * strength} color="#fff4d6" distance={9} />
    </group>
  )
}

function Serpent({ strength, reducedMotion }: { strength: number; reducedMotion: boolean }) {
  const mesh = useRef<Mesh>(null)
  const head = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(serpentPoints().map((p) => new Vector3(...p)))
    return new TubeGeometry(curve, 48, 0.055, 8, false)
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const fruit = knowledgeFruitWorld()

  useFrame(({ clock: r3f }) => {
    if (!mesh.current) return
    mesh.current.visible = strength > 0.05
    if (!reducedMotion) mesh.current.rotation.y = Math.sin(r3f.elapsedTime * 0.35) * 0.04
    if (head.current && !reducedMotion) {
      head.current.rotation.z = Math.sin(r3f.elapsedTime * 1.1) * 0.12
    }
  })

  return (
    <group>
      <mesh ref={mesh} geometry={geometry}>
        <meshStandardMaterial color="#2a2418" roughness={0.42} metalness={0.08} />
      </mesh>
      <group position={[fruit[0] - 0.04, fruit[1] + 0.08, fruit[2] + 0.06]}>
        <mesh ref={head} rotation={[0.2, -0.6, 0]} scale={[1.15, 0.7, 0.7]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color="#3a3020" roughness={0.4} />
        </mesh>
        <mesh position={[0.05, 0.03, 0.04]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#e8b86d" emissive="#e8b86d" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.05, 0.03, -0.03]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#e8b86d" emissive="#e8b86d" emissiveIntensity={0.7} />
        </mesh>
      </group>
    </group>
  )
}

function TakenFruit({ strength }: { strength: number }) {
  const fruit = knowledgeFruitWorld()
  return (
    <group>
      <mesh position={[fruit[0] + 0.12, fruit[1] - 0.18, fruit[2] + 0.15]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial
          color="#6a2018"
          roughness={0.45}
          emissive="#3a0c08"
          emissiveIntensity={0.2 + strength * 0.25}
        />
      </mesh>
      <pointLight
        position={[fruit[0], fruit[1], fruit[2]]}
        intensity={1.5 * strength}
        color="#c45a3a"
        distance={7}
      />
    </group>
  )
}

function EastFlame({ strength }: { strength: number }) {
  const flame = EDEN.east.flame
  return (
    <group position={flame} visible={strength > 0.2}>
      <mesh position={[0, 0.85, 0]}>
        <coneGeometry args={[0.07, 1.7, 6]} />
        <meshStandardMaterial
          color="#e8b86d"
          emissive="#fff4d6"
          emissiveIntensity={0.8 + strength * 0.6}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[0, 0.7, 0]}>
        <coneGeometry args={[0.045, 1.35, 5]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} />
      </mesh>
      <mesh position={[-0.55, 0.7, -0.1]} rotation={[0, 0.2, 0]}>
        <planeGeometry args={[0.08, 1.5]} />
        <meshBasicMaterial color="#e8b86d" transparent opacity={0.28 * strength} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.1, 0]} intensity={2.2 * strength} color="#e8b86d" distance={8} />
    </group>
  )
}
