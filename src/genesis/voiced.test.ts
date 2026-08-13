import { describe, expect, it } from 'vitest'
import { SCENES } from './scenes.ts'
import { hasVoice, narrationFile, VOICED_IDS } from './voiced.ts'

describe('voiced narration', () => {
  it('only lists known scene ids', () => {
    const ids = new Set(SCENES.map((scene) => scene.id))
    for (const id of VOICED_IDS) {
      expect(ids.has(id)).toBe(true)
      expect(hasVoice(id)).toBe(true)
      expect(narrationFile(id)).toBe(`${id}.mp3`)
    }
  })

  it('does not invent voice for unvoiced scenes or the trailer', () => {
    expect(hasVoice('trailer')).toBe(false)
    expect(narrationFile('trailer')).toBeNull()
    const voiced = new Set<string>(VOICED_IDS)
    for (const scene of SCENES) {
      if (!voiced.has(scene.id)) {
        expect(hasVoice(scene.id)).toBe(false)
        expect(narrationFile(scene.id)).toBeNull()
      }
    }
  })
})
