import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('shipping Garden and Fall source', () => {
  it('does not ship the icosahedron grove or capsule-only pair', () => {
    const garden = readFileSync(join(here, 'Garden.tsx'), 'utf8')
    expect(garden).not.toMatch(/icosahedronGeometry/)
    expect(garden).toMatch(/TreeOfLife/)
    expect(garden).toMatch(/TreeOfKnowledge/)
    expect(garden).toMatch(/function River/)
    expect(garden).toMatch(/role="man"/)
    expect(garden).toMatch(/role="woman"/)
    expect(garden).toMatch(/lerp3/)
    expect(garden).toMatch(/edenPairStory/)
    const figure = readFileSync(join(here, '../models/Figure.tsx'), 'utf8')
    expect(figure).toMatch(/models\/genesis\/man\.glb/)
    expect(figure).not.toMatch(/man\.png/)
    expect(garden).toMatch(/from '\.\.\/models\/eden\.ts'/)
  })

  it('uses flat leaves on the hero trees instead of sphere canopies', () => {
    const trees = readFileSync(join(here, '../models/Trees.tsx'), 'utf8')
    expect(trees).toMatch(/createLeafGeometry/)
    expect(trees).toMatch(/LeafCanopy/)
    expect(trees).not.toMatch(/sphereGeometry args=\{\[0\.22, 8, 8\]\}/)
  })

  it('does not ship the lone tube-curve plus red orb', () => {
    const fall = readFileSync(join(here, 'TheFall.tsx'), 'utf8')
    expect(fall).toMatch(/function Serpent/)
    expect(fall).toMatch(/function TakenFruit/)
    expect(fall).not.toMatch(/<Figure/)
    expect(fall).toMatch(/function EastFlame/)
    expect(fall).toMatch(/createTaperedTube/)
    expect(fall).not.toMatch(/TubeGeometry\(curve, 32, 0\.035/)
    expect(fall).not.toMatch(/sphereGeometry args=\{\[0\.09, 10, 10\]\}/)
  })

  it('uses authored fish and bird meshes instead of sphere/cone stand-ins', () => {
    const creatures = readFileSync(join(here, 'LivingCreatures.tsx'), 'utf8')
    expect(creatures).toMatch(/createFishGeometry/)
    expect(creatures).toMatch(/createBirdGeometry/)
    expect(creatures).toMatch(/models\/genesis\/fish\.glb/)
    expect(creatures).toMatch(/models\/genesis\/bird\.glb/)
    expect(creatures).not.toMatch(/sphereGeometry args=\{\[1, 6, 4\]\}/)
    expect(creatures).not.toMatch(/coneGeometry args=\{\[0\.6, 1\.6, 3\]\}/)
  })
})
