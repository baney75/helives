import { Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Points } from 'three'
import { AdditiveBlending } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { fillSpiral } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'

export function HeavenLights({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.day4, clock.presence.day5 * 0.35, clock.presence.day7 * 0.5)
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
      <mesh position={[6.2, 3.4, -4.2]}>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshBasicMaterial color="#fff1c2" toneMapped={false} />
      </mesh>
      <mesh position={[-5.4, 2.6, -5.8]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#dce6f5" emissive="#8aa0c4" emissiveIntensity={0.4} />
      </mesh>
      <points ref={points} position={[0, 1.4, 0]} rotation={[0.5, 0.2, 0.1]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={clock.quality === 'low' ? 0.04 : 0.03}
          color="#ffe7c2"
          transparent
          opacity={0.9 * strength}
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
