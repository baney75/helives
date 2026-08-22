import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage.tsx'

const css = readFileSync(resolve('src/index.css'), 'utf8')

describe('HomePage lamp', () => {
  it('keeps the hourly Word and the NeoRome footer on one lamp', () => {
    const html = renderToStaticMarkup(createElement(HomePage, { now: new Date('2026-08-15T13:18:48.000Z') }))
    expect(html).toContain('lamp-home')
    expect(html).toContain('This hour')
    expect(html).toContain('Explore more')
    expect(html).toContain('He Lives · NeoRome')
    expect(html).toContain('King James Version, public domain')
    expect(html).toContain('not a church, not a sacrament')
  })

  it('locks the home to one 100dvh viewport instead of a scrollable document', () => {
    const lampBlocks = [...css.matchAll(/\.site\.lamp-home \{([^}]+)\}/g)].map((match) => match[1] ?? '')
    expect(lampBlocks.length).toBeGreaterThan(0)
    for (const block of lampBlocks) {
      expect(block).not.toMatch(/overflow:\s*visible/)
      expect(block).not.toMatch(/overflow:\s*auto/)
    }
    const hero = css.match(/\.site\.lamp-home \.hero \{([^}]+)\}/)?.[1] ?? ''
    expect(hero).toMatch(/overflow:\s*hidden/)
    expect(hero).not.toMatch(/overflow:\s*auto/)
    expect(css).not.toMatch(/overflow-y:\s*auto/)
    expect(css).toMatch(/html:has\(\.lamp-home\),/)
  })
})
