import type { Motif, Passage, VerseSpan, Voice } from './types.ts'

/**
 * Verse markup (never shown):
 *   «…»  words of Christ
 *   {…}  a word set apart
 *   […]  KJV italic / supplied word (farskipper 1769)
 *   leading `# ` is a paragraph mark and is dropped
 */
export function parseVerse(source: string): VerseSpan[] {
  const input = source.replace(/^#\s*/, '')
  const spans: VerseSpan[] = []
  let voice: Voice = 'narrator'
  let lit = false
  let italic = false
  let buf = ''

  const flush = () => {
    if (!buf) return
    spans.push({
      text: buf,
      voice,
      ...(lit ? { lit: true as const } : {}),
      ...(italic ? { italic: true as const } : {}),
    })
    buf = ''
  }

  for (const ch of input) {
    if (ch === '«') {
      if (voice === 'jesus') throw new Error('nested speech mark')
      flush()
      voice = 'jesus'
      continue
    }
    if (ch === '»') {
      if (voice !== 'jesus') throw new Error('unmatched closing speech mark')
      flush()
      voice = 'narrator'
      continue
    }
    if (ch === '{') {
      if (lit) throw new Error('nested lit mark')
      flush()
      lit = true
      continue
    }
    if (ch === '}') {
      if (!lit) throw new Error('unmatched closing lit mark')
      flush()
      lit = false
      continue
    }
    if (ch === '[') {
      if (italic) throw new Error('nested italic mark')
      flush()
      italic = true
      continue
    }
    if (ch === ']') {
      if (!italic) throw new Error('unmatched closing italic mark')
      flush()
      italic = false
      continue
    }
    buf += ch
  }
  flush()
  if (voice !== 'narrator' || lit || italic) {
    throw new Error('unclosed verse markup')
  }
  if (spans.length === 0) {
    throw new Error('empty verse')
  }
  return spans
}

export function plainText(spans: readonly VerseSpan[]): string {
  return spans.map((span) => span.text).join('')
}

export function compilePassage(ref: string, motif: Motif, source: string, gatewayQuery = ref): Passage {
  const spans = parseVerse(source)
  return {
    ref,
    text: plainText(spans),
    spans,
    motif,
    gatewayQuery,
  }
}
