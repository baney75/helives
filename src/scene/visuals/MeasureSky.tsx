import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { DoubleSide, type Mesh } from 'three'
import type { SceneClock } from '../types.ts'

export function MeasureSky({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.doubt * 0.55, clock.presence.measure)
  const mesh = useRef<Mesh>(null)
  const band = useRef<Mesh>(null)
  const segs = clock.quality === 'low' ? 16 : 28

  useFrame(({ clock: r3f }) => {
    if (mesh.current) {
      mesh.current.visible = strength > 0.03
      const pulse = clock.reducedMotion ? 0 : Math.sin(r3f.elapsedTime * 0.25) * 0.04
      mesh.current.scale.setScalar(6.4 + pulse)
      if (!clock.reducedMotion) mesh.current.rotation.y = r3f.elapsedTime * 0.02
    }
    if (band.current) {
      band.current.visible = strength > 0.03
      if (!clock.reducedMotion) band.current.rotation.z = r3f.elapsedTime * 0.015
    }
  })

  if (strength <= 0) return null

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, segs, segs]} />
        <meshBasicMaterial
          color="#b7c6de"
          transparent
          opacity={0.08 + strength * 0.14}
          side={DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={band} rotation={[0.4, 0.2, 0]}>
        <torusGeometry args={[6.55, 0.08, 8, 48]} />
        <meshBasicMaterial
          color="#c9d6ea"
          transparent
          opacity={0.16 + strength * 0.18}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
