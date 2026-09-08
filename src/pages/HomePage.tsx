import { useEffect, useRef, useState } from 'react'
import { SiteNav } from '../site/SiteNav.tsx'
import { HourLamp } from '../word/HourLamp.tsx'

type HomePageProps = { now?: Date }

export function HomePage({ now }: HomePageProps) {
  const [display, setDisplay] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('display') === '1')
  const [idle, setIdle] = useState(false)
  const ownedFullscreen = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reveal = () => {
    setIdle(false)
    if (timer.current) clearTimeout(timer.current)
    if (display) timer.current = setTimeout(() => setIdle(true), 6000)
  }
  const toggleDisplay = async () => {
    const next = !display
    setDisplay(next)
    setIdle(false)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('display', '1'); else url.searchParams.delete('display')
    window.history.replaceState({}, '', url.pathname + url.search)
    try {
      if (next && !document.fullscreenElement) { await document.documentElement.requestFullscreen?.(); ownedFullscreen.current = Boolean(document.fullscreenElement) }
      else if (!next && document.fullscreenElement) await document.exitFullscreen()
    } catch { /* TV layout remains available when browser fullscreen is unavailable. */ }
  }
  useEffect(() => {
    if (!display) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDisplay(false); const url = new URL(window.location.href); url.searchParams.delete('display'); window.history.replaceState({}, '', url.pathname + url.search) } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [display])
  useEffect(() => {
    const changed = () => {
      if (!document.fullscreenElement && ownedFullscreen.current) {
        ownedFullscreen.current=false
        setDisplay(false)
        const url=new URL(window.location.href); url.searchParams.delete('display')
        window.history.replaceState({}, '', url.pathname+url.search)
      }
    }
    document.addEventListener('fullscreenchange',changed)
    return () => { document.removeEventListener('fullscreenchange',changed); if(ownedFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(()=>{}) }
  },[])
  useEffect(() => {
    if (!display || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null=null
    let disposed=false
    const acquire=async()=>{
      if(document.hidden || disposed || lock) return
      try { const granted=await navigator.wakeLock.request('screen'); if(disposed) { await granted.release(); return }; lock=granted; granted.addEventListener('release',()=>{if(lock===granted)lock=null}) } catch { /* Optional on supported TV browsers. */ }
    }
    void acquire()
    document.addEventListener('visibilitychange',acquire)
    return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void lock?.release()}
  },[display])
  useEffect(() => {
    if (display) timer.current = setTimeout(() => setIdle(true), 6000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [display])
  return (
    <div className={`site lamp-home reading-home${display ? ' is-display' : ''}${idle ? ' is-idle' : ''}`} onPointerMove={reveal} onKeyDown={reveal}>
      <SiteNav current="home" extra={<button type="button" className="tv-toggle" onClick={(event) => { if (event.detail) event.currentTarget.blur(); void toggleDisplay() }} aria-pressed={display}>{display ? 'Exit fullscreen mode' : 'Fullscreen mode'}</button>} />
      <main id="main-content" className="hero word-hero">
        <HourLamp now={now} />
      </main>
    </div>
  )
}
