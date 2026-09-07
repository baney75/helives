import { useEffect, useReducer, useRef } from 'react'
import { ArtScene } from './ArtScene.tsx'
import { artTransition } from './transition.ts'
import type { Artwork } from './catalog.ts'

/** Decoding and dissolving are separate: a slow or failed image never erases the last scene. */
export function ArtBackdrop({ artwork, still, retry = 0, onReady, onFailure }: { artwork: Artwork; still: boolean; retry?: number; onReady?: (id: string) => void; onFailure?: (id: string) => void }) {
  const [state, dispatch] = useReducer(artTransition, { base: artwork, incoming: null, ready: false })
  const decoded = useRef(new Set<string>())
  useEffect(() => { dispatch({ type: 'request', artwork }); if (decoded.current.has(artwork.id)) onReady?.(artwork.id) }, [artwork, retry])
  useEffect(() => {
    if (!state.ready || !state.incoming) return
    const id = state.incoming.id
    const timer = setTimeout(() => dispatch({ type: 'settle', id }), 2400)
    return () => clearTimeout(timer)
  }, [state.ready, state.incoming])
  return <>{[state.base, ...(state.incoming ? [state.incoming] : [])].map(layer => <ArtScene key={`${layer.id}:${retry}`} artwork={layer} still={still}
    onReady={() => { decoded.current.add(layer.id); dispatch({ type: 'ready', id: layer.id }); onReady?.(layer.id) }}
    onFailure={() => { decoded.current.delete(layer.id); dispatch({ type: 'failed', id: layer.id }); onFailure?.(layer.id) }} />)}</>
}
