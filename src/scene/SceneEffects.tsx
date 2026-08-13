import { Bloom, EffectComposer } from '@react-three/postprocessing'
import type { SceneClock } from './types.ts'

export function SceneEffects({ clock }: { clock: SceneClock }) {
  if (clock.quality === 'low') return null
  const fire = clock.presence.day1 + clock.presence.day4 * 0.6 + clock.presence.closing * 0.25
  if (fire < 0.22) return null
  const richer = clock.quality === 'high' ? 0.18 : 0

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        intensity={0.5 + richer + Math.min(0.55, fire * 0.32)}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.32}
        mipmapBlur
      />
    </EffectComposer>
  )
}
