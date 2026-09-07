import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { MUSIC_TRACKS } from './catalog.ts'

type Status = 'off' | 'loading' | 'playing' | 'error'
type MusicState = {
  status: Status; volume: number; trackId: string
  toggle: () => void; setVolume: (value: number) => void; selectTrack: (id: string) => void
}
const MusicContext = createContext<MusicState | null>(null)
export const useMusic = () => useContext(MusicContext)

/** One player lives above routing and the hourly verse, never persisted as enabled. */
export function MusicProvider({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  const [status, setStatus] = useState<Status>('off')
  const [volume, setVolumeState] = useState(35)
  const [trackId, setTrackId] = useState(MUSIC_TRACKS[0]!.id)
  const audio = useRef<HTMLAudioElement | null>(null)
  const wanted = useRef(false)
  const request = useRef(0)
  const settings = useRef({ volume, quiet })
  settings.current = { volume, quiet }

  const stop = useCallback(() => {
    wanted.current = false
    request.current++
    audio.current?.pause()
    setStatus('off')
  }, [])

  const start = useCallback(async function playTrack(id: string) {
    const track = MUSIC_TRACKS.find((item) => item.id === id)
    if (!track || document.hidden) return
    const token = ++request.current
    wanted.current = true
    let clip = audio.current
    if (!clip || clip.error || clip.dataset.track !== id) {
      clip?.pause()
      clip = new Audio(`${import.meta.env.BASE_URL}audio/music/${track.file}`)
      clip.dataset.track = id
      clip.preload = 'none'
      clip.loop = MUSIC_TRACKS.length === 1
      clip.setAttribute('playsinline', '')
      const current = clip
      clip.addEventListener('error', () => {
        if (audio.current !== current || !wanted.current) return
        wanted.current = false
        request.current++
        current.pause()
        setStatus('error')
      })
      clip.addEventListener('ended', () => {
        if (audio.current !== current || !wanted.current || document.hidden) return
        const next = MUSIC_TRACKS[(MUSIC_TRACKS.findIndex((item) => item.id === id) + 1) % MUSIC_TRACKS.length]!
        setTrackId(next.id)
        void playTrack(next.id)
      })
      audio.current = clip
    }
    clip.volume = settings.current.volume / 100 * (settings.current.quiet ? .3 : 1)
    setStatus('loading')
    try {
      await clip.play()
      if (token !== request.current || !wanted.current) {
        // A newer request may already be using this same element.
        if (!wanted.current || audio.current !== clip) clip.pause()
        return
      }
      setStatus('playing')
    } catch {
      if (token !== request.current) return
      wanted.current = false
      clip.pause()
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (audio.current) audio.current.volume = volume / 100 * (quiet ? .3 : 1)
  }, [volume, quiet])

  useEffect(() => {
    // Returning to a hidden tab never unexpectedly restarts sound.
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', stop)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', stop)
      wanted.current = false
      request.current++
      audio.current?.pause()
    }
  }, [stop])

  const toggle = () => { if (wanted.current) stop(); else void start(trackId) }
  const selectTrack = (id: string) => {
    if (!MUSIC_TRACKS.some((track) => track.id === id)) return
    setTrackId(id)
    if (wanted.current) void start(id)
  }
  const setVolume = (value: number) => {
    if (Number.isFinite(value)) setVolumeState(Math.min(100, Math.max(1, value)))
  }
  return <MusicContext.Provider value={{ status, volume, trackId, toggle, selectTrack, setVolume }}>{children}</MusicContext.Provider>
}
