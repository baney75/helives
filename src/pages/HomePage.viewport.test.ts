import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POOL } from '../word/pool.ts'
import { passageAt } from '../word/clock.ts'
import { HomePage } from './HomePage.tsx'

const fontsRoot = pathToFileURL(resolve('public')).href
const css = readFileSync(resolve('src/index.css'), 'utf8').replaceAll("url('/", `url('${fontsRoot}/`)

function longestVerseAt(): Date {
  const start = Date.parse('2026-01-01T00:00:00.000Z')
  let best = new Date(start)
  let bestLength = 0
  for (let hour = 0; hour < POOL.length; hour += 1) {
    const at = new Date(start + hour * 3_600_000)
    const length = passageAt(at).text.length
    if (length > bestLength) {
      best = at
      bestLength = length
    }
  }
  return best
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    const lamp = document.querySelector('.lamp-home')
    const foot = document.querySelector('.foot')
    const cite = document.querySelector('.hero-cite')
    const brand = document.querySelector('.nav-mark')
    if (!(lamp instanceof HTMLElement) || !(foot instanceof HTMLElement)) {
      throw new Error('lamp or footer missing')
    }
    const footBox = foot.getBoundingClientRect()
    const citeBox = cite?.getBoundingClientRect()
    const brandBox = brand?.getBoundingClientRect()
    return {
      inner: window.innerHeight,
      scroll: Math.max(root.scrollHeight, body.scrollHeight, lamp.scrollHeight),
      overflowY: getComputedStyle(body).overflowY,
      siteOverflow: getComputedStyle(lamp).overflow,
      footTop: footBox.top,
      footBottom: footBox.bottom,
      citeBottom: citeBox?.bottom ?? 0,
      brandTop: brandBox?.top ?? 0,
      footerText: foot.textContent ?? '',
    }
  })
}

describe('home viewport', () => {
  const browser = chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  })
  let opened: Awaited<typeof browser>

  beforeAll(async () => {
    opened = await browser
  })

  afterAll(async () => {
    await opened.close()
  })

  it.each([
    { width: 1280, height: 800, now: new Date('2026-08-15T13:18:48.000Z') },
    { width: 375, height: 812, now: new Date('2026-08-15T13:18:48.000Z') },
    { width: 375, height: 812, now: longestVerseAt() },
  ])('fits one viewport at $width×$height', async ({ width, height, now }) => {
    const page = await opened.newPage({ viewport: { width, height } })
    const markup = renderToStaticMarkup(createElement(HomePage, { now }))
    await page.setContent(
      `<!doctype html><html lang="en"><head><style>${css}</style></head><body><div id="root">${markup}</div></body></html>`,
      { waitUntil: 'load' },
    )
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    const fit = await measure(page)
    await page.close()

    expect(fit.overflowY).toBe('hidden')
    expect(fit.siteOverflow).toBe('hidden')
    expect(fit.scroll).toBeLessThanOrEqual(fit.inner + 1)
    expect(fit.brandTop).toBeGreaterThanOrEqual(0)
    expect(fit.citeBottom).toBeGreaterThan(0)
    expect(fit.citeBottom).toBeLessThanOrEqual(fit.inner)
    expect(fit.footTop).toBeGreaterThan(0)
    expect(fit.footBottom).toBeLessThanOrEqual(fit.inner + 1)
    expect(fit.footerText).toContain('He Lives · NeoRome')
    expect(fit.footerText).toContain('King James Version, public domain')
  })
})
