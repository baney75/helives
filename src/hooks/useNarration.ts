import { useCallback, useEffect, useRef, useState } from 'react'
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
  retry: () => Promise<boolean>
}

function audioUrl(file: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}audio/${file}`
}

export function useNarration({ sceneId, playing, cinematic, speed }: NarrationOpts): NarrationControl {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastKey = useRef('')
  const [blocked, setBlocked] = useState(false)

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
      audioRef.current?.pause()
      audioRef.current = null
      setBlocked(false)
      if (file) {
        const audio = new Audio(audioUrl(file))
        audio.preload = 'auto'
        audio.autoplay = true
        audio.setAttribute('playsinline', '')
        audioRef.current = audio
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
  }, [sceneId, playing, cinematic, speed, retry])

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
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  return { blocked, retry }
}
