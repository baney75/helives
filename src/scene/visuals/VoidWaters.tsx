import { useStoryFrame } from '../StoryTime.tsx'
import { useRef } from 'react'
import type { Group } from 'three'
import type { SceneClock } from '../types.ts'
import { OceanSurface } from './OceanSurface.tsx'

export function VoidWaters({ clock }: { clock: SceneClock }) {
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const strength = Math.max(clock.presence.beginning, clock.presence.day1 * 0.96, clock.presence.day2 * 0.92) * (1 - garden)
  const waters = useRef<Group>(null)

  useStoryFrame(() => {
    if (waters.current) waters.current.visible = strength > 0.03
  })

  if (strength <= 0) return null

  return (
    <group ref={waters} position={[0, -1.15, 0]}>
      <OceanSurface strength={strength} y={0} reducedMotion={clock.reducedMotion} quality={clock.quality} />
      {clock.quality !== 'low' ? (
        <OceanSurface
          strength={strength * 0.46}
          y={-0.62}
          reducedMotion={clock.reducedMotion}
          quality={clock.quality}
          scale={1.24}
        />
      ) : null}
      <pointLight position={[-0.7, 0.72, 0.8]} intensity={0.82 * strength} color="#7296af" distance={13} decay={1.8} />
      <pointLight position={[2.8, -0.2, -2.4]} intensity={0.34 * strength} color="#235b74" distance={10} />
    </group>
  )
}
