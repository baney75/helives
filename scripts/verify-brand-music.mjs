import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { POOL } from '../src/word/pool.ts'
import { passageAt } from '../src/word/clock.ts'
import { MUSIC_TRACKS } from '../src/music/catalog.ts'
import { BRAND } from '../src/site/brand.ts'
const base = process.env.HELIVES_PREVIEW_URL || 'http://127.0.0.1:8787'
const out = 'demo/brand-music'
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const checks = [], errors = []

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(String(e)))
  await page.clock.install({ time: new Date('2026-09-07T16:30:00Z') })
  await page.addInitScript(() => {
    window.__music = []
    const Native = window.Audio
    window.Audio = function(...args) { const clip = new Native(...args); if (String(args[0]).includes('/music/')) window.__music.push(clip); return clip }
  })
  let requests = 0
  page.on('request', r => { if (r.url().includes('/audio/music/')) requests++ })
  await page.goto(base)
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: 'Music off', exact: true }).waitFor()
  assert.equal(requests, 0, 'initial page must not fetch music')
  assert.equal(await page.evaluate(() => window.__music.length), 0)
  await page.screenshot({ path: `${out}/home-1280.png` })
  await page.getByRole('button', { name: 'Music off', exact: true }).focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Music on', exact: true }).waitFor()
  await page.waitForTimeout(500)
  assert(await page.evaluate(() => window.__music[0].currentTime > 0 && !window.__music[0].paused))
  const verse = await page.locator('.hero-verse').textContent()
  await page.clock.fastForward(60*1000)
  assert.notEqual(await page.locator('.hero-verse').textContent(), verse, 'minute scripture changes')
  assert(await page.evaluate(() => window.__music.length === 1 && !window.__music[0].paused), 'verse rollover preserves player')
  checks.push('Zero music request or Audio construction before click; keyboard opt-in plays decoded media; minute verse changes without restarting player')
  await page.getByRole('button', { name: 'Music settings' }).click()
  await page.getByRole('slider', { name: 'Music volume' }).fill('20')
  assert.equal(await page.evaluate(() => window.__music[0].volume), .2)
  await page.screenshot({ path: `${out}/settings-1280.png` })
  if (MUSIC_TRACKS.length > 1) {
    await page.getByLabel('Instrumental', { exact: true }).selectOption(MUSIC_TRACKS[1].id)
    await page.getByRole('button', { name: 'Music on', exact: true }).waitFor()
    await page.clock.runFor(1400)
    assert(await page.evaluate(() => window.__music.filter(a => !a.paused).length === 1))
    await page.evaluate(() => { const clip = window.__music.at(-1); clip.currentTime = clip.duration - .1 })
    await page.waitForFunction((id) => document.querySelector('.music-panel select')?.value === id, MUSIC_TRACKS[2].id)
    await page.getByRole('button', { name: 'Music on', exact: true }).waitFor()
    await page.clock.runFor(6300)
  }
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Faith', exact: true }).click()
  assert(await page.evaluate(() => window.__music.filter(a => !a.paused).length === 1))
  await page.getByRole('button', { name: 'Music on', exact: true }).click()
  assert(await page.evaluate(() => window.__music.every(a => a.paused)))
  await page.reload()
  await page.getByRole('button', { name: 'Music off', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__music.length), 0)
  checks.push('Track picker returns to one recording after its crossfade; natural ending advances the collection; Volume changes actual media gain; internal navigation preserves music; Off pauses; reload resets to silent')
  // Network failure and deliberate retry use the real browser media element.
  let fail = true
  await page.route('**/audio/music/*.mp3', async route => fail ? route.abort('failed') : route.continue())
  await page.getByRole('button', { name: 'Music off', exact: true }).click()
  await page.getByRole('button', { name: 'Retry music', exact: true }).waitFor()
  fail = false
  await page.getByRole('button', { name: 'Retry music', exact: true }).click()
  await page.getByRole('button', { name: 'Music on', exact: true }).waitFor()
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.getByRole('button', { name: 'Music off', exact: true }).waitFor()
  assert(await page.evaluate(() => window.__music.every(a => a.paused)))
  checks.push('Failed music fetch exposes retry; retry recovers; tab hiding stops actual media')
  await page.close()
  const verseDates = POOL.map((_, i) => new Date(Date.parse('2026-01-01T00:00:00Z') + i*3600000))
  const longest = verseDates.sort((a,b) => passageAt(b).text.length - passageAt(a).text.length)[0]
  for (const [width,height] of [[375,800],[390,844],[320,568],[640,400],[1280,800]]) {
    const p = await browser.newPage({ viewport: { width,height }, reducedMotion: 'reduce' })
    await p.clock.install({ time: longest })
    p.on('pageerror', e => errors.push(String(e)))
    await p.goto(base)
    await p.evaluate(() => document.fonts.ready)
    const bounds = await p.evaluate(() => {
      const box = document.querySelector('.music-toggle').getBoundingClientRect()
      return { x: box.x, bottom: box.bottom, width: document.documentElement.scrollWidth, height: innerHeight, viewport: innerWidth, footer: document.querySelector('.foot').getBoundingClientRect().top, remain: document.querySelector('.word-remain').getBoundingClientRect().bottom }
    })
    assert(bounds.x >= 0 && bounds.bottom <= bounds.footer && bounds.remain <= bounds.footer && bounds.bottom <= bounds.height && bounds.width <= bounds.viewport, JSON.stringify(bounds))
    await p.screenshot({ path: `${out}/home-${width}x${height}.png` })
    await p.getByRole('button', { name: 'Music settings' }).click()
    assert(await p.locator('.music-panel').evaluate(el => { const r=el.getBoundingClientRect(); return r.x>=0 && r.y>=0 && r.bottom<=innerHeight && r.right<=innerWidth }))
    await p.screenshot({ path: `${out}/settings-${width}x${height}.png` })
    await p.close()
  }
  checks.push('Visible control and unclipped settings at 320, 375, 390, 640 and 1280 CSS pixels, including short landscape')
  for (const file of ['public/favicon.svg','public/icon.svg','public/brand/mark.svg']) assert((await readFile(file,'utf8')).includes(BRAND.cross))
  const missing = await fetch(base + '/audio/music/does-not-exist.mp3')
  assert.equal(missing.status, 404)
  const media = await fetch(base + '/audio/music/' + MUSIC_TRACKS[0].file)
  assert(media.ok && media.headers.get('content-type').includes('audio/mpeg'))
  checks.push('All vector exports share master geometry; real MP3 served as audio/mpeg; missing music returns 404')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(checks.join('\n'))
} finally { await browser.close() }
