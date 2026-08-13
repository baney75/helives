import { useEffect, useRef } from 'react'
import type { SceneId } from '../genesis/scenes.ts'

type NarrationOpts = {
  sceneId: SceneId
  playing: boolean
  cinematic: boolean
  reducedMotion: boolean
}

function audioUrl(file: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}audio/${file}`
}

export function useNarration({ sceneId, playing, cinematic, reducedMotion }: NarrationOpts): void {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastKey = useRef('')

  useEffect(() => {
    const key = cinematic ? 'trailer' : sceneId
    const file = cinematic ? 'trailer.mp3' : `${sceneId}.mp3`
    if (lastKey.current !== key) {
      lastKey.current = key
      audioRef.current?.pause()
      const audio = new Audio(audioUrl(file))
      audio.preload = 'auto'
      audioRef.current = audio
    }
    const audio = audioRef.current
    if (!audio) return
    if (playing && !reducedMotion) {
      void audio.play().catch(() => {
        // Autoplay can fail until a gesture; Play button retries.
      })
    } else {
      audio.pause()
    }
  }, [sceneId, playing, cinematic, reducedMotion])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])
}
