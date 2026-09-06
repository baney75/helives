import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Sign } from './Sign.tsx'
import { MOTIFS, type Motif } from './types.ts'

function mark(motif: Motif): string {
  return renderToStaticMarkup(createElement(Sign, { motif, reducedMotion: true }))
}

describe('hour lamp signs', () => {
  it('renders a distinct decorative illustration for each verse motif', () => {
    for (const [motif, title] of [['light', 'Dawn above the hills'], ['water', 'Ripples across still water'], ['lamp', 'An earthen oil lamp'], ['vine', 'A vine with leaves and fruit']] as const) {
      const html = mark(motif)
      expect(html).toContain(title)
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('viewBox="0 0 144 144"')
      expect(html).toContain('<path')
      expect(html).not.toContain('is-live')
    }
    expect(mark('life')).toContain('brand-mark')
  })

  it('covers every motif the pool can assign', () => {
    expect(MOTIFS).toEqual(['light', 'water', 'lamp', 'vine', 'life'])
    for (const motif of MOTIFS) {
      expect(mark(motif)).toContain(`data-motif="${motif}"`)
    }
  })
})
