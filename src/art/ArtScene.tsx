import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/mini'
import { SceneAir } from './SceneAir.tsx'
import { artworkUrl, type Artwork } from './catalog.ts'

/** SVGs are isolated image resources, never injected into the document. */
export function ArtScene({ artwork, still, className = '', onReady, onFailure }: { artwork: Artwork; still: boolean; className?: string; onReady?: () => void; onFailure?: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const camera = useRef<ReturnType<typeof animate> | null>(null)
  useEffect(() => {
    const element = image.current
    if (!element || !loaded) return
    const direction = artwork.id.split('').reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 2 ? 1 : -1
    const movement = animate(element, { transform: ['scale(1.015) translate(0%, 0%)', `scale(1.065) translate(${direction * .7}%, -.35%)`] }, { duration: 86 + (artwork.id.length % 5) * 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' })
    camera.current = movement
    if (still) movement.pause()
    return () => { movement.stop(); camera.current = null }
  }, [loaded])
  useEffect(() => { if (still) camera.current?.pause(); else camera.current?.play() }, [still])
  return <div className={`art-scene ${className}${loaded ? ' is-ready' : ''}`} data-artwork={artwork.id} data-still={still}>
    <SceneAir artwork={artwork} />
    <img ref={image} src={artworkUrl(artwork)} alt="" width="1600" height="1000" decoding="async" onLoad={() => { setLoaded(true); onReady?.() }} onError={() => { setLoaded(false); onFailure?.() }} />
  </div>
}
