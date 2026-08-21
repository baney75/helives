import { describe, expect, it } from 'vitest'
import { findSceneAt, presenceById, SCENES, scenePresence, type SceneId } from './scenes.ts'
import { cameraDistance, cameraPose, framedCamera, visualScale } from './time.ts'

function midpoint(id: SceneId): number {
  const scene = SCENES.find((item) => item.id === id)!
  return (scene.start + scene.end) / 2
}

describe('findSceneAt', () => {
  it('starts in the beginning', () => {
    expect(findSceneAt(0).id).toBe('beginning')
  })

  it('hits day 1 at the light', () => {
    expect(findSceneAt(midpoint('day1')).id).toBe('day1')
  })

  it('reaches the garden before the fall', () => {
    expect(findSceneAt(midpoint('garden')).id).toBe('garden')
    expect(findSceneAt(midpoint('fall')).id).toBe('fall')
  })

  it('ends on the measured sky after the invitation', () => {
    expect(findSceneAt(midpoint('closing')).id).toBe('closing')
    expect(findSceneAt(midpoint('doubt')).id).toBe('doubt')
    expect(findSceneAt(1).id).toBe('measure')
    expect(findSceneAt(1).kind).toBe('science')
  })

  it('covers every scene at its midpoint', () => {
    for (const scene of SCENES) {
      const midValue = (scene.start + scene.end) / 2
      expect(findSceneAt(midValue).id).toBe(scene.id)
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
    const day7 = SCENES.find((s) => s.id === 'day7')!
    expect(scenePresence((day7.start + day7.end) / 2, day7)).toBe(1)
  })
})

describe('visual helpers', () => {
  it('pulls the camera back for the heavens', () => {
    expect(cameraDistance(midpoint('day4'))).toBeGreaterThan(cameraDistance(midpoint('beginning')))
  })

  it('frames garden and fall from above the planted floor', () => {
    const garden = framedCamera(midpoint('garden'))
    const fall = framedCamera(midpoint('fall'))
    expect(garden.y).toBeGreaterThan(1.2)
    expect(fall.y).toBeGreaterThan(1.2)
    expect(garden.z).toBeGreaterThan(4)
    expect(fall.z).toBeGreaterThan(4)
  })

  it('grows scale through the creation week', () => {
    expect(visualScale(midpoint('day6'))).toBeGreaterThan(visualScale(0))
  })

  it('uses authored, materially distinct camera positions across the journey', () => {
    const positions = SCENES.map((scene) => cameraPose(midpoint(scene.id)).position.map((value) => value.toFixed(2)).join(','))
    expect(new Set(positions).size).toBeGreaterThanOrEqual(11)
    expect(cameraPose(midpoint('day5'), true).target[1]).toBeGreaterThan(0)
  })

  it('follows Adam and Eve east on the narrow Fall rail', () => {
    const fall = SCENES.find((scene) => scene.id === 'fall')
    expect(fall).toBeTruthy()
    if (!fall) return
    const late = fall.start + (fall.end - fall.start) * 0.86
    expect(cameraPose(late, true).target[0]).toBeGreaterThan(cameraPose(late, false).target[0])
    expect(cameraPose(late, true).target[0]).toBeGreaterThan(1.4)
  })
})
