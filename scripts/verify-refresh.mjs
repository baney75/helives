#!/usr/bin/env node
// Browser acceptance for the active Genesis SVG renderer and public routes.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { AUDIO_CUES } from '../src/genesis/audioCues.ts'
import { SCENES } from '../src/genesis/scenes.ts'
import { INTERACTIVE_SECONDS, sceneBounds } from '../src/genesis/sceneTiming.ts'

const base = process.env.HELIVES_PREVIEW_URL ?? 'http://127.0.0.1:8787'
const out = process.env.HELIVES_REFRESH_DIR ?? 'demo/refresh'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const errors = []
const glbRequests = []
const checks = []
const observe = (page) => {
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('request', (request) => {
    if (/\.glb(?:[?#]|$)/i.test(request.url())) glbRequests.push(request.url())
  })
}
const genesis = async (page, scene = 'beginning') => {
  await page.goto(`${base}/genesis?scene=${scene}&pause=1&quality=low`)
  await page.locator(`.genesis-illustration--${scene} svg.gi-art`).waitFor({ state: 'visible' })
  await page.locator('.scene-loading').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('canvas').count(), 0, 'active Genesis rendered a canvas')
}
const noOverflow = async (page, label) => {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`)
}
const cueSamples = SCENES.flatMap((scene) => {
  const sceneMidpoint = { scene, label: 'scene midpoint', progress: (scene.start + scene.end) / 2 }
  const longCues = AUDIO_CUES[scene.id].flatMap((cue, index) => {
    if (cue.text.length < 200 && cue.end - cue.start < 15) return []
    return [{
      scene, label: `long cue ${index + 1}`,
      progress: scene.start + (cue.start + cue.end) / (2 * INTERACTIVE_SECONDS),
      text: cue.text,
    }]
  })
  return [sceneMidpoint, ...longCues]
})
const checkTextLayout = async (page, label, scene, width) => {
  const layout = await page.evaluate((mobile) => {
    const narration = document.querySelector('.narration')
    const dock = document.querySelector('.dock')
    const headline = narration?.querySelector('.headline')
    const citation = narration?.querySelector('.passage-citation')
    const readScene = narration?.querySelector('.read-scene')
    const context = narration?.querySelector('.full-context-link a, .afterword-link a')
    if (!narration || !dock || !headline || !citation || !readScene) return null
    if (mobile) narration.scrollTop = narration.scrollHeight
    const bounds = (element) => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, height: box.height }
    }
    return {
      narration: bounds(narration), dock: bounds(dock), headline: bounds(headline),
      citation: bounds(citation), readScene: bounds(readScene),
      context: context?.getClientRects().length ? bounds(context) : null,
      contextPresent: Boolean(context),
      headlineClientHeight: headline.clientHeight,
      headlineScrollHeight: headline.scrollHeight,
    }
  }, width <= 700)
  assert(layout, `${label}: missing narration or dock content`)
  assert(layout.narration.height > 0 && layout.narration.bottom <= layout.dock.top - 8,
    `${label}: narration overlaps dock (${JSON.stringify(layout)})`)
  assert(layout.headlineClientHeight > 0 && layout.headline.top >= layout.narration.top - 1 && layout.headline.bottom <= layout.narration.bottom + 1,
    `${label}: headline escapes its scroll container (${JSON.stringify(layout)})`)
  for (const [name, box] of [['citation', layout.citation], ['Read this scene', layout.readScene], ['full-context link', layout.context]]) {
    if (!box) continue
    assert(box.height > 0 && box.top >= layout.narration.top - 1 && box.bottom <= layout.narration.bottom + 1 && box.bottom <= layout.dock.top - 8,
      `${label}: ${name} is clipped or overlaps dock (${JSON.stringify(layout)})`)
  }
  if (scene.kind === 'scripture') assert(layout.contextPresent, `${label}: full-context link missing`)
  if (scene.kind === 'scripture' && width > 700) assert(layout.context, `${label}: full-context link is hidden`)
  if (scene.id === 'day4' && label.includes('long cue') && width === 1280) {
    assert(layout.headlineScrollHeight > layout.headlineClientHeight + 1,
      `${label}: long Day 4 cue should scroll inside its bounded headline`)
  }
}
const waveTransform = (locator) => locator.evaluate((el) => {
  const value = getComputedStyle(el).transform
  const matrix = value === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(value)
  return { isIdentity: matrix.isIdentity, normalized: matrix.toString() }
})

try {
  assert.equal(SCENES.length, 13, 'Genesis scene inventory changed; update this acceptance test')
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
    observe(page)
    for (const [name, route] of [
      ['home', '/'], ['scriptures', '/scriptures'], ['faith', '/faith'],
      ['afterword', '/genesis/afterword'], ['genesis', '/genesis?scene=garden&pause=1&quality=low'],
    ]) {
      await page.goto(base + route)
      await page.evaluate(() => document.fonts.ready)
      await page.locator('h1').first().waitFor()
      if (name === 'genesis') {
        await page.locator('.genesis-illustration--garden svg.gi-art').waitFor({ state: 'visible' })
        await page.locator('.scene-loading').waitFor({ state: 'hidden' })
        assert.equal(await page.locator('canvas').count(), 0)
      }
      await noOverflow(page, `${name} ${width}`)
      await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: !['genesis', 'scriptures'].includes(name) })
    }
    for (const sample of cueSamples) {
      const label = `${sample.scene.id} ${sample.label} ${width}`
      await page.goto(`${base}/genesis?scene=${sample.scene.id}&pause=1&quality=low&progress=${sample.progress}`)
      await page.locator(`.genesis-illustration--${sample.scene.id} svg.gi-art`).waitFor({ state: 'visible' })
      await page.locator('.scene-loading').waitFor({ state: 'hidden' })
      if (sample.text) {
        await page.waitForFunction((text) => document.querySelector('.narration .headline')?.textContent === text, sample.text)
      }
      await noOverflow(page, label)
      await checkTextLayout(page, label, sample.scene, width)
    }
    await page.close()
  }
  checks.push('Home, Scriptures, Faith, Afterword and SVG Genesis captured without horizontal overflow at 375 and 1280 CSS pixels')
  checks.push(`Narration, citation, Read this scene and visible context links clear the dock at 375 and 1280 across ${cueSamples.length} scene-midpoint/long-cue samples per viewport`)

  const compact = await browser.newPage({ viewport: { width: 653, height: 508 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  observe(compact)
  await genesis(compact, 'garden')
  await noOverflow(compact, 'Genesis 653×508 DPR 2')
  for (const selector of ['.read-scene', '.chapter-controls', '.transport', '#genesis-time']) {
    const box = await compact.locator(selector).boundingBox()
    assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= 654 && box.y + box.height <= 509,
      `${selector} clips outside 653×508 viewport`)
  }
  await compact.screenshot({ path: `${out}/genesis-653x508-dpr2.png` })
  await compact.close()
  checks.push('Compact 653×508 DPR 2 controls remain inside the viewport')

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  observe(page)
  await page.goto(base + '/scriptures')
  await page.getByRole('main').getByRole('link', { name: 'New Testament', exact: false }).click()
  assert.equal(new URL(page.url()).hash, '#new-testament')
  assert(await page.locator('#new-testament').evaluate((el) => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < 100))
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Faith', exact: true }).click()
  assert.equal(await page.evaluate(() => scrollY), 0)
  await page.goto(base + '/genesis/afterword')
  await page.getByRole('main').getByRole('link', { name: 'Read the evidence', exact: false }).click()
  assert.equal(new URL(page.url()).hash, '#measure')
  assert.equal(await page.getByRole('main').getByRole('link', { name: 'Read Genesis', exact: false }).getAttribute('href'), '/genesis?scene=beginning')
  await page.goto(base + '/a-route-that-does-not-exist')
  assert.equal(await page.locator('h1').textContent(), 'Not found')
  checks.push('Scoped navigation, section anchors, Genesis return link and unknown route work')

  await genesis(page, 'fall')
  const picker = page.locator('.scene-picker select')
  assert.equal(await picker.inputValue(), 'fall')
  assert(Math.abs(Number(await page.locator('#genesis-time').inputValue()) - sceneBounds('fall').start) < 0.0002)
  await page.goto(base + '/genesis?scene=not-a-scene&pause=1&quality=low')
  await page.locator('.genesis-illustration--beginning svg.gi-art').waitFor({ state: 'visible' })
  assert.equal(await picker.inputValue(), 'beginning')
  const middle = SCENES.find((scene) => scene.id === 'day3')
  assert(middle)
  const progress = (middle.start + middle.end) / 2
  await page.goto(`${base}/genesis?scene=fall&pause=1&quality=low&progress=${progress}`)
  await page.locator('.genesis-illustration--day3 svg.gi-art').waitFor({ state: 'visible' })
  assert.equal(await picker.inputValue(), 'day3', 'progress must take precedence over scene')

  for (const scene of SCENES) {
    await picker.selectOption(scene.id)
    const art = page.locator(`.genesis-illustration--${scene.id} svg.gi-art`)
    await art.waitFor({ state: 'visible' })
    assert((await art.getAttribute('viewBox'))?.endsWith('1200 800'), `${scene.id}: SVG viewBox missing`)
    assert.equal(await page.locator('.narration h1').textContent(), scene.name)
  }
  assert.equal(await page.locator('.genesis-illustration svg.gi-art').count(), 1)
  const pickerUrl = new URL(page.url())
  assert.equal(pickerUrl.searchParams.get('scene'), SCENES.at(-1).id)
  assert.equal(pickerUrl.searchParams.has('progress'), false)
  assert.equal(pickerUrl.searchParams.get('pause'), '1')
  assert.equal(pickerUrl.searchParams.get('quality'), 'low')
  await picker.selectOption('garden')
  const context = page.getByRole('link', { name: 'Read the KJV passage in full on Bible Gateway', exact: true })
  const contextHref = await context.getAttribute('href')
  assert(contextHref && new URL(contextHref).protocol === 'https:' && new URL(contextHref).searchParams.get('version') === 'KJV')
  assert.equal(await context.getAttribute('rel'), 'noopener noreferrer')
  checks.push('All 13 scenes render one SVG with matching copy; valid/invalid/progress URLs, picker state and KJV context work')
  await page.close()

  const playback = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  observe(playback)
  await playback.addInitScript(() => {
    window.__clips = []
    const NativeAudio = window.Audio
    window.Audio = function (...args) {
      const clip = new NativeAudio(...args)
      window.__clips.push(clip)
      return clip
    }
    window.Audio.prototype = NativeAudio.prototype
  })
  await genesis(playback, 'beginning')
  await playback.waitForFunction(() => window.__clips.length > 0)
  assert(await playback.evaluate(() => window.__clips.every((clip) => clip.paused)), 'paused entry started narration')
  const waves = playback.locator('.gi-waves').first()
  const stillWaves = await waveTransform(waves)
  assert(stillWaves.isIdentity, 'reduced motion did not stop waves')
  await playback.getByRole('button', { name: 'Play', exact: true }).focus()
  await playback.keyboard.press('Space')
  await playback.getByRole('button', { name: 'Pause', exact: true }).waitFor()
  await playback.waitForFunction(() => window.__clips.some((clip) => !clip.paused && clip.currentTime > 0.15))
  const playingWaves = await waveTransform(waves)
  assert(playingWaves.isIdentity, 'reduced motion animated waves during playback')
  assert.equal(playingWaves.normalized, stillWaves.normalized, 'reduced-motion wave transform changed during playback')
  const range = playback.getByLabel('Genesis time')
  const beforeSeek = Number(await range.inputValue())
  await range.focus()
  await range.press('ArrowRight')
  assert(Number(await range.inputValue()) > beforeSeek, 'keyboard seek did not advance the timeline')
  const readScene = playback.getByRole('button', { name: 'Read this scene' })
  await readScene.click()
  const dialog = playback.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  assert.equal(await playback.getByRole('button', { name: 'Play', exact: true }).count(), 1, 'opening scene text did not pause playback')
  assert(await playback.evaluate(() => window.__clips.every((clip) => clip.paused)), 'opening scene text did not pause narration')
  assert(await dialog.getByRole('button', { name: 'Close scene text' }).evaluate((el) => document.activeElement === el), 'dialog focus did not enter')
  await playback.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert(await readScene.evaluate((el) => document.activeElement === el), 'Escape did not restore focus to Read this scene')
  await playback.locator('.scene-picker select').selectOption('fall')
  assert(await playback.evaluate(() => window.__clips.every((clip) => clip.paused)), 'paused seek restarted narration')
  await playback.getByRole('button', { name: 'Play', exact: true }).click()
  await playback.waitForFunction(() => window.__clips.some((clip) => !clip.paused))
  await playback.getByRole('button', { name: 'Sound on', exact: true }).click()
  assert(await playback.evaluate(() => window.__clips.every((clip) => clip.paused)), 'mute did not stop narration')
  checks.push('Paused entry, keyboard Play/seek, mute, reduced motion, native scene dialog focus/Escape and silent paused seek work')
  await playback.close()

  const blocked = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  observe(blocked)
  await blocked.route('**/*.glb', (route) => route.abort('failed'))
  await blocked.addInitScript(() => {
    window.__webglAttempts = 0
    const nativeGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/^(?:webgl2?|experimental-webgl)$/i.test(String(type))) {
        window.__webglAttempts += 1
        return null
      }
      return nativeGetContext.call(this, type, ...args)
    }
  })
  await genesis(blocked, 'garden')
  assert.equal(await blocked.evaluate(() => window.__webglAttempts), 0, 'active renderer attempted WebGL')
  assert.equal(await blocked.locator('canvas').count(), 0)
  assert.equal(await blocked.getByText('The 3D scene could not start.', { exact: true }).count(), 0)
  await blocked.screenshot({ path: `${out}/genesis-webgl-blocked-1280.png` })
  await blocked.close()
  assert.deepEqual(glbRequests, [], 'active routes requested legacy GLB models')
  assert.deepEqual(errors, [], 'browser page errors')
  checks.push('Genesis works with WebGL unavailable and makes no WebGL or GLB requests')
  await writeFile(`${out}/checks.json`, JSON.stringify({ base, checks, errors, glbRequests }, null, 2))
  console.log(checks.join('\n'))
} finally {
  await browser.close()
}
