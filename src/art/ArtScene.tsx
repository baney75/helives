import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/mini'
import { artworkUrl, type Artwork } from './catalog.ts'

/** SVGs are isolated image resources, never injected into the document. */
export function ArtScene({ artwork, still, className = '', onReady }: { artwork: Artwork; still: boolean; className?: string; onReady?: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const camera = useRef<ReturnType<typeof animate> | null>(null)
  useEffect(() => {
    const element = image.current
    if (!element || !loaded) return
    const movement = animate(element, { transform: ['scale(1.015) translateX(0%)', 'scale(1.08) translateX(-1.2%)'] }, { duration: 80, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' })
    camera.current = movement
    if (still) movement.pause()
    return () => { movement.stop(); camera.current = null }
  }, [loaded])
  useEffect(() => { if (still) camera.current?.pause(); else camera.current?.play() }, [still])
  return <div className={`art-scene ${className}${loaded ? ' is-ready' : ''}`} data-artwork={artwork.id} data-still={still}>
    <img ref={image} src={artworkUrl(artwork)} alt="" width="1600" height="1000" decoding="async" onLoad={() => { setLoaded(true); onReady?.() }} onError={() => setLoaded(false)} />
  </div>
}
