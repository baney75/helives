import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide, type Group } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import type { SceneClock } from '../types.ts'

export function LetThereBeLight({ clock }: { clock: SceneClock }) {
  const mesh = useRef<Group>(null)
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const strength = Math.max(clock.presence.day1, clock.presence.day4 * 0.25) * (1 - garden * 0.82)
  const pulse = clock.reducedMotion ? 0 : 1
  const segs = clock.quality === 'low' ? 16 : 28

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
        <sphereGeometry args={[1, segs, segs]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} />
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
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 7.2, 8]} />
        <meshBasicMaterial
          color="#fff4d6"
          transparent
          opacity={0.35 * strength}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.55, 32]} />
        <meshBasicMaterial
          color="#e8b86d"
          side={DoubleSide}
          transparent
          opacity={0.45 * strength}
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
