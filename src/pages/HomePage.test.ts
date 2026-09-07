import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage.tsx'

const css = readFileSync(resolve('src/index.css'), 'utf8')

describe('HomePage lamp', () => {
  it('keeps the hourly Word and the site footer on one lamp', () => {
    const html = renderToStaticMarkup(createElement(HomePage, { now: new Date('2026-08-15T13:18:48.000Z') }))
    expect(html).toContain('lamp-home')
    expect(html).toContain('A moment in the Word')
    expect(html).toContain('Explore more')
    expect(html).toContain('He Lives')
    expect(html).toContain('King James Version, public domain')
    // The user's editorial revision removes software disclaimers from public copy.
    expect(html).not.toContain('God endorsed')
  })

  it('locks the home to one 100svh viewport instead of a scrollable document', () => {
    const lampBlocks = [...css.matchAll(/\.site\.lamp-home \{([^}]+)\}/g)].map((match) => match[1] ?? '')
    expect(lampBlocks.length).toBeGreaterThan(0)
    const heightBlocks = lampBlocks.filter((block) => /height:/.test(block))
    expect(heightBlocks.length).toBeGreaterThan(0)
    for (const block of lampBlocks) {
      expect(block).not.toMatch(/overflow:\s*visible/)
      expect(block).not.toMatch(/overflow:\s*auto/)
      expect(block).not.toMatch(/100dvh/)
    }
    for (const block of heightBlocks) {
      expect(block).toMatch(/100vh/)
      expect(block).toMatch(/100svh/)
    }
    const hero =
      css.match(/\.site\.lamp-home \.hero,\s*\.site\.lamp-home \.word-hero \{([^}]+)\}/)?.[1] ??
      css.match(/\.site\.lamp-home \.hero \{([^}]+)\}/)?.[1] ??
      ''
    expect(hero).toMatch(/overflow:\s*hidden/)
    expect(hero).not.toMatch(/overflow:\s*auto/)
    // Actual home overflow is measured in HomePage.viewport.test.ts; other pages may scroll.
    expect(css).toMatch(/html:has\(\.lamp-home\),/)
    expect(css).toMatch(/grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/)
  })
})
