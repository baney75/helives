import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('ships a real mp3 for every voiced id', () => {
    for (const id of [...VOICED_IDS, 'trailer'] as const) {
      const file = narrationFile(id)
      expect(file).toBe(`${id}.mp3`)
      const buf = readFileSync(resolve('public/audio', file!))
      expect(buf.byteLength).toBeGreaterThan(8_000)
      const head = buf.subarray(0, 16).toString('ascii')
      expect(head.startsWith('<!')).toBe(false)
      const id3 = head.startsWith('ID3')
      const mpeg = buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0
      expect(id3 || mpeg).toBe(true)
    }
  })

  it('voices the trailer only when the mp3 is listed as available', () => {
    expect(hasVoice('trailer')).toBe(true)
    expect(narrationFile('trailer')).toBe('trailer.mp3')
    const voiced = new Set<string>(VOICED_IDS)
    for (const scene of SCENES) {
      expect(voiced.has(scene.id)).toBe(true)
      expect(hasVoice(scene.id)).toBe(true)
    }
  })
})
