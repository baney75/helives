import { useStoryFrame } from '../StoryTime.tsx'
import { useMemo, useRef } from 'react'
import type { Group, Points } from 'three'
import { AdditiveBlending } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { fillSphere } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'
import { OceanSurface } from './OceanSurface.tsx'

export function VoidWaters({ clock }: { clock: SceneClock }) {
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const strength = Math.max(clock.presence.beginning, clock.presence.day2 * 0.92) * (1 - garden)
  const points = useRef<Points>(null)
  const waters = useRef<Group>(null)
  const count = BUDGET[clock.quality].void
  const positions = useMemo(() => fillSphere(count, 6.2, 19), [count])

  useStoryFrame((seconds) => {
    if (points.current) {
      points.current.visible = strength > 0.03
      points.current.scale.setScalar(0.85 + clock.scale * 0.18)
      if (!clock.reducedMotion) points.current.rotation.y = seconds * 0.04
    }
    if (waters.current) {
      waters.current.visible = strength > 0.03
      const wave = clock.reducedMotion ? 0 : Math.sin(seconds * 0.35) * 0.03
      waters.current.position.y = -1.15 + wave
      if (!clock.reducedMotion) waters.current.rotation.y = seconds * 0.02
    }
  })

  if (strength <= 0) return null

  return (
    <group>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color="#2a4058"
          transparent
          opacity={0.5 * strength}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      <group ref={waters}>
        <OceanSurface strength={strength} y={0} reducedMotion={clock.reducedMotion} quality={clock.quality} />
        <mesh position={[0, 0.12, -3.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 4.8, 96]} />
          <meshBasicMaterial color="#9cd9e5" transparent opacity={0.085 * strength} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        <pointLight position={[0, 0.45, 0]} intensity={1.1 * strength} color="#8aa0c4" distance={12} />
      </group>
    </group>
  )
}
