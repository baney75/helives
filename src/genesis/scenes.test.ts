import { describe, expect, it } from 'vitest'
import { findSceneAt, presenceById, SCENES, scenePresence } from './scenes.ts'
import { cameraDistance, visualScale } from './time.ts'

describe('findSceneAt', () => {
  it('starts in the beginning', () => {
    expect(findSceneAt(0).id).toBe('beginning')
  })

  it('hits day 1 at the light', () => {
    expect(findSceneAt(0.1).id).toBe('day1')
  })

  it('reaches the garden before the fall', () => {
    expect(findSceneAt(0.65).id).toBe('garden')
    expect(findSceneAt(0.74).id).toBe('fall')
  })

  it('ends on the measured sky after the invitation', () => {
    expect(findSceneAt(0.82).id).toBe('closing')
    expect(findSceneAt(0.87).id).toBe('doubt')
    expect(findSceneAt(1).id).toBe('measure')
    expect(findSceneAt(1).kind).toBe('science')
  })

  it('covers every scene at its midpoint', () => {
    for (const scene of SCENES) {
      const mid = (scene.start + scene.end) / 2
      expect(findSceneAt(mid).id).toBe(scene.id)
    }
  })
})

describe('presenceById', () => {
  it('keeps first light after day 1', () => {
    expect(presenceById(0.4).day1).toBeGreaterThan(0.9)
  })

  it('fades the void after day 1', () => {
    expect(presenceById(0.2).beginning).toBe(0)
  })

  it('is 1 inside a non-persistent window', () => {
    expect(scenePresence(0.57, SCENES.find((s) => s.id === 'day7')!)).toBe(1)
  })
})

describe('visual helpers', () => {
  it('pulls the camera back for the heavens', () => {
    expect(cameraDistance(0.4)).toBeGreaterThan(cameraDistance(0.05))
  })

  it('grows scale through the creation week', () => {
    expect(visualScale(0.5)).toBeGreaterThan(visualScale(0))
  })
})
