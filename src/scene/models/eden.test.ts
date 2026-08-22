import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sceneBounds } from '../../genesis/sceneTiming.ts'
import {
  EDEN,
  FALL_HANDS,
  FALL_REQUIRED,
  GARDEN_REQUIRED,
  edenPairStory,
  fallFruitStory,
  fallParts,
  gardenParts,
  grovePositions,
  herbPositions,
  knowledgeFruitWorld,
  serpentPoints,
  treesAreDistinct,
} from './eden.ts'

describe('gardenParts', () => {
  it('encodes the Eden set from the in-repo KJV', () => {
    const ids = gardenParts().map((part) => part.id)
    expect(ids).toEqual([...GARDEN_REQUIRED])
    expect(treesAreDistinct()).toBe(true)
    expect(EDEN.life.id).toBe('tree-of-life')
    expect(EDEN.knowledge.id).toBe('tree-of-knowledge')
    expect(EDEN.river.points.length).toBeGreaterThanOrEqual(4)
    expect(EDEN.man.garden[0]).not.toBe(EDEN.woman.garden[0])
  })

  it('keeps the two trees far enough apart to read as two trees', () => {
    const life = gardenParts().find((part) => part.id === 'tree-of-life')
    const knowledge = gardenParts().find((part) => part.id === 'tree-of-knowledge')
    expect(life && knowledge).toBeTruthy()
    if (!life || !knowledge) return
    const dx = life.position[0] - knowledge.position[0]
    const dz = life.position[2] - knowledge.position[2]
    expect(Math.hypot(dx, dz)).toBeGreaterThan(2)
  })
})

describe('fallParts', () => {
  it('encodes serpent, fruit taken and eaten, and sending-forth', () => {
    const ids = fallParts().map((part) => part.id)
    for (const id of FALL_REQUIRED) {
      expect(ids).toContain(id)
    }
    expect(ids).toContain('east-flame')
    const fruit = fallParts().find((part) => part.id === 'fruit-taken')
    const eaten = fallParts().find((part) => part.id === 'eaten')
    expect(fruit?.position).toEqual(knowledgeFruitWorld())
    expect(eaten?.position[1]).toBeGreaterThan(0.9)
    expect(EDEN.man.depart[0]).toBeGreaterThan(EDEN.man.garden[0])
    expect(EDEN.woman.depart[0]).toBeGreaterThan(EDEN.woman.garden[0])
  })

  it('coils the serpent around the knowledge tree toward the fruit', () => {
    const pts = serpentPoints()
    expect(pts.length).toBeGreaterThan(8)
    const last = pts[pts.length - 1]
    const fruit = knowledgeFruitWorld()
    expect(last).toBeTruthy()
    if (!last) return
    expect(Math.hypot(last[0] - fruit[0], last[1] - fruit[1], last[2] - fruit[2])).toBeLessThan(0.2)
    const mid = pts[Math.floor(pts.length / 2)]
    expect(mid).toBeTruthy()
    if (!mid) return
    const radial = Math.hypot(mid[0] - EDEN.knowledge.position[0], mid[2] - EDEN.knowledge.position[2])
    expect(radial).toBeGreaterThan(0.15)
    expect(radial).toBeLessThan(0.6)
  })

  it('keeps the fruit on a continuous tree to woman to man arc before it is eaten', () => {
    expect(fallFruitStory(0.11).visible).toBe(false)
    expect(fallFruitStory(0.11).holder).toBe('tree')
    expect(fallFruitStory(0.2).holder).toBe('air')
    expect(fallFruitStory(0.2).visible).toBe(true)
    expect(fallFruitStory(0.32).to).toEqual(FALL_HANDS.woman)
    expect(fallFruitStory(0.32).holder).toBe('woman')
    expect(fallFruitStory(0.32).visible).toBe(false)
    expect(fallFruitStory(0.49).from).toEqual(FALL_HANDS.woman)
    expect(fallFruitStory(0.49).holder).toBe('woman')
    expect(fallFruitStory(0.5).holder).toBe('woman')
    expect(fallFruitStory(0.68).to).toEqual(FALL_HANDS.man)
    expect(fallFruitStory(0.68).holder).toBe('man')
    expect(fallFruitStory(0.7).eatenScale).toBeLessThan(1)
    expect(fallFruitStory(0.74).visible).toBe(false)
    expect(fallFruitStory(0.74).holder).toBe('none')
    expect(FALL_HANDS.woman[1]).toBeGreaterThan(0.9)
    expect(FALL_HANDS.man[1]).toBeGreaterThan(0.9)
  })
})

describe('edenPairStory', () => {
  const fall = sceneBounds('fall')
  const atFall = (local: number) => fall.start + (fall.end - fall.start) * local

  it('keeps the pair standing in the garden beat', () => {
    const garden = sceneBounds('garden')
    const story = edenPairStory((garden.start + garden.end) / 2)
    expect(story.beat).toBe(0)
    expect(story.leave).toBe(0)
    expect(story.fade).toBe(1)
  })

  it('holds Adam and Eve in frame for the Fall capture beat', () => {
    const story = edenPairStory(atFall(0.5))
    expect(story.beat).toBeGreaterThan(0.4)
    expect(story.beat).toBeLessThan(0.6)
    expect(story.leave).toBe(0)
    expect(story.fade).toBe(1)
  })

  it('sends them east before they fade', () => {
    const walking = edenPairStory(atFall(0.92))
    expect(walking.leave).toBeGreaterThan(0.9)
    expect(walking.fade).toBe(1)
    const closing = sceneBounds('closing')
    expect(edenPairStory(closing.start + (closing.end - closing.start) * 0.8).fade).toBeLessThan(0.2)
  })
})

describe('grovePositions', () => {
  it('does not plant extras on the hero trees or the river', () => {
    const pos = grovePositions(10, 27)
    expect(pos.length).toBeGreaterThanOrEqual(9)
    for (let i = 0; i < pos.length / 3; i += 1) {
      const x = pos[i * 3] ?? 0
      const z = pos[i * 3 + 2] ?? 0
      const life = Math.hypot(x - EDEN.life.position[0], z - EDEN.life.position[2])
      const knowledge = Math.hypot(x - EDEN.knowledge.position[0], z - EDEN.knowledge.position[2])
      expect(life).toBeGreaterThan(1.1)
      expect(knowledge).toBeGreaterThan(1.1)
      expect(z).toBeLessThan(-0.75)
    }
  })

  it('still plants herbs for the low tier', () => {
    expect(herbPositions(18, 88).length).toBeGreaterThanOrEqual(18)
  })
})

describe('target stills', () => {
  it('keeps compressed non-shipping art references and their prompts under docs/targets', () => {
    for (const name of ['garden', 'fall', 'art-direction-v1', 'cosmic-origin-v1'] as const) {
      const webp = readFileSync(resolve(`docs/targets/genesis/${name}.webp`))
      const prompt = readFileSync(resolve(`docs/targets/genesis/${name}.prompt.txt`), 'utf8')
      expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect(webp.byteLength).toBeGreaterThan(8_000)
      expect(webp.byteLength).toBeLessThan(400_000)
      expect(prompt.trim().length).toBeGreaterThan(20)
    }
  })
})
