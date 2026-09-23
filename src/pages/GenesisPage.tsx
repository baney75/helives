import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { useGenesisClock } from '../hooks/useGenesisClock.ts'
import { useNarration } from '../hooks/useNarration.ts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { readAppMode } from '../lib/mode.ts'
import { CinematicOverlay } from '../ui/CinematicOverlay.tsx'
import { HUD } from '../ui/HUD.tsx'
import { MusicControls } from '../music/MusicControls.tsx'
import '../ui/genesis.css'

const GenesisIllustration = lazy(async () => {
  const module = await import('../scene/GenesisIllustration.tsx')
  return { default: module.GenesisIllustration }
})

export function GenesisPage() {
  const mode = useMemo(() => readAppMode(window.location.search), [])
  const reducedMotion = usePrefersReducedMotion()
  const visible = useDocumentVisible()
  const [sceneReady, setSceneReady] = useState(false)
  const onSceneReady = useCallback((ready: boolean) => setSceneReady(ready), [])
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

  const cinematicAudioAction = mode.cinematic && (narration.blocked || narration.stalled)

  return (
    <main id="main-content" className={`${mode.cinematic ? 'app is-cinematic' : 'app'} illustrated-genesis${!sceneReady ? ' is-scene-loading' : ''}${cinematicAudioAction ? ' has-cinematic-audio-action' : ''}`}>
      <a className="skip" href="#genesis-time">
        Skip to timeline
      </a>
      <Suspense fallback={<div className="stage stage-loading" aria-hidden="true" />}>
        <GenesisIllustration
          onReady={onSceneReady}
          sceneId={clock.scene.id}
          progress={clock.progress}
          reducedMotion={reducedMotion}
          playing={clock.playing && visible && !narration.hold}
        />
      </Suspense>
      {!sceneReady && <p className="scene-loading" role="status">Loading scene…</p>}
      {mode.cinematic && narration.blocked ? (
        <button type="button" className="sound-gate cinematic-audio-action" onClick={() => void narration.retry()}>
          Begin with sound
        </button>
      ) : mode.cinematic && narration.stalled ? (
        <button type="button" className="audio-waiting cinematic-audio-action" onClick={() => setMuted(true)}>
          Waiting for audio — continue without sound
        </button>
      ) : null}
      {mode.cinematic ? <><CinematicOverlay clock={clock} /><div className="cinematic-music"><MusicControls /></div></> : (
        <HUD
          clock={clock}
          muted={muted}
          onMute={() => setMuted((value) => !value)}
          audioBlocked={narration.blocked}
          onRetrySound={() => void narration.retry()}
          audioWaiting={narration.stalled}
          onContinueWithoutSound={() => setMuted(true)}
        />
      )}
    </main>
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
        (target instanceof Element && target.closest('input, select, textarea, button, a, dialog, [contenteditable]'))) {
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
