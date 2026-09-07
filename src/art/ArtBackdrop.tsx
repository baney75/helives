import { useEffect, useRef, useState } from 'react'
import { ArtScene } from './ArtScene.tsx'
import type { Artwork } from './catalog.ts'

/** Hold the previous drawing while the next SVG loads and dissolves into view. */
export function ArtBackdrop({ artwork, still }: { artwork: Artwork; still: boolean }) {
  const [layers, setLayers] = useState([artwork])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    setLayers(previous => previous.at(-1)?.id === artwork.id ? previous : [previous.at(-1)!, artwork])
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [artwork.id])
  const ready = (id: string) => {
    if (id !== artwork.id) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setLayers(current => current.filter(layer => layer.id === id)), 2400)
  }
  return <>{layers.map(layer => <ArtScene key={layer.id} artwork={layer} still={still} onReady={() => ready(layer.id)} />)}</>
}
