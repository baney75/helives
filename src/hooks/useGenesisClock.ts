import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findSceneAt, presenceById, type Scene } from '../genesis/scenes.ts'
import { advanceProgress, cameraDistance, clampedFrameDelta, visualScale } from '../genesis/time.ts'

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
  _reducedMotion: boolean,
  cinematic = false,
  start: ClockStart = {},
): GenesisClock {
  const [progress, setProgressState] = useState(start.progress ?? 0)
  const [playing, setPlaying] = useState(!start.pause)
  const [speed, setSpeed] = useState(1)

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
      const dt = clampedFrameDelta(now, last)
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
    setPlaying(true)
  }, [])

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
