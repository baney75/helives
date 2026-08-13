import { describe, expect, it } from 'vitest'
import { readAppMode } from './mode.ts'

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
})
