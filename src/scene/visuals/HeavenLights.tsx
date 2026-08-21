import { Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Points } from 'three'
import { AdditiveBlending, DoubleSide } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { fillSpiral } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'

export function HeavenLights({ clock }: { clock: SceneClock }) {
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const strength =
    (current === 'day4' ? clock.presence.day4 : current === 'day5' ? 0.16 : current === 'day7' ? 0.14 : 0) *
    (1 - garden)
  const points = useRef<Points>(null)
  const count = BUDGET[clock.quality].spiral
  const positions = useMemo(() => fillSpiral(count, 4.4, 128, 3), [count])

  useFrame(({ clock: r3f }) => {
    if (!points.current) return
    points.current.visible = strength > 0.04
    if (!clock.reducedMotion) points.current.rotation.y = r3f.elapsedTime * 0.035
  })

  if (strength <= 0) return null

  return (
    <group>
      <group position={[6.2, 3.4, -4.2]}>
        <mesh>
          <sphereGeometry args={[0.55, 20, 20]} />
          <meshBasicMaterial color="#fff1c2" toneMapped={false} />
        </mesh>
        <mesh rotation={[0.4, 0.2, 0]}>
          <ringGeometry args={[0.68, 0.86, 28]} />
          <meshBasicMaterial
            color="#e8b86d"
            side={DoubleSide}
            transparent
            opacity={0.55 * strength}
            toneMapped={false}
          />
        </mesh>
        <pointLight intensity={2.2 * strength} color="#fff4d6" distance={18} />
      </group>
      <group position={[-5.4, 2.6, -5.8]}>
        <mesh>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color="#dce6f5" emissive="#8aa0c4" emissiveIntensity={0.45} />
        </mesh>
        <mesh position={[0.12, 0.04, 0.08]}>
          <sphereGeometry args={[0.2, 14, 14]} />
          <meshStandardMaterial color="#07060a" roughness={1} />
        </mesh>
      </group>
      <points ref={points} position={[0, 1.4, 0]} rotation={[0.5, 0.2, 0.1]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={clock.quality === 'low' ? 0.034 : 0.022}
          color="#ffe7c2"
          transparent
          opacity={0.58 * strength}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <Stars
        radius={70}
        depth={36}
        count={BUDGET[clock.quality].stars}
        factor={2.6}
        saturation={0}
        fade
        speed={clock.reducedMotion ? 0 : 0.2}
      />
    </group>
  )
}
