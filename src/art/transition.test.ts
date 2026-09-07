import { describe, expect, it } from 'vitest'
import { ARTWORKS } from './catalog.ts'
import { artTransition } from './transition.ts'
const [a,b,c] = ARTWORKS
const start = { base: a!, incoming: null, ready: false }
describe('artwork transitions under slow and failed loads', () => {
  it('keeps the decoded base when a pending image is superseded or fails', () => {
    let state = artTransition(start, { type:'request', artwork:b! })
    state = artTransition(state, { type:'request', artwork:c! })
    expect(state.base).toBe(a)
    state = artTransition(state, { type:'ready', id:b!.id })
    expect(state.ready).toBe(false)
    state = artTransition(state, { type:'failed', id:c!.id })
    expect(state).toEqual(start)
  })
  it('promotes a decoded scene before another transition and ignores stale timers', () => {
    let state = artTransition(start, { type:'request', artwork:b! })
    state = artTransition(state, { type:'ready', id:b!.id })
    state = artTransition(state, { type:'request', artwork:c! })
    expect(state.base).toBe(b)
    state = artTransition(state, { type:'settle', id:b!.id })
    expect(state.incoming).toBe(c)
    state = artTransition(state, { type:'ready', id:c!.id })
    state = artTransition(state, { type:'settle', id:c!.id })
    expect(state).toEqual({ base:c, incoming:null, ready:false })
  })
  it('cancels a pending request when returning to the visible scene', () => {
    const waiting = artTransition(start,{type:'request',artwork:b!})
    expect(artTransition(waiting,{type:'request',artwork:a!})).toEqual(start)
  })
})
