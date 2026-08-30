import { useFrame } from '@react-three/fiber'
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

  useFrame(({ clock: r3f }) => {
    if (points.current) {
      points.current.visible = strength > 0.03
      points.current.scale.setScalar(0.85 + clock.scale * 0.18)
      if (!clock.reducedMotion) points.current.rotation.y = r3f.elapsedTime * 0.04
    }
    if (waters.current) {
      waters.current.visible = strength > 0.03
      const wave = clock.reducedMotion ? 0 : Math.sin(r3f.elapsedTime * 0.35) * 0.03
      waters.current.position.y = -1.15 + wave
      if (!clock.reducedMotion) waters.current.rotation.y = r3f.elapsedTime * 0.02
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
          size={0.03}
          color="#3a4258"
          transparent
          opacity={0.3 * strength}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      <group ref={waters}>
        <OceanSurface strength={strength} y={0} reducedMotion={clock.reducedMotion} quality={clock.quality} />
        <pointLight position={[0, 0.45, 0]} intensity={0.5 * strength} color="#6a7690" distance={12} />
      </group>
    </group>
  )
}
