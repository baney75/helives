import { describe, expect, it } from 'vitest'
import { birdWingspan, createBirdGeometry, createFishGeometry, fishAspect } from './creatures.ts'

describe('createFishGeometry', () => {
  it('is longer than it is tall — a fish, not a sphere', () => {
    const geometry = createFishGeometry()
    const { length, height } = fishAspect(geometry)
    expect(length).toBeGreaterThan(height * 1.6)
    expect(length).toBeGreaterThan(0.8)
    geometry.dispose()
  })
})

describe('createBirdGeometry', () => {
  it('has a wingspan wider than the body length — a bird, not a cone', () => {
    const geometry = createBirdGeometry()
    const { span, length } = birdWingspan(geometry)
    expect(span).toBeGreaterThan(length)
    expect(span).toBeGreaterThan(0.8)
    geometry.dispose()
  })
})

describe('authored hero creature GLBs', () => {
  it('ships articulated fish and bird assets with nontrivial geometry', () => {
    expect(statSync(resolve('public/models/genesis/fish.glb')).size).toBeGreaterThan(60_000)
    expect(statSync(resolve('public/models/genesis/bird.glb')).size).toBeGreaterThan(35_000)
  })
})
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
