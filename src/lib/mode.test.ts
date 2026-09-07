import { describe, expect, it } from 'vitest'
import { readAppMode, sceneUrl } from './mode.ts'
import { SCENES } from '../genesis/scenes.ts'

describe('readAppMode', () => {
  it('defaults to interactive', () => {
    expect(readAppMode('')).toEqual({ cinematic: false, pause: false, progress: null })
    expect(readAppMode('?')).toEqual({ cinematic: false, pause: false, progress: null })
  })

  it('enables cinematic from a flag or mode value', () => {
    expect(readAppMode('?cinematic')).toMatchObject({ cinematic: true })
    expect(readAppMode('?cinematic=1')).toMatchObject({ cinematic: true })
    expect(readAppMode('?mode=cinematic')).toMatchObject({ cinematic: true })
  })

  it('reads pause and clamped progress for stills', () => {
    expect(readAppMode('?pause&progress=0.58')).toEqual({
      cinematic: false,
      pause: true,
      progress: 0.58,
    })
    expect(readAppMode('?progress=-1')).toMatchObject({ progress: 0 })
    expect(readAppMode('?progress=2')).toMatchObject({ progress: 1 })
    expect(readAppMode('?progress=nope')).toMatchObject({ progress: null })
  })

  it('ignores unrelated query keys', () => {
    expect(readAppMode('?speed=4')).toMatchObject({ cinematic: false })
  })

  it('starts a valid scene link at its canonical scene start', () => {
    const fall = SCENES.find((scene) => scene.id === 'fall')!
    expect(readAppMode('?scene=fall')).toMatchObject({ progress: fall.start })
    expect(readAppMode('?scene=unknown')).toMatchObject({ progress: null })
  })

  it('prefers explicit valid progress over a scene link', () => {
    expect(readAppMode('?scene=fall&progress=0.2')).toMatchObject({ progress: 0.2 })
    expect(readAppMode('?scene=fall&progress=nope')).toMatchObject({ progress: SCENES.find((scene) => scene.id === 'fall')!.start })
  })

  it('builds a scene URL without stale progress and keeps display settings', () => {
    expect(sceneUrl('?quality=low&cinematic=1&progress=.4&extra=kept', 'garden', true))
      .toBe('/genesis?quality=low&cinematic=1&extra=kept&scene=garden&pause=1')
    expect(sceneUrl('?pause=1&quality=high', 'beginning', false))
      .toBe('/genesis?quality=high&scene=beginning')
  })
})
