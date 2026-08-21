import { describe, expect, it } from 'vitest'
import { POOL } from './pool.ts'
import { hasWordsOfChrist, MOTIFS, type Motif } from './types.ts'

const ALLOWED = new Set<Motif>(MOTIFS)

const CHRIST_SPEAKS = new Set([
  'John 8:12',
  'Matthew 5:16',
  'John 4:14',
  'John 7:38',
  'Matthew 5:15',
  'John 15:5',
  'John 15:1',
  'John 15:4',
  'John 14:19',
  'John 11:25',
  'John 14:6',
  'John 3:16',
  'John 10:10',
  'Revelation 1:18',
  'John 6:35',
])

const FARSKIPPER: Record<string, string> = {
  'Genesis 1:3': 'And God said, Let there be light: and there was light.',
  'John 8:12':
    'Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.',
  'Psalm 27:1':
    'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?',
  'Isaiah 60:1': 'Arise, shine; for thy light is come, and the glory of the LORD is risen upon thee.',
  'John 3:16':
    'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  'John 14:19': 'Yet a little while, and the world seeth me no more; but ye see me: because I live, ye shall live also.',
  'Luke 24:6': 'He is not here, but is risen: remember how he spake unto you when he was yet in Galilee,',
  'Revelation 1:18':
    'I am he that liveth, and was dead; and, behold, I am alive for evermore, Amen; and have the keys of hell and of death.',
  'John 1:9': 'That was the true Light, which lighteth every man that cometh into the world.',
  'Proverbs 6:23':
    'For the commandment is a lamp; and the law is light; and reproofs of instruction are the way of life:',
}

describe('word pool', () => {
  it('gives every row a motif, a full verse, spans, and a gateway query', () => {
    expect(POOL.length).toBe(48)
    for (const passage of POOL) {
      expect(ALLOWED.has(passage.motif)).toBe(true)
      expect(passage.text.length).toBeGreaterThan(20)
      expect(passage.ref.length).toBeGreaterThan(3)
      expect(passage.gatewayQuery).toBe(passage.ref)
      expect(passage.spans.map((span) => span.text).join('')).toBe(passage.text)
      expect('#«»{}[]'.split('').some((mark) => passage.text.includes(mark))).toBe(false)
    }
  })

  it('does not treat the John 14:19 fragment as the hour', () => {
    const john = POOL.find((row) => row.ref === 'John 14:19')
    expect(john?.text.startsWith('Yet a little while')).toBe(true)
    expect(john?.motif).toBe('life')
    expect(hasWordsOfChrist(john!)).toBe(true)
  })

  it('tags Genesis 1:3 as light, not Genesis 1:1', () => {
    expect(POOL.some((row) => row.ref === 'Genesis 1:1')).toBe(false)
    expect(POOL.find((row) => row.ref === 'Genesis 1:3')?.motif).toBe('light')
    expect(hasWordsOfChrist(POOL.find((row) => row.ref === 'Genesis 1:3')!)).toBe(false)
  })

  it('marks only the words of Christ in red-letter hours', () => {
    for (const passage of POOL) {
      expect(hasWordsOfChrist(passage)).toBe(CHRIST_SPEAKS.has(passage.ref))
    }
    const john = POOL.find((row) => row.ref === 'John 11:25')
    const speech = john?.spans.filter((span) => span.voice === 'jesus').map((span) => span.text).join('')
    expect(speech).toBe('I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:')
    expect(john?.spans[0]?.voice).toBe('narrator')
  })

  it('matches the 1769 public-domain wording on the checked refs', () => {
    for (const [ref, expected] of Object.entries(FARSKIPPER)) {
      expect(POOL.find((row) => row.ref === ref)?.text).toBe(expected)
    }
  })
})
