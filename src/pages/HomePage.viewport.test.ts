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
    const verse = document.querySelector('.hero-verse')
    const sign = document.querySelector('.word-sign')
    const actions = document.querySelector('.hero-actions')
    const remain = document.querySelector('.word-remain')
    if (!(lamp instanceof HTMLElement) || !(foot instanceof HTMLElement)) {
      throw new Error('lamp or footer missing')
    }
    if (
      !(verse instanceof HTMLElement) ||
      !(sign instanceof HTMLElement) ||
      !(actions instanceof HTMLElement) ||
      !(remain instanceof HTMLElement) ||
      !(cite instanceof HTMLElement) ||
      !(brand instanceof HTMLElement)
    ) {
      throw new Error('lamp pieces missing')
    }
    const brandBox = brand.getBoundingClientRect()
    const verseBox = verse.getBoundingClientRect()
    const citeBox = cite.getBoundingClientRect()
    const signBox = sign.getBoundingClientRect()
    const actionsBox = actions.getBoundingClientRect()
    const remainBox = remain.getBoundingClientRect()
    const footBox = foot.getBoundingClientRect()
    return {
      inner: window.innerHeight,
      scroll: Math.max(root.scrollHeight, body.scrollHeight, lamp.scrollHeight),
      overflowY: getComputedStyle(body).overflowY,
      siteOverflow: getComputedStyle(lamp).overflow,
      brand: { top: brandBox.top, bottom: brandBox.bottom, height: brandBox.height },
      verse: { top: verseBox.top, bottom: verseBox.bottom, height: verseBox.height },
      cite: { top: citeBox.top, bottom: citeBox.bottom, height: citeBox.height },
      sign: { top: signBox.top, bottom: signBox.bottom, height: signBox.height },
      actions: { top: actionsBox.top, bottom: actionsBox.bottom, height: actionsBox.height },
      remain: { top: remainBox.top, bottom: remainBox.bottom, height: remainBox.height },
      foot: { top: footBox.top, bottom: footBox.bottom, height: footBox.height },
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
    { width: 1280, height: 800, now: longestVerseAt() },
  ])('fits one viewport at $width×$height', { timeout: 20_000 }, async ({ width, height, now }) => {
    const page = await opened.newPage({ viewport: { width, height } })
    await page.emulateMedia({ reducedMotion: 'reduce' })
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
    expect(fit.brand.top).toBeGreaterThanOrEqual(0)
    expect(fit.verse.height).toBeGreaterThan(20)
    expect(fit.cite.bottom).toBeGreaterThan(fit.verse.top)
    expect(fit.sign.height).toBeGreaterThan(20)
    expect(fit.actions.height).toBeGreaterThan(20)
    expect(fit.remain.height).toBeGreaterThan(16)
    for (const piece of [fit.brand, fit.verse, fit.cite, fit.sign, fit.actions, fit.remain, fit.foot]) {
      expect(piece.top).toBeGreaterThanOrEqual(-1)
      expect(piece.bottom).toBeLessThanOrEqual(fit.inner + 1)
    }
    expect(fit.remain.bottom).toBeLessThanOrEqual(fit.foot.top + 1)
    expect(fit.actions.bottom).toBeLessThanOrEqual(fit.remain.top + 1)
    expect(fit.footerText).toContain('He Lives · NeoRome')
    expect(fit.footerText).toContain('King James Version, public domain')
  })
})
