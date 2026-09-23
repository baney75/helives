// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUDIO_CUES } from '../genesis/audioCues.ts'
import { SCENE_ORDER, sceneBounds, sceneSeconds } from '../genesis/sceneTiming.ts'
import { GenesisIllustration } from './GenesisIllustration.tsx'
import { localSceneProgress, marks } from './illustration.ts'

const visibility = vi.hoisted(() => ({ visible: true }))
vi.mock('../hooks/useDocumentVisible.ts', () => ({ useDocumentVisible: () => visibility.visible }))

describe('Genesis illustrations', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    visibility.visible = true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has a complete labelled artwork for every chapter of the experience', () => {
    for (const sceneId of SCENE_ORDER) {
      const html = renderToStaticMarkup(createElement(GenesisIllustration, {
        sceneId, progress: sceneBounds(sceneId).start, playing: false, reducedMotion: true,
      }))
      expect(html).toContain(`genesis-illustration--${sceneId}`)
      expect(html).toContain('role="img"')
      expect(html).toContain('aria-label=')
      expect(html).toContain('<path')
    }
  })

  it('keeps geometry and seek position deterministic', () => {
    expect(marks(10, 42, [0, 0, 100, 100])).toEqual(marks(10, 42, [0, 0, 100, 100]))
    const { start, end } = sceneBounds('fall')
    expect(localSceneProgress('fall', start)).toBe(0)
    expect(localSceneProgress('fall', (start + end) / 2)).toBeCloseTo(.5)
    expect(localSceneProgress('fall', end)).toBe(1)
  })

  it('updates the still on seek and only runs frames while visible and playing', () => {
    let next = 0
    const frames = new Map<number, FrameRequestCallback>()
    const request = vi.fn((callback: FrameRequestCallback) => { frames.set(++next, callback); return next })
    const cancel = vi.fn((id: number) => { frames.delete(id) })
    vi.stubGlobal('requestAnimationFrame', request)
    vi.stubGlobal('cancelAnimationFrame', cancel)

    const host = document.createElement('div')
    const root = createRoot(host)
    const { start, end } = sceneBounds('fall')
    const render = (progress: number, playing: boolean, reducedMotion = false) => act(() => root.render(
      createElement(GenesisIllustration, { sceneId: 'fall', progress, playing, reducedMotion }),
    ))

    render(start, false)
    const svg = host.querySelector('svg')!
    expect(request).not.toHaveBeenCalled()
    expect(svg.style.getPropertyValue('--gi-local')).toBe('0.0000')
    expect(svg.style.getPropertyValue('--gi-cover')).toBe('0.0000')

    render((start + end) / 2, false)
    expect(svg.style.getPropertyValue('--gi-local')).toBe('0.5000')
    expect(svg.style.getPropertyValue('--gi-fruit-y')).not.toBe('0.00px')
    expect(request).not.toHaveBeenCalled()

    const give = AUDIO_CUES.fall.find((cue) => 'action' in cue && cue.action === 'give')!
    const beforeGive = start + (give.end - .1) / sceneSeconds('fall') * (end - start)
    render(beforeGive, false)
    expect(svg.style.getPropertyValue('--gi-cover')).toBe('0.0000')
    const afterGive = start + (give.end + 1.5) / sceneSeconds('fall') * (end - start)
    render(afterGive, false)
    expect(svg.style.getPropertyValue('--gi-cover')).toBe('1.0000')

    render((start + end) / 2, true)
    expect(request).toHaveBeenCalledTimes(1)
    const callback = frames.get(next)!
    frames.delete(next)
    callback(0)
    expect(request).toHaveBeenCalledTimes(2)

    render((start + end) / 2, false)
    expect(cancel).toHaveBeenCalled()
    expect(frames.size).toBe(0)

    render(end, true, true)
    expect(request).toHaveBeenCalledTimes(2)
    expect(svg.style.getPropertyValue('--gi-local')).toBe('1.0000')
    expect(svg.style.getPropertyValue('--gi-cover')).toBe('1.0000')

    visibility.visible = false
    render(end, true)
    expect(request).toHaveBeenCalledTimes(2)

    act(() => root.unmount())
  })

  it('stages creation against cue time and stops a scene fade on pause', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const priorAnimate = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'animate')
    const transition = { cancel: vi.fn(), finish: vi.fn(), onfinish: null } as unknown as Animation
    const animate = vi.fn(() => transition)
    Object.defineProperty(SVGSVGElement.prototype, 'animate', { configurable: true, value: animate })
    const host = document.createElement('div')
    const root = createRoot(host)
    const day3 = sceneBounds('day3')
    const render = (sceneId: 'day3' | 'day4' | 'day5', progress: number, playing: boolean) => act(() => root.render(
      createElement(GenesisIllustration, { sceneId, progress, playing, reducedMotion: false }),
    ))

    render('day3', day3.start, false)
    const svg = host.querySelector('svg')!
    expect(svg.style.getPropertyValue('--gi-grow')).toBe('1.0000')
    render('day4', sceneBounds('day4').start, true)
    expect(animate).toHaveBeenCalledTimes(1)
    render('day3', day3.start, true)
    expect(svg.style.getPropertyValue('--gi-grow')).toBe('0.0000')
    const midGrowth = day3.start + (day3.end - day3.start) * (AUDIO_CUES.day3[3]!.start + 3.5) / sceneSeconds('day3')
    render('day3', midGrowth, true)
    const beforePause = svg.style.getPropertyValue('--gi-grow')
    expect(Number(beforePause)).toBeGreaterThan(0)
    expect(Number(beforePause)).toBeLessThan(1)
    render('day3', midGrowth, false)
    expect(svg.style.getPropertyValue('--gi-grow')).toBe(beforePause)
    render('day3', day3.end, true)
    expect(svg.style.getPropertyValue('--gi-grow')).toBe('1.0000')

    render('day4', sceneBounds('day4').start, false)
    expect(animate).toHaveBeenCalledTimes(2)
    render('day5', sceneBounds('day5').start, true)
    expect(animate).toHaveBeenCalledTimes(3)
    render('day5', sceneBounds('day5').start, false)
    expect(transition.finish).toHaveBeenCalledTimes(2)
    act(() => root.unmount())
    if (priorAnimate) Object.defineProperty(SVGSVGElement.prototype, 'animate', priorAnimate)
    else Reflect.deleteProperty(SVGSVGElement.prototype, 'animate')
  })
})
