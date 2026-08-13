import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findSceneAt, presenceById, type Scene } from '../genesis/scenes.ts'
import {
  cameraDistance,
  CINEMATIC_HOLD_SECONDS,
  CINEMATIC_SECONDS,
  INTERACTIVE_SECONDS,
  OPENING_HOLD_SECONDS,
  visualScale,
} from '../genesis/time.ts'

export type GenesisClock = {
  progress: number
  setProgress: (value: number | ((current: number) => number)) => void
  playing: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
  speed: number
  setSpeed: (value: number) => void
  scale: number
  distance: number
  scene: Scene
  presence: ReturnType<typeof presenceById>
}

type ClockStart = {
  progress?: number | null
  pause?: boolean
}

export function useGenesisClock(
  reducedMotion: boolean,
  cinematic = false,
  start: ClockStart = {},
): GenesisClock {
  const [progress, setProgressState] = useState(start.progress ?? 0)
  const [playing, setPlaying] = useState(!reducedMotion && !start.pause)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    if (reducedMotion) setPlaying(false)
  }, [reducedMotion])

  const setProgress = useCallback((value: number | ((current: number) => number)) => {
    setProgressState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      return Math.min(1, Math.max(0, next))
    })
  }, [])

  const holdRef = useRef(0)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setProgressState((current) =>
        advanceProgress(current, dt, cinematic, speed, holdRef, () => setPlaying(false)),
      )
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, cinematic])

  const derived = useMemo(() => {
    return {
      scale: visualScale(progress),
      distance: cameraDistance(progress),
      scene: findSceneAt(progress),
      presence: presenceById(progress),
    }
  }, [progress])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => setPlaying((value) => !value), [])
  const reset = useCallback(() => {
    holdRef.current = 0
    setProgressState(0)
    setPlaying(!reducedMotion)
  }, [reducedMotion])

  return {
    progress,
    setProgress,
    playing,
    play,
    pause,
    toggle,
    reset,
    speed,
    setSpeed,
    ...derived,
  }
}

function advanceProgress(
  current: number,
  dt: number,
  cinematic: boolean,
  speed: number,
  holdRef: { current: number },
  stop: () => void,
): number {
  if (current <= 0) {
    holdRef.current += dt
    const hold = cinematic ? CINEMATIC_HOLD_SECONDS : OPENING_HOLD_SECONDS
    if (holdRef.current < hold) return 0
  }
  const journey = cinematic ? CINEMATIC_SECONDS : INTERACTIVE_SECONDS
  const next = current + dt / (journey / speed)
  if (next >= 1) {
    stop()
    return 1
  }
  return next
}
