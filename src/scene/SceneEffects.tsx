import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import type { SceneClock } from './types.ts'

export function SceneEffects({ clock }: { clock: SceneClock }) {
  if (!clock.effects) return null
  const fire = clock.presence.day1 + clock.presence.day4 * 0.6 + clock.presence.closing * 0.25
  const richer = clock.quality === 'high' ? 0.18 : 0
  const bloom = fire >= 0.22

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {bloom ? (
        <Bloom
          intensity={0.5 + richer + Math.min(0.55, fire * 0.32)}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.32}
          mipmapBlur
        />
      ) : (
        <></>
      )}
      <Vignette offset={0.32} darkness={0.58} eskil={false} />
    </EffectComposer>
  )
}
