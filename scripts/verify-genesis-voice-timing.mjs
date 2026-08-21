#!/usr/bin/env node
/** Browser proof that every scene remains active until its narration ends. */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { SCENES } from '../src/genesis/scenes.ts'

const root = new URL('..', import.meta.url).pathname
const PORT = Number(process.env.HELIVES_PREVIEW_PORT ?? 4177)
const givenUrl = process.env.HELIVES_PREVIEW_URL
const wanted = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('-')))

function waitForPreview(child) {
  return new Promise((resolve, reject) => {
    let output = ''
    const read = (chunk) => {
      output += String(chunk)
      if (output.includes('Local:') || output.includes(String(PORT))) resolve()
    }
    child.stdout?.on('data', read)
    child.stderr?.on('data', read)
    setTimeout(() => reject(new Error('preview did not start')), 20_000)
  })
}

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
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader'],
})

const results = []
try {
  for (const scene of SCENES.filter((candidate) => wanted.size === 0 || wanted.has(candidate.id))) {
    process.stdout.write(`checking ${scene.id}... `)
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.addInitScript(() => {
      window.__voiceTiming = { plays: [], ended: [], pauses: [] }
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function (...args) {
        const src = this.currentSrc || this.src
        window.__voiceTiming.plays.push({ src, rate: this.playbackRate, at: performance.now() })
        this.addEventListener('ended', () => {
          window.__voiceTiming.ended.push({ src, at: performance.now() })
        }, { once: true })
        this.addEventListener('pause', () => {
          window.__voiceTiming.pauses.push({
            src,
            at: performance.now(),
            currentTime: this.currentTime,
            duration: this.duration,
            progress: document.querySelector('input[type="range"]')?.value,
            scene: document.querySelector('.narration h1')?.textContent,
          })
        }, { once: true })
        return originalPlay.apply(this, args)
      }
    })
    const progress = scene.start + Math.min(0.00001, (scene.end - scene.start) * 0.01)
    await page.goto(`${base}/genesis?pause=1&quality=medium&progress=${progress}`, { waitUntil: 'networkidle' })
    await page.getByLabel('Speed').selectOption('4')
    await page.getByRole('button', { name: 'Play' }).click()
    const file = `/audio/${scene.audio}`
    try {
      await page.waitForFunction(
        (suffix) => window.__voiceTiming?.ended.some((entry) => entry.src.includes(suffix)),
        file,
        { timeout: Math.max(12_000, (scene.end - scene.start) * 90_000) },
      )
    } catch (error) {
      const state = await page.evaluate(() => ({
        title: document.querySelector('.narration h1')?.textContent,
        timing: window.__voiceTiming,
      }))
      throw new Error(`${scene.id}: narration did not finish inside its verification window: ${JSON.stringify(state)}`, { cause: error })
    }
    const proof = await page.evaluate(({ suffix, expected }) => ({
      title: document.querySelector('.narration h1')?.textContent,
      play: window.__voiceTiming?.plays.find((entry) => entry.src.includes(suffix)),
      ended: window.__voiceTiming?.ended.find((entry) => entry.src.includes(suffix)),
      expected,
    }), { suffix: file, expected: scene.name })
    if (proof.title !== scene.name) throw new Error(`${scene.id}: scene changed before voice ended`)
    if (proof.play?.rate !== 4) throw new Error(`${scene.id}: voice playback rate was ${proof.play?.rate}, expected 4`)
    if (!proof.ended) throw new Error(`${scene.id}: no ended event for ${scene.audio}`)
    if (errors.length) throw new Error(`${scene.id}: ${errors.join('; ')}`)
    results.push(`${scene.id}: voice ended before scene transition at 4x`)
    process.stdout.write('passed\n')
    await page.close()
  }
} finally {
  await browser.close()
  preview?.kill('SIGTERM')
}

console.log(results.join('\n'))
