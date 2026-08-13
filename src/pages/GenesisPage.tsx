import { useEffect, useMemo } from 'react'
import { useAutoQuality } from '../hooks/useAutoQuality.ts'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { useGenesisClock } from '../hooks/useGenesisClock.ts'
import { useIsMobile } from '../hooks/useIsMobile.ts'
import { useNarration } from '../hooks/useNarration.ts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { readAppMode } from '../lib/mode.ts'
import { GenesisCanvas } from '../scene/GenesisCanvas.tsx'
import { Calibrating } from '../ui/Calibrating.tsx'
import { CinematicOverlay } from '../ui/CinematicOverlay.tsx'
import { HUD } from '../ui/HUD.tsx'

export function GenesisPage() {
  const mode = useMemo(() => readAppMode(window.location.search), [])
  const reducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()
  const visible = useDocumentVisible()
  const gate = useAutoQuality(reducedMotion, visible, window.location.search)
  const clock = useGenesisClock(reducedMotion, mode.cinematic, {
    progress: mode.progress,
    pause: mode.pause,
  })

  useNarration({
    sceneId: clock.scene.id,
    playing: clock.playing,
    cinematic: mode.cinematic,
    reducedMotion,
  })

  useEffect(() => {
    document.body.dataset.mode = mode.cinematic ? 'cinematic' : 'interactive'
  }, [mode.cinematic])

  usePlaybackKeys(clock.toggle, clock.reset, clock.setProgress)

  if (gate.status !== 'ready') {
    return (
      <div className="app">
        <Calibrating />
      </div>
    )
  }

  return (
    <div className={mode.cinematic ? 'app is-cinematic' : 'app'}>
      <a className="skip" href="#genesis-time">
        Skip to timeline
      </a>
      <GenesisCanvas
        clock={{
          progress: clock.progress,
          presence: clock.presence,
          scale: clock.scale,
          distance: clock.distance,
          reducedMotion,
          isMobile,
          cinematic: mode.cinematic,
          quality: gate.quality,
        }}
      />
      {mode.cinematic ? <CinematicOverlay clock={clock} /> : <HUD clock={clock} />}
    </div>
  )
}

function usePlaybackKeys(
  toggle: () => void,
  reset: () => void,
  setProgress: (value: number | ((current: number) => number)) => void,
): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
        return
      }
      handlePlaybackKey(event, toggle, reset, setProgress)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, reset, setProgress])
}

function handlePlaybackKey(
  event: KeyboardEvent,
  toggle: () => void,
  reset: () => void,
  setProgress: (value: number | ((current: number) => number)) => void,
): void {
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault()
    toggle()
    return
  }
  if (event.key === 'Home') {
    reset()
    return
  }
  if (event.key === 'ArrowRight') {
    setProgress((current) => current + 0.015)
    return
  }
  if (event.key === 'ArrowLeft') {
    setProgress((current) => current - 0.015)
  }
}
