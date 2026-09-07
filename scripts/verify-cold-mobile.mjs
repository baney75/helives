#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { chromium } from 'playwright'

const base = process.env.HELIVES_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const out = process.env.HELIVES_COLD_DIR ?? 'demo/cold-mobile'
await mkdir(out, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--disable-audio-output'],
})

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 90_000,
    connectionType: 'cellular3g',
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  const started = performance.now()
  await page.goto(`${base}/genesis?scene=fall&quality=low`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'The Fall', exact: true }).waitFor({ state: 'visible' })
  const textMs = performance.now() - started
  const loading = page.getByText('Loading scene…', { exact: true })
  await loading.waitFor({ state: 'visible' })
  await loading.waitFor({ state: 'hidden', timeout: 20_000 })
  await page.locator('canvas').waitFor({ state: 'visible' })
  const fullSceneMs = performance.now() - started
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => ({
    name: entry.name,
    duration: entry.duration,
    transferSize: entry.transferSize,
  })))

  const result = {
    profile: { viewport: '390x844', downloadBytesPerSecond: 200_000, uploadBytesPerSecond: 90_000, latencyMs: 150, cpuSlowdown: 4 },
    textMs: Math.round(textMs),
    fullSceneMs: Math.round(fullSceneMs),
    resources,
  }
  await page.screenshot({ path: `${out}/fall-ready.png` })
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  assert(textMs <= 4_000, `readable Fall text took ${Math.round(textMs)}ms (budget 4000ms)`)
  assert(fullSceneMs <= 10_000, `full Fall scene took ${Math.round(fullSceneMs)}ms (budget 10000ms)`)
} finally {
  await browser.close()
}
