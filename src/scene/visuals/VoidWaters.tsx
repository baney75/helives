import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { SceneClock } from '../types.ts'
import { OceanSurface } from './OceanSurface.tsx'

export function VoidWaters({ clock }: { clock: SceneClock }) {
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const strength = Math.max(clock.presence.beginning, clock.presence.day2 * 0.92) * (1 - garden)
  const waters = useRef<Group>(null)

  useFrame(({ clock: r3f }) => {
    if (waters.current) {
      waters.current.visible = strength > 0.03
      const wave = clock.reducedMotion ? 0 : Math.sin(r3f.elapsedTime * 0.35) * 0.03
      waters.current.position.y = -1.15 + wave
      if (!clock.reducedMotion) waters.current.rotation.y = r3f.elapsedTime * 0.02
    }
  })

  if (strength <= 0) return null

  return (
    <group ref={waters}>
      <OceanSurface strength={strength} y={0} reducedMotion={clock.reducedMotion} quality={clock.quality} />
      <pointLight position={[0, 0.45, 0]} intensity={0.42 * strength} color="#6a7690" distance={12} />
    </group>
  )
}
