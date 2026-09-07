import type { Artwork } from './catalog.ts'

export type ArtTransition = { base: Artwork; incoming: Artwork | null; ready: boolean }
export type ArtEvent = { type: 'request'; artwork: Artwork } | { type: 'ready' | 'settle' | 'failed'; id: string }
/** Keep the last decoded scene when requests are superseded or fail. */
export function artTransition(state: ArtTransition, event: ArtEvent): ArtTransition {
  if (event.type === 'request') {
    if (state.incoming?.id === event.artwork.id) return state
    const base = state.ready && state.incoming ? state.incoming : state.base
    return { base, incoming: base.id === event.artwork.id ? null : event.artwork, ready: false }
  }
  if (state.incoming?.id !== event.id) return state
  if (event.type === 'ready') return { ...state, ready: true }
  if (event.type === 'settle' && state.ready) return { base: state.incoming, incoming: null, ready: false }
  if (event.type === 'failed') return { ...state, incoming: null, ready: false }
  return state
}
