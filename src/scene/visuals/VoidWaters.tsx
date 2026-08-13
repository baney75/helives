import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Points } from 'three'
import { AdditiveBlending } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { fillSphere } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'

export function VoidWaters({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.beginning, clock.presence.day2 * 0.35)
  const points = useRef<Points>(null)
  const count = BUDGET[clock.quality].void
  const positions = useMemo(() => fillSphere(count, 6.2, 19), [count])

  useFrame(({ clock: r3f }) => {
    if (!points.current) return
    points.current.visible = strength > 0.03
    points.current.scale.setScalar(0.85 + clock.scale * 0.18)
    if (!clock.reducedMotion) points.current.rotation.y = r3f.elapsedTime * 0.04
  })

  if (strength <= 0) return null

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#4a6a8a"
        transparent
        opacity={0.55 * strength}
        sizeAttenuation
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
