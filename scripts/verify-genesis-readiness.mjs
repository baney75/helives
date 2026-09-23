#!/usr/bin/env node
// Run against the built Worker. Confirms the shipped 2D scene is ready without WebGL.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { SCENES } from '../src/genesis/scenes.ts'

const base = process.env.HELIVES_PREVIEW_URL ?? 'http://127.0.0.1:8787'
const out = process.env.HELIVES_READINESS_DIR ?? 'demo/readiness'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const waveTransform = (locator) => locator.evaluate((el) => {
  const value = getComputedStyle(el).transform
  const matrix = value === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(value)
  return { isIdentity: matrix.isIdentity, normalized: matrix.toString() }
})
try {
  const page = await browser.newPage({ viewport: { width: 653, height: 508 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const errors = []
  const glbRequests = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('request', (request) => {
    if (/\.glb(?:[?#]|$)/i.test(request.url())) glbRequests.push(request.url())
  })
  await page.route('**/*.glb', (route) => route.abort('failed'))
  await page.addInitScript(() => {
    window.__readinessClips = []
    window.__webglAttempts = 0
    const NativeAudio = window.Audio
    window.Audio = function (...args) {
      const clip = new NativeAudio(...args)
      window.__readinessClips.push(clip)
      return clip
    }
    window.Audio.prototype = NativeAudio.prototype
    const nativeGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/^(?:webgl2?|experimental-webgl)$/i.test(String(type))) {
        window.__webglAttempts += 1
        return null
      }
      return nativeGetContext.call(this, type, ...args)
    }
  })

  const response = await page.goto(`${base}/genesis?scene=beginning&pause=1&quality=low`, { waitUntil: 'domcontentloaded' })
  assert(response?.ok(), `Genesis HTTP response: ${response?.status() ?? 'missing'}`)
  if (process.env.HELIVES_REQUIRE_WORKER !== '0') {
    assert(response.headers()['content-security-policy'], 'Expected built Worker CSP; set HELIVES_REQUIRE_WORKER=0 only for a dev preview')
  }
  await page.locator('.genesis-illustration--beginning svg.gi-art').waitFor({ state: 'visible' })
  await page.locator('.scene-loading').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('canvas').count(), 0, 'legacy Canvas loaded')
  assert.equal(await page.evaluate(() => window.__webglAttempts), 0, 'WebGL was attempted')
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'compact layout overflows horizontally')
  for (const selector of ['.read-scene', '.chapter-controls', '.transport', '#genesis-time']) {
    const box = await page.locator(selector).boundingBox()
    assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= 654 && box.y + box.height <= 509,
      `${selector} clips outside 653×508 viewport`)
  }
  await page.waitForFunction(() => window.__readinessClips.length > 0)
  assert(await page.evaluate(() => window.__readinessClips.every((clip) => clip.paused)), 'paused entry started narration')
  const waves = page.locator('.gi-waves').first()
  const stillWaves = await waveTransform(waves)
  assert(stillWaves.isIdentity, 'reduced motion did not stop waves')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForFunction(() => window.__readinessClips.some((clip) => !clip.paused && clip.currentTime > 0.15))
  const playingWaves = await waveTransform(waves)
  assert(playingWaves.isIdentity, 'reduced motion animated waves during playback')
  assert.equal(playingWaves.normalized, stillWaves.normalized, 'reduced-motion wave transform changed during playback')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.screenshot({ path: `${out}/genesis-compact-ready.png` })

  const picker = page.locator('.scene-picker select')
  assert.equal(await picker.locator('option').count(), 13)
  for (const scene of SCENES) {
    await picker.selectOption(scene.id)
    await page.locator(`.genesis-illustration--${scene.id} svg.gi-art`).waitFor({ state: 'visible' })
    await page.locator('.scene-loading').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.narration h1').textContent(), scene.name)
  }
  assert.equal(await page.locator('canvas').count(), 0)
  assert.equal(await page.evaluate(() => window.__webglAttempts), 0)
  assert.deepEqual(glbRequests, [])

  await picker.selectOption('garden')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForFunction(() => window.__readinessClips.some((clip) => !clip.paused && clip.currentTime > 0.1), null, { timeout: 10_000 })
  const range = page.getByLabel('Genesis time')
  const beforeSeek = Number(await range.inputValue())
  await range.focus()
  await range.press('ArrowRight')
  assert(Number(await range.inputValue()) > beforeSeek, 'timeline did not seek')
  const opener = page.getByRole('button', { name: 'Read this scene' })
  await opener.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  assert(await page.evaluate(() => window.__readinessClips.every((clip) => clip.paused)), 'scene dialog did not pause voice')
  assert(await dialog.getByRole('button', { name: 'Close scene text' }).evaluate((el) => document.activeElement === el), 'focus did not enter dialog')
  await page.screenshot({ path: `${out}/genesis-scene-dialog.png` })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert(await opener.evaluate((el) => document.activeElement === el), 'Escape did not restore opener focus')
  await picker.selectOption('fall')
  assert(await page.evaluate(() => window.__readinessClips.every((clip) => clip.paused)), 'paused scene change restarted voice')
  await page.screenshot({ path: `${out}/genesis-fall-compact.png` })

  assert.deepEqual(errors, [])
  assert.deepEqual(glbRequests, [])
  const result = {
    base, viewport: '653×508 DPR 2', scenes: SCENES.length,
    svgReady: true, blockedWebglWorks: true, webglAttempts: 0, glbRequests,
    pausedEntrySilent: true, narrationPlayed: true, seekWorked: true,
    reducedMotion: true, sceneDialogPausedAndRestoredFocus: true, errors,
  }
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}
