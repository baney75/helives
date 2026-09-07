import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { MUSIC_TRACKS } from './catalog.ts'
import { MusicEngine, type MusicStatus } from './MusicEngine.ts'

type MusicState = {
  status: MusicStatus; volume: number; trackId: string
  toggle: () => void; setVolume: (value: number) => void; selectTrack: (id: string) => void
}
const MusicContext = createContext<MusicState | null>(null)
export const useMusic = () => useContext(MusicContext)

export function MusicProvider({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  const [state,setState] = useState({status:'off' as MusicStatus,trackId:MUSIC_TRACKS[0]!.id})
  const [volume,setVolume] = useState(35)
  const engine = useRef<MusicEngine | null>(null)
  if(!engine.current) engine.current = new MusicEngine(setState)
  useEffect(()=>engine.current!.setVolume(volume/100*(quiet ? .3 : 1)),[volume,quiet])
  useEffect(()=>{
    const stop=()=>engine.current!.stop()
    const hide=()=>{if(document.hidden)stop()}
    document.addEventListener('visibilitychange',hide)
    window.addEventListener('pagehide',stop)
    return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',stop);stop()}
  },[])
  return <MusicContext.Provider value={{...state,volume,toggle:()=>engine.current!.toggle(),selectTrack:id=>engine.current!.select(id),setVolume:value=>{if(Number.isFinite(value))setVolume(Math.max(1,Math.min(100,value)))}}}>{children}</MusicContext.Provider>
}
