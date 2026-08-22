import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Sign } from './Sign.tsx'
import { MOTIFS, type Motif } from './types.ts'

function mark(motif: Motif): string {
  return renderToStaticMarkup(createElement(Sign, { motif, reducedMotion: true }))
}

describe('hour lamp signs', () => {
  it('draws one authored line per motif instead of Lucide clipart', () => {
    const light = mark('light')
    const water = mark('water')
    const lamp = mark('lamp')
    const vine = mark('vine')
    const life = mark('life')

    expect(light).toContain('sign-dawn')
    expect(light).toContain('A single dawn line opening across the void')
    expect(water).toContain('M8 72 Q 40 68 72 72 T 136 72')
    expect(lamp).toContain('sign-wick')
    expect(lamp).toContain('sign-flame')
    expect(vine).toContain('M28 120 C 40 80, 48 70, 72 52')
    expect(life).toContain('brand-mark')

    const all = [light, water, lamp, vine, life].join('\n')
    expect(all).not.toContain('M4.077 10.615')
    expect(all).not.toContain('M2 6c.6.5')
    expect(all).not.toContain('M14 9.536')
    expect(all).not.toContain('cx="12" cy="12" r="4"')
    expect(all).not.toMatch(/lucide/i)
  })

  it('covers every motif the pool can assign', () => {
    expect(MOTIFS).toEqual(['light', 'water', 'lamp', 'vine', 'life'])
    for (const motif of MOTIFS) {
      expect(mark(motif)).toContain(`data-motif="${motif}"`)
    }
  })
})
