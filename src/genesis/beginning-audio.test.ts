import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KJV } from './kjv.ts'
import { FALL_VOICE_CUES, NARRATION, SCENE_VOICE_CUES } from './script.ts'
import { hasVoice, narrationFile, VOICED_IDS } from './voiced.ts'

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

describe('first Genesis voice', () => {
  it('lists beginning only as a real mp3 filename', () => {
    expect(VOICED_IDS).toContain('beginning')
    expect(hasVoice('beginning')).toBe(true)
    expect(narrationFile('beginning')).toBe('beginning.mp3')
    expect(hasVoice('garden')).toBe(true)
    expect(narrationFile('garden')).toBe('garden.mp3')
  })

  it('keeps the beginning script as KJV gen1_1 + gen1_2', () => {
    expect(NARRATION.beginning).toBe(`${KJV.gen1_1} ${KJV.gen1_2}`)
  })

  it('uses exact KJV dialogue with distinct Fall character roles', () => {
    expect(FALL_VOICE_CUES.map((cue) => cue.role)).toEqual([
      'narrator',
      'serpent',
      'woman',
      'serpent',
      'narrator',
      'narrator',
      'god',
      'man',
      'god',
      'man',
      'narrator',
      'god',
      'woman',
      'narrator',
    ])
    expect(FALL_VOICE_CUES.find((cue) => cue.role === 'serpent')?.text).toBe(KJV.gen3_1_serpent)
    expect(NARRATION.fall).not.toContain('Go to church')
    const generator = readFileSync(resolve('scripts/generate-audio.mjs'), 'utf8')
    expect(generator).toContain('SCENE_VOICE_CUES')
    expect(generator).toContain('for (const [index, cue] of cues.entries())')
    expect(generator).not.toContain('FALL_VOICE_CUES.entries()')
    expect(generator).not.toMatch(/const NARRATION\s*=/)
    expect(generator).not.toMatch(/const FALL_CUES\s*=/)
    expect(generator).toContain("model: 'tts-1-hd'")
    expect(generator).toContain('assertMpegAudio')
  })

  it('uses a male narrator and a slower bass-shaped God voice', () => {
    const generator = readFileSync(resolve('scripts/generate-audio.mjs'), 'utf8')
    expect(generator).toContain("narrator: { oneMin: 'echo'")
    expect(generator).toContain("god: { oneMin: 'onyx', speed: 0.82")
    expect(generator).toContain("role === 'god'")
    expect(generator).toContain('bass=g=4:f=110')
  })

  it('autoplays narration independently of reduced-motion visuals', () => {
    const clock = readFileSync(resolve('src/hooks/useGenesisClock.ts'), 'utf8')
    const narration = readFileSync(resolve('src/hooks/useNarration.ts'), 'utf8')
    const page = readFileSync(resolve('src/pages/GenesisPage.tsx'), 'utf8')
    expect(clock).toContain('useState(!start.pause)')
    expect(clock).not.toContain('!reducedMotion && !start.pause')
    expect(narration).toContain('audio.autoplay = true')
    expect(narration).toContain('if (playing)')
    expect(narration).toContain('if (audio.paused) void retry()')
    expect(narration).toContain("audio.addEventListener('ended'")
    expect(narration).toContain('AUDIO_BREATH_SECONDS')
    expect(narration).toContain('hold')
    expect(narration).not.toContain('playing && !reducedMotion')
    expect(narration).not.toMatch(/else\s*\{\s*audio\.pause\(\)\s*setBlocked\(false\)/)
    expect(page).toContain('Begin with sound')
    expect(page).toContain('clock.pause()')
  })

  it('keeps every role-aware composite text identical to canonical narration', () => {
    for (const [id, cues] of Object.entries(SCENE_VOICE_CUES)) {
      expect(normalize(cues!.map((cue) => cue.text).join(' '))).toBe(normalize(NARRATION[id as keyof typeof NARRATION]))
    }
    expect(SCENE_VOICE_CUES.day2?.some((cue) => cue.role === 'god')).toBe(true)
    expect(SCENE_VOICE_CUES.day5?.some((cue) => cue.role === 'god')).toBe(true)
  })

  it('ships the complete multi-character Fall performance as MPEG audio', () => {
    const buf = readFileSync(resolve('public/audio/fall.mp3'))
    expect(buf.byteLength).toBeGreaterThan(1_000_000)
    const head = buf.subarray(0, 16)
    const asText = head.toString('ascii')
    const id3 = asText.startsWith('ID3')
    const mpeg = head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0
    expect(id3 || mpeg).toBe(true)
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
