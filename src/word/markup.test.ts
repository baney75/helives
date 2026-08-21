import { describe, expect, it } from 'vitest'
import { compilePassage, parseVerse, plainText } from './markup.ts'

describe('verse markup', () => {
  it('drops the farskipper paragraph mark and italic brackets', () => {
    const spans = parseVerse('# For God so {loved} the world, that he gave his [only] begotten Son.')
    expect(plainText(spans)).toBe('For God so loved the world, that he gave his only begotten Son.')
    expect(spans.some((span) => span.lit && span.text === 'loved')).toBe(true)
    expect(spans.some((span) => span.italic && span.text === 'only')).toBe(true)
    expect(spans.every((span) => span.voice === 'narrator')).toBe(true)
  })

  it('marks only the words of Christ as speech', () => {
    const spans = parseVerse(
      'Jesus said unto her, «I am the {resurrection}, and the {life}:»',
    )
    expect(plainText(spans)).toBe('Jesus said unto her, I am the resurrection, and the life:')
    const speech = spans.filter((span) => span.voice === 'jesus').map((span) => span.text)
    expect(speech.join('')).toBe('I am the resurrection, and the life:')
    expect(spans[0]?.voice).toBe('narrator')
  })

  it('rejects leftover marks', () => {
    expect(() => parseVerse('«unclosed')).toThrow(/unclosed/)
    expect(() => parseVerse('no close]')).toThrow(/unmatched/)
    expect(() => parseVerse('')).toThrow(/empty/)
  })

  it('compiles a passage the hour can quote', () => {
    const passage = compilePassage('John 3:16', 'life', '«For God so {loved} the world.»')
    expect(passage.ref).toBe('John 3:16')
    expect(passage.text).toBe('For God so loved the world.')
    expect(passage.gatewayQuery).toBe('John 3:16')
    expect(passage.spans.every((span) => span.voice === 'jesus')).toBe(true)
  })
})
