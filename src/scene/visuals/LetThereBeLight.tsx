import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide, type Group } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import type { SceneClock } from '../types.ts'

export function LetThereBeLight({ clock }: { clock: SceneClock }) {
  const mesh = useRef<Group>(null)
  const strength = Math.max(clock.presence.day1, clock.presence.day4 * 0.25)
  const pulse = clock.reducedMotion ? 0 : 1
  const detail = clock.quality === 'low' ? 3 : 5

  useFrame(({ clock: r3f }) => {
    if (!mesh.current) return
    const s = 0.34 + strength * 0.55 + Math.sin(r3f.elapsedTime * 2.2) * 0.03 * pulse
    mesh.current.scale.setScalar(s)
    mesh.current.visible = strength > 0.02
  })

  if (strength <= 0) return null

  return (
    <group ref={mesh}>
      <mesh>
        <icosahedronGeometry args={[1, detail]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh scale={2.1}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#ffd28a"
          transparent
          opacity={0.2 * strength}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Sparkles
        count={BUDGET[clock.quality].sparkles}
        scale={10}
        size={5}
        speed={clock.reducedMotion ? 0 : 0.4}
        color="#ffe7b8"
        opacity={0.9 * strength}
      />
    </group>
  )
}
