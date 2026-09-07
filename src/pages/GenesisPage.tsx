import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAutoQuality } from '../hooks/useAutoQuality.ts'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { useGenesisClock } from '../hooks/useGenesisClock.ts'
import { useIsMobile } from '../hooks/useIsMobile.ts'
import { useNarration } from '../hooks/useNarration.ts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import type { Quality } from '../lib/budget.ts'
import { readAppMode } from '../lib/mode.ts'
import { effectsAllowed, persistQualityRecord, qualityFromSearch, stricterQuality } from '../lib/quality.ts'
import { CinematicOverlay } from '../ui/CinematicOverlay.tsx'
import { HUD } from '../ui/HUD.tsx'

const GenesisCanvas = lazy(async () => {
  const module = await import('../scene/GenesisCanvas.tsx')
  return { default: module.GenesisCanvas }
})

export function GenesisPage() {
  const mode = useMemo(() => readAppMode(window.location.search), [])
  const reducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()
  const visible = useDocumentVisible()
  const search = window.location.search
  const gate = useAutoQuality(reducedMotion, visible, search)
  const qualityLocked = Boolean(qualityFromSearch(search) || reducedMotion)
  const [liveQuality, setLiveQuality] = useState<Quality | null>(null)
  const [factor, setFactor] = useState(1)
  const quality = liveQuality ? stricterQuality(liveQuality, gate.quality) : gate.quality
  const effects = effectsAllowed(quality, factor)
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneUnavailable, setSceneUnavailable] = useState(false)
  const onSceneReady = useCallback((ready: boolean) => {
    setSceneReady(ready)
    if (ready) setSceneUnavailable(false)
  }, [])
  const onSceneUnavailable = useCallback(() => {
    // A readable fallback is a usable scene: transport and narration should
    // continue even when the optional WebGL layer cannot render.
    setSceneUnavailable(true)
    setSceneReady(true)
  }, [])
  const lastProgress = useRef(mode.progress ?? 0)
  const holdRef = useRef(false)
  const mediaClockRef = useRef<() => number | null>(() => null)
  const clock = useGenesisClock(reducedMotion, mode.cinematic, {
    progress: mode.progress,
    pause: mode.pause,
    audioHold: holdRef.current,
    mediaClock: () => !sceneReady || !visible ? lastProgress.current : mediaClockRef.current(),
  })

  lastProgress.current = clock.progress

  const onQualityFallback = useCallback(
    (next: Quality) => {
      if (qualityLocked) return
      setLiveQuality((current) => (current ? stricterQuality(current, next) : next))
      persistQualityRecord(next, Date.now(), window.navigator.userAgent, window.localStorage)
    },
    [qualityLocked],
  )

  const onPerformanceFactor = useCallback(
    (next: number) => {
      setFactor((current) => (effectsAllowed(quality, current) === effectsAllowed(quality, next) ? current : next))
    },
    [quality],
  )

  const [muted, setMuted] = useState(false)
  const narration = useNarration({
    muted,
    progress: clock.progress,
    seekVersion: clock.seekVersion,
    sceneId: clock.scene.id,
    playing: clock.playing && sceneReady && visible,
    cinematic: mode.cinematic,
    speed: clock.speed,
  })
  holdRef.current = narration.hold
  mediaClockRef.current = narration.readProgress
  const soundWasBlocked = useRef(false)

  useEffect(() => {
    if (narration.blocked) {
      soundWasBlocked.current = true
      clock.pause()
      return
    }
    if (soundWasBlocked.current) {
      soundWasBlocked.current = false
      clock.play()
    }
  }, [narration.blocked, clock.pause, clock.play])

  useEffect(() => {
    document.body.dataset.mode = mode.cinematic ? 'cinematic' : 'interactive'
    return () => { delete document.body.dataset.mode }
  }, [mode.cinematic])

  usePlaybackKeys(clock.toggle, clock.reset, clock.setProgress)

  return (
    <div className={`${mode.cinematic ? 'app is-cinematic' : 'app'}${sceneUnavailable ? ' has-scene-fallback' : ''}`}>
      <a className="skip" href="#genesis-time">
        Skip to timeline
      </a>
      <Suspense fallback={<div className="stage stage-loading" aria-hidden="true" />}>
        <GenesisCanvas
          onReady={onSceneReady}
          onUnavailable={onSceneUnavailable}
          clock={{
            progress: clock.progress,
            presence: clock.presence,
            scale: clock.scale,
            distance: clock.distance,
            reducedMotion,
            isMobile,
            cinematic: mode.cinematic,
            quality,
            playing: clock.playing,
            effects,
          }}
          qualityLocked={qualityLocked}
          onQualityFallback={onQualityFallback}
          onPerformanceFactor={onPerformanceFactor}
        />
      </Suspense>
      {!sceneReady && !sceneUnavailable && <p className="scene-loading" role="status">Loading scene…</p>}
      {narration.blocked ? (
        <button type="button" className="sound-gate" onClick={() => void narration.retry()}>
          Begin with sound
        </button>
      ) : narration.stalled ? (
        <button type="button" className="sound-gate" onClick={() => setMuted(true)}>
          Audio stalled — continue without sound
        </button>
      ) : null}
      {mode.cinematic ? <CinematicOverlay clock={clock} /> : <HUD clock={clock} muted={muted} onMute={() => setMuted((value) => !value)} />}
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
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        (target instanceof Element && target.closest('input, select, textarea, button, a, [contenteditable]'))) {
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
    event.preventDefault()
    reset()
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    setProgress((current) => current + 0.015)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    setProgress((current) => current - 0.015)
  }
}
