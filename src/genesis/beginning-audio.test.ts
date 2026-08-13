import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KJV } from './kjv.ts'
import { NARRATION } from './script.ts'
import { hasVoice, narrationFile, VOICED_IDS } from './voiced.ts'

describe('first Genesis voice', () => {
  it('lists beginning only as a real mp3 filename', () => {
    expect(VOICED_IDS).toContain('beginning')
    expect(hasVoice('beginning')).toBe(true)
    expect(narrationFile('beginning')).toBe('beginning.mp3')
    expect(hasVoice('garden')).toBe(false)
    expect(narrationFile('garden')).toBeNull()
  })

  it('keeps the beginning script as KJV gen1_1 + gen1_2', () => {
    expect(NARRATION.beginning).toBe(`${KJV.gen1_1} ${KJV.gen1_2}`)
  })

  it('ships public/audio/beginning.mp3 as MPEG audio, not HTML', () => {
    const buf = readFileSync(resolve('public/audio/beginning.mp3'))
    expect(buf.byteLength).toBeGreaterThan(8_000)
    const head = buf.subarray(0, 16)
    const asText = head.toString('ascii')
    expect(asText.startsWith('<!')).toBe(false)
    expect(asText.startsWith('<html')).toBe(false)
    const id3 = asText.startsWith('ID3')
    const mpeg = head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0
    expect(id3 || mpeg).toBe(true)
  })
})
