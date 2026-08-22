import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HourLamp } from './HourLamp.tsx'
import { passageAt } from './clock.ts'
import { hasWordsOfChrist } from './types.ts'

describe('HourLamp', () => {
  it('leaves the hour at new scripture, with no church invitation', () => {
    const html = renderToStaticMarkup(
      createElement(HourLamp, { now: new Date('2026-08-15T13:18:48.000Z') }),
    )
    expect(html.toLowerCase()).not.toContain('church')
    expect(html).toContain('New scripture every hour')
    expect(html).toContain('Explore more')
    expect(html).toContain('41:12')
    expect(html).toContain('word-remain-rail')
    expect(html).toContain('word-sign')
    expect(html).not.toContain('M4.077 10.615')
  })

  it('sets words of Christ in the speech class when Jesus speaks', () => {
    const spokenAt = new Date('2026-01-01T00:00:00.000Z')
    let at = spokenAt
    for (let hour = 0; hour < 48; hour += 1) {
      const candidate = new Date(spokenAt.getTime() + hour * 3_600_000)
      if (hasWordsOfChrist(passageAt(candidate))) {
        at = candidate
        break
      }
    }
    expect(hasWordsOfChrist(passageAt(at))).toBe(true)
    const html = renderToStaticMarkup(createElement(HourLamp, { now: at }))
    expect(html).toContain('class="speech')
    expect(html).not.toContain('words of Christ in red')
  })

  it('does not mark Luke 24:6 as the words of Christ', () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    let found = false
    for (let hour = 0; hour < 48; hour += 1) {
      const at = new Date(start.getTime() + hour * 3_600_000)
      const passage = passageAt(at)
      if (passage.ref !== 'Luke 24:6') continue
      found = true
      expect(hasWordsOfChrist(passage)).toBe(false)
      const html = renderToStaticMarkup(createElement(HourLamp, { now: at }))
      expect(html).not.toContain('class="speech')
    }
    expect(found).toBe(true)
  })
})
