import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Points } from 'three'
import { AdditiveBlending } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { fillSphere } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'

export function VoidWaters({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.beginning, clock.presence.day2 * 0.35)
  const points = useRef<Points>(null)
  const waters = useRef<Group>(null)
  const count = BUDGET[clock.quality].void
  const positions = useMemo(() => fillSphere(count, 6.2, 19), [count])
  const segs = clock.quality === 'low' ? 24 : 40

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
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.4, segs]} />
          <meshStandardMaterial
            color="#0c1420"
            roughness={0.18}
            metalness={0.22}
            transparent
            opacity={0.72 * strength}
          />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial
            color="#fff4d6"
            transparent
            opacity={0.22 * strength}
            toneMapped={false}
          />
        </mesh>
        <pointLight position={[0, 0.6, 0]} intensity={1.4 * strength} color="#c9d6ea" distance={10} />
      </group>
    </group>
  )
}
