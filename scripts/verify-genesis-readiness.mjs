#!/usr/bin/env node
// Run against the built Worker: development StrictMode masks the reveal regression.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.HELIVES_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const out = process.env.HELIVES_READINESS_DIR ?? 'demo/readiness'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--disable-audio-output'],
})
try {
  const page = await browser.newPage({ viewport: { width: 653, height: 508 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.addInitScript(() => {
    window.__readinessClips = []
    const NativeAudio = window.Audio
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args)
      window.__readinessClips.push(audio)
      return audio
    }
    window.Audio.prototype = NativeAudio.prototype
  })
  let releaseModels
  const released = new Promise((resolve) => { releaseModels = resolve })
  const held = new Set()
  await page.route('**/models/genesis/{man,woman}.glb', async (route) => {
    held.add(new URL(route.request().url()).pathname)
    await released
    await route.continue()
  })
  await page.goto(`${base}/genesis?scene=beginning&pause=1&quality=low`, { waitUntil: 'networkidle' })
  await page.locator('canvas').waitFor()
  await page.locator('.scene-loading').waitFor({ state: 'hidden', timeout: 20_000 })
  await page.getByLabel('Scene', { exact: false }).selectOption('garden')
  await page.locator('.scene-loading').waitFor({ state: 'visible' })
  await page.waitForTimeout(400)
  assert.equal(held.size, 2, 'both figures must suspend the previously ready scene')
  const status = await page.locator('.scene-loading').boundingBox()
  const picker = await page.locator('.scene-picker').boundingBox()
  assert(status.y + status.height < picker.y, 'loading status must stay clear of the scene picker')
  await page.screenshot({ path: `${out}/garden-loading.png` })
  releaseModels()
  await page.locator('.scene-loading').waitFor({ state: 'hidden', timeout: 20_000 })
  const range = page.getByLabel('Genesis time')
  const start = Number(await range.inputValue())
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForFunction(() => window.__readinessClips.some((clip) => !clip.paused && clip.currentTime > 0.2))
  await page.waitForTimeout(400)
  assert(Number(await range.inputValue()) > start, 'timeline must resume after the models become ready')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.screenshot({ path: `${out}/garden-ready.png` })
  assert.deepEqual(errors, [])
  const result = { heldModels: [...held], loadingCleared: true, narrationResumed: true, timelineResumed: true, errors }
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}
