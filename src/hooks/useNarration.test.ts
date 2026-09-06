// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useNarration } from './useNarration.ts'

const clips: { paused: boolean; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }[] = []
function AudioMock() {
  const clip = {
    paused: true,
    play: vi.fn(async () => { clip.paused = false }),
    pause: vi.fn(() => { clip.paused = true }),
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
  }
  clips.push(clip)
  return clip
}
function Player({ playing, muted = false }: { playing: boolean; muted?: boolean }) {
  const narration = useNarration({ sceneId: 'beginning', playing, muted, cinematic: false, speed: 1 })
  return createElement('span', null, narration.blocked ? 'blocked' : 'ready')
}
afterEach(() => { vi.unstubAllGlobals(); clips.length = 0 })
it('keeps a paused entry silent and follows play, mute, and unmount under StrictMode', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Audio', AudioMock)
  const root = createRoot(document.createElement('div'))
  const render = async (playing: boolean, muted = false) => {
    await act(async () => root.render(createElement(StrictMode, null, createElement(Player, { playing, muted }))))
  }
  await render(false)
  expect(clips.every((clip) => clip.play.mock.calls.length === 0)).toBe(true)
  await render(true)
  expect(clips.at(-1)?.paused).toBe(false)
  await render(true, true)
  expect(clips.every((clip) => clip.paused)).toBe(true)
  await render(true, false)
  expect(clips.at(-1)?.paused).toBe(false)
  await act(async () => root.unmount())
  expect(clips.every((clip) => clip.paused)).toBe(true)
})

it('does not show an autoplay gate when pausing interrupts an outstanding play request', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Audio', AudioMock)
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(createElement(Player, { playing: false })))
  let interrupt!: (error: Error) => void
  clips.at(-1)!.play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { interrupt = reject }))
  await act(async () => root.render(createElement(Player, { playing: true })))
  await act(async () => root.render(createElement(Player, { playing: false })))
  await act(async () => interrupt(new DOMException('Interrupted by pause', 'AbortError')))
  expect(host.textContent).toBe('ready')
  await act(async () => root.unmount())
})
