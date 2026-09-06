import { Line, Sparkles } from '@react-three/drei'
import { useStoryFrame } from '../StoryTime.tsx'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, type Group, type Points } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { fillSphere } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'
import { sceneLocalProgress } from '../../genesis/time.ts'

export function LetThereBeLight({ clock }: { clock: SceneClock }) {
  const mesh = useRef<Group>(null)
  const motes = useRef<Points>(null)
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const strength = (current === 'day1' ? clock.presence.day1 : current === 'day2' ? 0.2 : 0) * (1 - garden)
  const expansion = current === 'day1' ? sceneLocalProgress(clock.progress) : 1
  const pulse = clock.reducedMotion ? 0 : 1
  const segs = clock.quality === 'low' ? 16 : 28
  const positions = useMemo(() => fillSphere(BUDGET[clock.quality].light, 2.8, 37), [clock.quality])
  const filaments = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2 + (index % 3) * 0.21
        const lift = ((index % 5) - 2) * 0.12
        return Array.from({ length: 9 }, (_unused, point) => {
          const radius = 0.1 + point * (0.25 + (index % 4) * 0.028)
          const curl = angle + point * (0.04 + (index % 2) * 0.025)
          return [
            -0.36 + Math.cos(curl) * radius,
            0.08 + lift * radius + Math.sin(point * 1.7 + index) * 0.045,
            Math.sin(curl) * radius * (0.72 + (index % 3) * 0.12),
          ] as [number, number, number]
        })
      }),
    [],
  )

  useStoryFrame((seconds) => {
    if (!mesh.current) return
    const s = 0.9 + strength * 0.28 + Math.sin(seconds * 1.4) * 0.025 * pulse
    mesh.current.scale.setScalar(s)
    if (motes.current && !clock.reducedMotion) motes.current.rotation.z = seconds * 0.035
  })

  if (strength <= 0) return null

  return (
    <group ref={mesh} visible={strength > 0.02}>
      <mesh position={[-0.36, 0.08, 0]}>
        <icosahedronGeometry args={[0.16, 4]} />
        <meshStandardMaterial color="#fff4d6" emissive="#e8b86d" emissiveIntensity={2.6} roughness={0.28} />
      </mesh>
      {filaments.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 3 === 0 ? '#9db6ff' : '#f2c97d'}
          lineWidth={clock.quality === 'high' ? 1.35 : 0.9}
          transparent
          opacity={(0.4 + (index % 4) * 0.06) * strength}
        />
      ))}
      {[0.72, 1.28, 2.05].map((radius, index) => (
        <mesh
          key={radius}
          position={[-0.36 + index * 0.13, 0.08 + index * 0.04, index * -0.1]}
          scale={[1.28 + index * 0.12, 0.78 + index * 0.08, 1]}
          rotation={[0.18 + index * 0.16, 0.32 + index * 0.53, 0.12]}
        >
          <sphereGeometry args={[radius, segs, segs]} />
          <meshBasicMaterial
            color={index === 0 ? '#fff4d6' : '#657fd2'}
            transparent
            side={BackSide}
            opacity={(0.025 - index * 0.0045) * strength * (0.45 + expansion * 0.55)}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <points ref={motes}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.018} color="#e8b86d" transparent opacity={0.72 * strength} depthWrite={false} blending={AdditiveBlending} />
      </points>
      <Sparkles
        count={BUDGET[clock.quality].sparkles}
        scale={10}
        size={5}
        speed={clock.reducedMotion ? 0 : 0.4}
        color="#ffe7b8"
        opacity={0.9 * strength}
      />
      <pointLight position={[-0.36, 0.08, 0]} intensity={4.2 * strength} color="#e8b86d" distance={16} />
    </group>
  )
}
