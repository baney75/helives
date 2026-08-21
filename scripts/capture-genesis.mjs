#!/usr/bin/env node
/**
 * Screenshot paused Genesis beats for still-vs-shot compare.
 * Usage: node scripts/capture-genesis.mjs --out <dir>
 * Serves `dist/` via `pnpm preview` unless HELIVES_PREVIEW_URL is set.
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { sceneBounds } from '../src/genesis/sceneTiming.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outFlag = process.argv.indexOf('--out')
const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : path.join(root, 'demo', 'captures')
const beatsFlag = process.argv.indexOf('--beats')
const wantedBeats = beatsFlag >= 0 ? new Set((process.argv[beatsFlag + 1] ?? '').split(',').filter(Boolean)) : null
const PORT = Number(process.env.HELIVES_PREVIEW_PORT ?? 4177)
const givenUrl = process.env.HELIVES_PREVIEW_URL

function genesisBeat(name, local = 0.5, sceneId = name, playing = false) {
  const bounds = sceneBounds(sceneId)
  const progress = bounds.start + (bounds.end - bounds.start) * local
  return { name, path: `/genesis?pause=${playing ? '0' : '1'}&progress=${progress.toFixed(6)}&quality=high`, title: 'Genesis — He Lives' }
}

const BEATS = [
  genesisBeat('beginning', 0.35),
  genesisBeat('day1', 0.5),
  genesisBeat('day1-live', 0.5, 'day1', true),
  genesisBeat('day2', 0.5),
  genesisBeat('day3', 0.5),
  genesisBeat('day4', 0.5),
  genesisBeat('day5', 0.52),
  genesisBeat('day6', 0.55),
  genesisBeat('day7', 0.5),
  genesisBeat('garden', 0.5),
  genesisBeat('fall', 0.5),
  genesisBeat('fall-early', 0.16, 'fall'),
  genesisBeat('fall-handoff', 0.61, 'fall'),
  genesisBeat('fall-expulsion', 0.86, 'fall'),
  genesisBeat('closing', 0.5),
  genesisBeat('doubt', 0.5),
  genesisBeat('measure', 0.55),
  { name: 'home', path: '/', title: 'He Lives' },
  { name: 'scriptures', path: '/scriptures', title: 'The Scriptures — He Lives' },
  { name: 'faith', path: '/faith', title: 'Faith — He Lives' },
  { name: 'afterword', path: '/genesis/afterword', title: 'Got doubt? — He Lives' },
]

function waitForPreview(child) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk) => {
      buf += String(chunk)
      if (buf.includes('Local:') || buf.includes(String(PORT))) {
        child.stdout?.off('data', onData)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    setTimeout(() => reject(new Error('preview did not start')), 20_000)
  })
}

await mkdir(outDir, { recursive: true })

let preview
let base = givenUrl
if (!base) {
  preview = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(preview)
  base = `http://127.0.0.1:${PORT}`
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
})
const errors = []
try {
  for (const beat of wantedBeats ? BEATS.filter((candidate) => wantedBeats.has(candidate.name)) : BEATS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.addInitScript(() => {
      window.__helivesAudioProbe = []
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function (...args) {
        const entry = { src: this.currentSrc || this.src, state: 'called' }
        window.__helivesAudioProbe.push(entry)
        const result = originalPlay.apply(this, args)
        void result.then(
          () => { entry.state = 'resolved' },
          (error) => { entry.state = `rejected: ${String(error)}` },
        )
        return result
      }
    })
    page.on('pageerror', (err) => errors.push(`${beat.name}: ${err.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${beat.name}: console: ${message.text()}`)
    })
    page.on('requestfailed', (request) => {
      errors.push(`${beat.name}: request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`)
    })
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${beat.name}: HTTP ${response.status()}: ${response.url()}`)
    })
    const url = `${base}${beat.path}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    const title = await page.title()
    if (title !== beat.title) {
      throw new Error(`wrong app at ${url}: title=${title}`)
    }
    await page.waitForTimeout(2800)
    if (beat.name === 'home') {
      const fit = await page.evaluate(() => ({ height: window.innerHeight, scroll: document.documentElement.scrollHeight }))
      if (fit.scroll > fit.height + 1) errors.push(`home desktop overflow: ${fit.scroll}px > ${fit.height}px`)
    }
    if (beat.name === 'fall') {
      await page.getByRole('button', { name: 'Play' }).click()
      await page.waitForFunction(() =>
        window.__helivesAudioProbe?.some((entry) => entry.src.includes('/audio/fall.mp3') && entry.state === 'resolved'),
      )
      await page.getByRole('button', { name: 'Pause' }).click()
    }
    const shot1280 = path.join(outDir, `${beat.name}-1280.png`)
    await page.screenshot({ path: shot1280 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: shot1280 })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(100)
    if (beat.name === 'home') {
      const fit = await page.evaluate(() => ({ height: window.innerHeight, scroll: document.documentElement.scrollHeight }))
      if (fit.scroll > fit.height + 1) errors.push(`home mobile overflow: ${fit.scroll}px > ${fit.height}px`)
    }
    await page.screenshot({ path: path.join(outDir, `${beat.name}-375.png`) })
    await page.close()
  }
} finally {
  await browser.close()
  preview?.kill('SIGTERM')
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(outDir)
