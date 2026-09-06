import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { INTERACTIVE_SECONDS, sceneBounds } from '../src/genesis/sceneTiming.ts'
import { AUDIO_CUES } from '../src/genesis/audioCues.ts'
const base = process.env.HELIVES_PREVIEW_URL || 'http://127.0.0.1:8787'
const out = process.env.HELIVES_CAPTURE_DIR || 'demo/sync'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const errors = [], checks = []
try {
 const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' })
 p.on('pageerror', e => errors.push(e.message))
 p.on('console', e => { if (e.type() === 'error') errors.push(e.text()) })
 await p.addInitScript(() => {
   const NativeAudio = window.Audio
   window.__clips = []
   window.__seeks = []
   const time = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')
   Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', { configurable: true, get: time.get, set(value) { window.__seeks.push(value); time.set.call(this, value) } })
   window.Audio = function (src) { const audio = new NativeAudio(src); window.__clips.push(audio); return audio }
   window.Audio.prototype = NativeAudio.prototype
 })
 const fall = sceneBounds('fall')
 await p.goto(`${base}/genesis?pause=1&quality=low&progress=${fall.start + 4 / INTERACTIVE_SECONDS}`, { waitUntil: 'networkidle' })
 await p.locator('.scene-loading').waitFor({ state: 'detached' })
 const snapshot = () => p.evaluate(() => ({ time: window.__clips.at(-1).currentTime, paused: window.__clips.at(-1).paused, rate: window.__clips.at(-1).playbackRate, ready: window.__clips.at(-1).readyState, duration: window.__clips.at(-1).duration, src: window.__clips.at(-1).src, error: window.__clips.at(-1).error?.message, seeks: window.__seeks, progress: Number(document.querySelector('#genesis-time').value) }))
 const seek = (seconds) => p.locator('#genesis-time').evaluate((element, progress) => {
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(progress))
   element.dispatchEvent(new Event('input', { bubbles: true }))
   element.dispatchEvent(new Event('change', { bubbles: true }))
 }, fall.start + seconds / INTERACTIVE_SECONDS)
 await p.waitForTimeout(1500)
 let s = await snapshot()
 assert(s.paused && Math.abs(s.time - 4) < 0.1, 'paused deep link seeks narration: ' + JSON.stringify(s))
 await p.getByRole('button', { name: 'Play', exact: true }).click()
 await p.waitForTimeout(900)
 s = await snapshot()
 assert(s.time > 4.5 && Math.abs((s.progress - fall.start) * INTERACTIVE_SECONDS - s.time) < 0.18, 'media clock leads visuals')
 await p.locator('.speed select').selectOption('2')
 await p.waitForTimeout(500)
 s = await snapshot()
 assert(s.rate === 2 && Math.abs((s.progress - fall.start) * INTERACTIVE_SECONDS - s.time) < 0.18, 'speed remains synchronized')
 await p.getByRole('button', { name: 'Pause', exact: true }).click()
 const paused = await snapshot()
 await p.waitForTimeout(300)
 s = await snapshot()
 assert(Math.abs(s.time - paused.time) < 0.04 && s.progress === paused.progress, 'pause holds audio and timeline')
 await seek(42)
 await p.waitForTimeout(300)
 s = await snapshot()
 assert(s.paused && Math.abs(s.time - 42) < 0.1, 'same-scene scrub seeks audio without restarting')
 await p.getByRole('button', { name: 'Play', exact: true }).click()
 await p.waitForTimeout(200)
 await p.evaluate(() => window.__clips.at(-1).pause())
 await p.waitForTimeout(100)
 const stalled = await snapshot()
 await p.waitForTimeout(250)
 s = await snapshot()
 assert(s.progress === stalled.progress, 'stalled audio cannot run ahead visually')
 await p.evaluate(() => window.__clips.at(-1).play())
 await p.getByRole('button', { name: 'Sound on', exact: true }).click()
 await p.waitForTimeout(350)
 const muted = await snapshot()
 await p.getByRole('button', { name: 'Sound off', exact: true }).click()
 await p.waitForTimeout(150)
 s = await snapshot()
 assert(!s.paused && s.time >= muted.time && Math.abs((s.progress - fall.start) * INTERACTIVE_SECONDS - s.time) < 0.18, 'unmute rejoins current visual position')
 await p.getByRole('button', { name: 'Pause', exact: true }).click()
 const take = AUDIO_CUES.fall.find(c => c.action === 'take')
 await seek(take.start + 1)
 await p.waitForTimeout(800)
 assert((await p.locator('.headline').textContent()).includes('she took'), 'caption is the actual spoken phrase')
 await p.screenshot({ path: `${out}/take-1280.png` })
 checks.push('Paused deep links; media clock; 2x speed; pause; same-scene seek; buffering; unmute; phrase captions all pass')
 await p.close()
 for (const width of [1280, 375]) {
   const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
   page.on('pageerror', e => errors.push(e.message))
   page.on('console', e => { if (e.type() === 'error') errors.push(e.text()) })
   for (const [name, seconds] of [['take', take.start + 1], ['depart', AUDIO_CUES.fall.find(c => c.action === 'depart').start + 4]]) {
     await page.goto(`${base}/genesis?pause=1&quality=${width === 375 ? 'low' : 'high'}&progress=${fall.start + seconds / INTERACTIVE_SECONDS}`, { waitUntil: 'networkidle' })
     await page.locator('.scene-loading').waitFor({ state: 'detached' })
     await page.waitForTimeout(800)
     assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
     await page.screenshot({ path: `${out}/${name}-${width}.png` })
   }
   await page.close()
 }
 assert.deepEqual(errors, [])
 await writeFile(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2))
 console.log(checks.join('\n') + '\nFour final desktop/mobile cue captures; zero console/page errors.')
} finally { await browser.close() }
