import { describe, expect, it } from 'vitest'
import { findSceneAt, SCENES } from './scenes.ts'
import {
  advanceProgress,
  clampedFrameDelta,
  holdAtSceneEnd,
  INTERACTIVE_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  OPENING_HOLD_SECONDS,
  sceneHoldCap,
} from './time.ts'
import { AUDIO_BREATH_SECONDS, SCENE_AUDIO_SECONDS, sceneSeconds } from './sceneTiming.ts'

describe('Genesis clock start', () => {
  it('opens on beginning, not the garden or the fall', () => {
    expect(findSceneAt(0).id).toBe('beginning')
    expect(findSceneAt(0.01).id).toBe('beginning')
    const garden = SCENES.find((scene) => scene.id === 'garden')!
    const fall = SCENES.find((scene) => scene.id === 'fall')!
    expect(findSceneAt((garden.start + garden.end) / 2).id).toBe('garden')
    expect(findSceneAt((fall.start + fall.end) / 2).id).toBe('fall')
  })

  it('holds the first frame briefly, then advances from zero', () => {
    const hold = { current: 0 }
    let stopped = false
    expect(advanceProgress(0, OPENING_HOLD_SECONDS / 2, false, 1, hold, () => {
      stopped = true
    })).toBe(0)
    const next = advanceProgress(0, OPENING_HOLD_SECONDS, false, 1, hold, () => {
      stopped = true
    })
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(0.02)
    expect(stopped).toBe(false)
  })

  it('reaches the end and stops', () => {
    let stopped = false
    const hold = { current: OPENING_HOLD_SECONDS }
    const end = advanceProgress(0.999, INTERACTIVE_SECONDS, false, 1, hold, () => {
      stopped = true
    })
    expect(end).toBe(1)
    expect(stopped).toBe(true)
  })

  it('allocates every scene enough time for its complete voice plus a visual hold', () => {
    for (const [id, duration] of Object.entries(SCENE_AUDIO_SECONDS)) {
      expect(sceneSeconds(id as keyof typeof SCENE_AUDIO_SECONDS)).toBeGreaterThan(duration)
    }
  })

  it('holds the clock on the current scene while MPEG is still speaking', () => {
    const garden = SCENES.find((scene) => scene.id === 'garden')!
    const cap = sceneHoldCap((garden.start + garden.end) / 2)
    expect(findSceneAt(cap).id).toBe('garden')
    expect(holdAtSceneEnd(garden.end - 0.01, garden.end + 0.02, true)).toBeLessThan(garden.end)
    expect(holdAtSceneEnd(0.2, 0.4, false)).toBe(0.4)
    expect(AUDIO_BREATH_SECONDS).toBeGreaterThan(0)
    const hold = { current: OPENING_HOLD_SECONDS }
    const held = advanceProgress(garden.end - 0.002, 2, false, 1, hold, () => undefined, true)
    expect(findSceneAt(held).id).toBe('garden')
  })

  it('does not skip voice or animation beats after a slow render frame', () => {
    expect(clampedFrameDelta(1100, 1000)).toBe(MAX_FRAME_DELTA_SECONDS)
    expect(clampedFrameDelta(1016, 1000)).toBeCloseTo(0.016)
    expect(clampedFrameDelta(900, 1000)).toBe(0)
  })
})
