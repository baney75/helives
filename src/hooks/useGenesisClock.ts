import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findSceneAt, presenceById, type Scene } from '../genesis/scenes.ts'
import { advanceProgress, cameraDistance, clampedFrameDelta, visualScale } from '../genesis/time.ts'

export type GenesisClock = {
  progress: number
  seekVersion: number
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
  audioHold?: boolean
  mediaClock?: () => number | null
}

export function useGenesisClock(
  _reducedMotion: boolean,
  cinematic = false,
  start: ClockStart = {},
): GenesisClock {
  const [progress, setProgressState] = useState(start.progress ?? 0)
  const [playing, setPlaying] = useState(!start.pause)
  const [seekVersion, setSeekVersion] = useState(0)
  const [speed, setSpeed] = useState(1)

  const setProgress = useCallback((value: number | ((current: number) => number)) => {
    setSeekVersion((version) => version + 1)
    holdRef.current = 0
    setProgressState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      return Math.min(1, Math.max(0, next))
    })
  }, [])

  const holdRef = useRef(0)
  const mediaClockRef = useRef(start.mediaClock)
  mediaClockRef.current = start.mediaClock
  const audioHoldRef = useRef(Boolean(start.audioHold))
  audioHoldRef.current = Boolean(start.audioHold)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = clampedFrameDelta(now, last)
      last = now
      const mediaProgress = mediaClockRef.current?.()
      if (mediaProgress != null && mediaProgress >= 1) setPlaying(false)
      setProgressState((current) =>
        mediaProgress ?? advanceProgress(
          current,
          dt,
          cinematic,
          speed,
          holdRef,
          () => setPlaying(false),
          audioHoldRef.current,
        ),
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
    setSeekVersion((version) => version + 1)
    setProgressState(0)
    setPlaying(true)
  }, [])

  return {
    progress,
    seekVersion,
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
