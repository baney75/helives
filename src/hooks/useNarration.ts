import { useCallback, useEffect, useRef, useState } from 'react'
import { INTERACTIVE_SECONDS, sceneBounds } from '../genesis/sceneTiming.ts'
import type { SceneId } from '../genesis/scenes.ts'
import { narrationFile } from '../genesis/voiced.ts'

type NarrationOpts = {
  sceneId: SceneId
  playing: boolean
  cinematic: boolean
  speed: number
  muted?: boolean
  progress?: number
  seekVersion?: number
}

const AUDIO_PROGRESS_TIMEOUT_MS = 3000
const AUDIO_PROGRESS_SAMPLE_MS = 250

export type NarrationControl = {
  blocked: boolean
  stalled: boolean
  hold: boolean
  retry: () => Promise<boolean>
  /** Media time is authoritative, including while stalled or loading. */
  readProgress: () => number | null
}

export function useNarration(options: NarrationOpts): NarrationControl {
  const { sceneId, playing, cinematic, speed, muted = false, seekVersion = 0 } = options
  const latest = useRef(options)
  latest.current = options
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const state = useRef({ key: '', finished: false, pendingSeek: 0, seeking: true, origin: 0, journey: INTERACTIVE_SECONDS, padTime: 0, lastRead: 0 })
  const [blocked, setBlocked] = useState(false)
  const blockedRef = useRef(false)
  const [stalled, setStalled] = useState(false)
  const [hold, setHold] = useState(false)

  const setPlaybackBlocked = useCallback((next: boolean) => {
    blockedRef.current = next
    setBlocked(next)
    if (next) setStalled(false)
  }, [])

  const retry = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || state.current.finished) return false
    const recoveringFromBlock = blockedRef.current
    try {
      await audio.play()
      if (audioRef.current !== audio) { audio.pause(); return false }
      if ((!latest.current.playing && !recoveringFromBlock) || latest.current.muted) audio.pause()
      setPlaybackBlocked(false)
      return true
    } catch {
      if (audioRef.current === audio && latest.current.playing && !latest.current.muted) setPlaybackBlocked(true)
      return false
    }
  }, [setPlaybackBlocked])

  const readProgress = useCallback(() => {
    const audio = audioRef.current
    const current = state.current
    if (!audio || latest.current.muted) return null
    if (current.finished) {
      const now = performance.now()
      if (latest.current.playing) current.padTime += Math.max(0, now - current.lastRead) / 1000 * (latest.current.cinematic ? 1 : latest.current.speed)
      current.lastRead = now
      return Math.min(sceneBounds(latest.current.sceneId).end, current.origin + current.padTime / current.journey)
    }
    const time = current.seeking ? current.pendingSeek : audio.currentTime
    return Math.min(1, current.origin + time / current.journey)
  }, [])

  useEffect(() => {
    const key = sceneId
    const file = narrationFile(key)
    const origin = sceneBounds(sceneId).start
    const journey = INTERACTIVE_SECONDS
    const target = Math.max(0, ((latest.current.progress ?? origin) - origin) * journey)
    let audio = audioRef.current
    if (state.current.key !== key || !audio) {
      audio?.pause()
      state.current = { key, finished: false, seeking: true, pendingSeek: target, origin, journey, padTime: target, lastRead: performance.now() }
      setPlaybackBlocked(false)
      if (!file) { audioRef.current = null; setHold(false); return }
      audio = new Audio(`${import.meta.env.BASE_URL}audio/${file}`)
      audio.preload = 'auto'
      audio.setAttribute('playsinline', '')
      audioRef.current = audio
      const current = audio
      const finish = () => {
        if (audioRef.current !== current) return
        state.current.finished = true
        state.current.padTime = Math.max(current.duration, state.current.pendingSeek)
        state.current.lastRead = performance.now()
        setHold(false)
        setStalled(false)
      }
      const seek = () => {
        if (audioRef.current !== current) return
        const desired = state.current.pendingSeek
        if (Number.isFinite(current.duration) && desired >= current.duration) {
          current.currentTime = current.duration
          state.current.seeking = false
          finish()
        } else {
          current.currentTime = desired
          state.current.seeking = false
        }
      }
      current.addEventListener('loadedmetadata', seek)
      current.addEventListener('ended', finish)
      current.addEventListener('error', () => {
        if (audioRef.current !== current) return
        setPlaybackBlocked(true)
      })
    }
    state.current.padTime = target
    state.current.lastRead = performance.now()
    state.current.pendingSeek = target
    state.current.seeking = true
    state.current.finished = false
    if (audio.readyState >= 1) {
      const pastEnd = Number.isFinite(audio.duration) && target >= audio.duration
      audio.currentTime = pastEnd ? audio.duration : target
      state.current.seeking = false
      state.current.finished = pastEnd
    }
    setHold(!state.current.finished)
    // This effect runs only on a user seek, scene change, or mute change, not every frame.
    if (latest.current.playing && !muted && !state.current.finished) void retry()
    else audio.pause()
  }, [sceneId, cinematic, seekVersion, muted, retry, setPlaybackBlocked])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    state.current.lastRead = performance.now()
    audio.playbackRate = cinematic ? 1 : speed
    audio.preservesPitch = true
    if (muted) setPlaybackBlocked(false)
    if (playing && !muted && !state.current.finished) {
      if (audio.paused) void retry()
    } else audio.pause()
  }, [playing, speed, muted, cinematic, sceneId, retry, setPlaybackBlocked])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playing || muted || state.current.finished || blockedRef.current) {
      setStalled(false)
      return
    }
    let lastTime = audio.currentTime
    let lastProgressAt = performance.now()
    // This covers both ordinary loading and audio backends that report Play but
    // never tick their media clock. Progress clears the notice automatically;
    // another three-second pause in progress makes the recovery available again.
    const timer = window.setInterval(() => {
      if (
        audioRef.current !== audio ||
        !latest.current.playing ||
        latest.current.muted ||
        blockedRef.current ||
        state.current.finished
      ) {
        setStalled(false)
        return
      }
      const currentTime = audio.currentTime
      if (Math.abs(currentTime - lastTime) > 0.04) {
        lastTime = currentTime
        lastProgressAt = performance.now()
        setStalled(false)
      } else if (performance.now() - lastProgressAt >= AUDIO_PROGRESS_TIMEOUT_MS) {
        setStalled(true)
      }
    }, AUDIO_PROGRESS_SAMPLE_MS)
    return () => window.clearInterval(timer)
  }, [playing, muted, sceneId, seekVersion])

  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
    state.current.key = ''
  }, [])

  return { blocked, stalled, hold: hold && !muted, retry, readProgress }
}
