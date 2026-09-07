// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { INTERACTIVE_SECONDS, sceneBounds } from '../genesis/sceneTiming.ts'
import type { NarrationControl } from './useNarration.ts'
import { useNarration } from './useNarration.ts'

const clips: { currentTime: number; duration: number; readyState: number; playbackRate: number; dispatchEvent: (event: Event) => boolean; paused: boolean; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; removeEventListener: EventTarget['removeEventListener'] }[] = []
function AudioMock() {
  const events = new EventTarget()
  const clip = {
    currentTime: 0, duration: 12, readyState: 1, playbackRate: 1,
    dispatchEvent: events.dispatchEvent.bind(events),
    paused: true,
    play: vi.fn(async () => { clip.paused = false }),
    pause: vi.fn(() => { clip.paused = true }),
    setAttribute: vi.fn(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
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

it('recovers blocked autoplay with one retry while the parent clock is paused', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let allowPlayback = false
  function BlockingAudioMock() {
    const clip = AudioMock()
    clip.play.mockImplementation(async () => {
      if (!allowPlayback) throw new DOMException('gesture required', 'NotAllowedError')
      clip.paused = false
    })
    return clip
  }
  vi.stubGlobal('Audio', BlockingAudioMock)
  let control: NarrationControl | undefined
  function Probe({ playing }: { playing: boolean }) {
    control = useNarration({ sceneId: 'beginning', playing, cinematic: false, speed: 1 })
    return createElement('span', null, control.blocked ? 'blocked' : 'ready')
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(createElement(Probe, { playing: true })))
  expect(host.textContent).toBe('blocked')
  const attemptsBeforeRetry = clips.at(-1)!.play.mock.calls.length
  await act(async () => root.render(createElement(Probe, { playing: false })))
  allowPlayback = true
  await act(async () => { await control!.retry() })
  expect(clips.at(-1)?.play).toHaveBeenCalledTimes(attemptsBeforeRetry + 1)
  expect(clips.at(-1)?.paused).toBe(false)
  expect(host.textContent).toBe('ready')
  await act(async () => root.unmount())
})

it('seeks within the same scene, follows media time during stalls, and resumes at the muted position', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Audio', AudioMock)
  let control: NarrationControl | undefined
  function Probe({ progress, seekVersion, muted = false, speed = 1 }: { progress: number; seekVersion: number; muted?: boolean; speed?: number }) {
    control = useNarration({ sceneId: 'fall', playing: true, cinematic: false, progress, seekVersion, muted, speed })
    return null
  }
  const root = createRoot(document.createElement('div'))
  const start = sceneBounds('fall').start
  const render = async (seconds: number, version: number, muted = false, speed = 1) => {
    await act(async () => root.render(createElement(Probe, { progress: start + seconds / INTERACTIVE_SECONDS, seekVersion: version, muted, speed })))
  }
  await render(4, 0)
  const audio = clips.at(-1)!
  expect(audio.currentTime).toBeCloseTo(4)
  audio.currentTime = 6
  expect(control!.readProgress()).toBeCloseTo(start + 6 / INTERACTIVE_SECONDS)
  // Wall time and render frequency cannot advance a buffering clip.
  expect(control!.readProgress()).toBe(control!.readProgress())
  await render(2, 1)
  expect(clips.at(-1)).toBe(audio)
  expect(audio.currentTime).toBeCloseTo(2)
  await render(2, 1, false, 2)
  expect(audio.playbackRate).toBe(2)
  await render(2, 1, true)
  expect(control!.readProgress()).toBeNull()
  await render(9, 1, false)
  expect(audio.currentTime).toBeCloseTo(9)
  await act(async () => audio.dispatchEvent(new Event('ended')))
  expect(control!.readProgress()).toBeGreaterThanOrEqual(start + audio.duration / INTERACTIVE_SECONDS)
  await render(0, 2)
  expect(audio.currentTime).toBe(0)
  expect(control!.readProgress()).toBeCloseTo(start)
  await act(async () => root.unmount())
})
