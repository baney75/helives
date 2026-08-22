import { useCallback, useEffect, useRef, useState } from 'react'
import { AUDIO_BREATH_SECONDS } from '../genesis/sceneTiming.ts'
import type { SceneId } from '../genesis/scenes.ts'
import { narrationFile } from '../genesis/voiced.ts'

type NarrationOpts = {
  sceneId: SceneId
  playing: boolean
  cinematic: boolean
  speed: number
}

export type NarrationControl = {
  blocked: boolean
  /** True while a real mp3 is still speaking, or during the short breath after `ended`. */
  hold: boolean
  retry: () => Promise<boolean>
}

function audioUrl(file: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}audio/${file}`
}

export function useNarration({ sceneId, playing, cinematic, speed }: NarrationOpts): NarrationControl {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastKey = useRef('')
  const breathRef = useRef<number>(0)
  const [blocked, setBlocked] = useState(false)
  const [hold, setHold] = useState(false)

  const clearBreath = useCallback(() => {
    if (breathRef.current) {
      window.clearTimeout(breathRef.current)
      breathRef.current = 0
    }
  }, [])

  const retry = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return false
    try {
      await audio.play()
      setBlocked(false)
      return true
    } catch {
      setBlocked(true)
      return false
    }
  }, [])

  useEffect(() => {
    const key = cinematic ? 'trailer' : sceneId
    const file = narrationFile(key)
    if (lastKey.current !== key) {
      lastKey.current = key
      clearBreath()
      audioRef.current?.pause()
      audioRef.current = null
      setBlocked(false)
      if (file) {
        const audio = new Audio(audioUrl(file))
        audio.preload = 'auto'
        audio.autoplay = true
        audio.setAttribute('playsinline', '')
        const finish = () => {
          clearBreath()
          breathRef.current = window.setTimeout(() => {
            breathRef.current = 0
            setHold(false)
          }, AUDIO_BREATH_SECONDS * 1000)
        }
        audio.addEventListener('ended', finish)
        audio.addEventListener('error', () => {
          clearBreath()
          setHold(false)
        })
        audioRef.current = audio
        setHold(true)
      } else {
        setHold(false)
      }
    }
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = cinematic ? 1 : speed
    if (playing) {
      if (audio.paused) void retry()
    } else {
      audio.pause()
    }
  }, [sceneId, playing, cinematic, speed, retry, clearBreath])

  useEffect(() => {
    if (!blocked) return
    const unlock = () => void retry()
    window.addEventListener('pointerdown', unlock, { once: true, capture: true })
    window.addEventListener('keydown', unlock, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [blocked, retry])

  useEffect(() => {
    return () => {
      clearBreath()
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [clearBreath])

  return { blocked, hold, retry }
}
