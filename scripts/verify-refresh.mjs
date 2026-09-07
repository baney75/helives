import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { sceneBounds } from '../src/genesis/sceneTiming.ts'
const base = process.env.HELIVES_PREVIEW_URL || 'http://127.0.0.1:8787'
const out = 'demo/refresh'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const errors = []
const checks = []
try {
  for (const width of [375, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
    page.on('pageerror', (error) => errors.push(String(error)))
    for (const [name, path] of [['home', '/'], ['scriptures', '/scriptures'], ['faith', '/faith'], ['afterword', '/genesis/afterword'], ['genesis', '/genesis?pause=1&progress=0.65&quality=low']]) {
      await page.goto(base + path)
      await page.evaluate(() => document.fonts.ready)
      await page.locator('h1').first().waitFor()
      if (name === 'genesis') await page.waitForTimeout(1600)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width} overflow`)
      await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: !['genesis', 'scriptures'].includes(name) })
      checks.push(`${name} at ${width}: no horizontal overflow, captured`)
    }
    await page.close()
  }
  // A 640 CSS-pixel viewport at 2x scale matches a 1280px-wide display at 200% zoom.
  const zoomed = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  for (const [name, path] of [['home', '/'], ['scriptures', '/scriptures'], ['faith', '/faith'], ['afterword', '/genesis/afterword'], ['genesis', '/genesis?scene=fall&pause=1&quality=low']]) {
    await zoomed.goto(base + path)
    await zoomed.locator('h1').first().waitFor()
    assert(await zoomed.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} 200% zoom overflow`)
  }
  await zoomed.screenshot({ path: `${out}/genesis-200pct.png`, fullPage: true })
  await zoomed.close()
  checks.push('Core routes reflow without horizontal overflow at a 200% effective viewport')
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await p.goto(base + '/scriptures')
  await p.getByRole('link', { name: 'New Testament', exact: false }).click()
  assert.equal(new URL(p.url()).hash, '#new-testament')
  assert(await p.locator('#new-testament').evaluate(el => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < 100))
  await p.getByRole('link', { name: 'Faith', exact: true }).click()
  assert.equal(await p.evaluate(() => scrollY), 0)
  await p.goto(base + '/genesis/afterword')
  await p.getByRole('link', { name: 'Examine evidence', exact: false }).click()
  assert.equal(new URL(p.url()).hash, '#measure')
  assert.equal(await p.getByRole('link', { name: 'Read Genesis', exact: false }).getAttribute('href'), '/genesis?scene=beginning')
  checks.push('Testament and afterword anchors reach sections; Read Genesis returns to the Genesis beginning')
  await p.goto(base + '/a-route-that-does-not-exist')
  assert.equal(await p.locator('h1').textContent(), 'Not found')
  checks.push('Unknown routes render the dedicated not-found page')
  await p.goto(base + '/genesis?scene=fall&pause=1&quality=low')
  await p.getByLabel('Scene', { exact: false }).waitFor()
  assert.equal(await p.getByLabel('Scene', { exact: false }).inputValue(), 'fall')
  // The range input rounds the canonical scene start to its 0.0001 step.
  assert(Math.abs(Number(await p.locator('#genesis-time').inputValue()) - sceneBounds('fall').start) < 0.0002)
  await p.goto(base + '/genesis?scene=not-a-scene&pause=1&quality=low')
  await p.getByLabel('Scene', { exact: false }).waitFor()
  assert.equal(await p.getByLabel('Scene', { exact: false }).inputValue(), 'beginning')
  await p.goto(base + '/genesis?scene=fall&pause=1&quality=low&progress=0.2')
  await p.getByLabel('Scene', { exact: false }).waitFor()
  assert.equal(await p.getByLabel('Scene', { exact: false }).inputValue(), 'day3')
  await p.goto(base + '/genesis?pause=1&quality=low&progress=0.65')
  await p.getByLabel('Scene', { exact: false }).selectOption('fall')
  await p.waitForTimeout(100)
  const pickerUrl = new URL(p.url())
  assert.equal(pickerUrl.searchParams.get('scene'), 'fall')
  assert.equal(pickerUrl.searchParams.has('progress'), false)
  assert.equal(pickerUrl.searchParams.get('pause'), '1')
  assert.equal(pickerUrl.searchParams.get('quality'), 'low')
  const context = p.getByRole('link', { name: 'Read the KJV passage in full on Bible Gateway', exact: true })
  const contextHref = await context.getAttribute('href')
  assert(contextHref && new URL(contextHref).protocol === 'https:' && new URL(contextHref).searchParams.get('version') === 'KJV')
  assert.equal(await context.getAttribute('rel'), 'noopener noreferrer')
  checks.push('Direct valid and invalid scene links resolve correctly; progress wins; picker updates a paused URL; KJV context link is safe')
  await p.addInitScript(() => {
    window.__clips = []
    const OriginalAudio = window.Audio
    window.Audio = function(...args) { const audio = new OriginalAudio(...args); window.__clips.push(audio); return audio }
  })
  await p.goto(base + '/genesis?pause=1&quality=low')
  await p.getByRole('button', { name: 'Play', exact: true }).waitFor()
  await p.waitForTimeout(500)
  assert(await p.evaluate(() => window.__clips.length > 0 && window.__clips.every(a => a.paused)))
  await p.getByRole('button', { name: 'Play', exact: true }).focus()
  await p.keyboard.press('Space')
  await p.getByRole('button', { name: 'Pause', exact: true }).waitFor()
  await p.waitForTimeout(250)
  assert(await p.evaluate(() => window.__clips.some(a => !a.paused)))
  await p.getByRole('button', { name: 'Sound on', exact: true }).click()
  assert(await p.evaluate(() => window.__clips.every(a => a.paused)))
  await p.getByRole('button', { name: 'Pause', exact: true }).click()
  await p.getByLabel('Scene', { exact: false }).selectOption('fall')
  await p.waitForTimeout(300)
  assert(await p.evaluate(() => window.__clips.every(a => a.paused)))
  checks.push('Paused entry silent; keyboard Play works once; mute stops audio; paused scene changes stay silent')
  await p.close()
  const noWebgl = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  await noWebgl.addInitScript(() => {
    window.__clips = []
    window.__webglDisabled = true
    const OriginalAudio = window.Audio
    window.Audio = function(...args) { const audio = new OriginalAudio(...args); window.__clips.push(audio); return audio }
    const nativeGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (window.__webglDisabled && String(type).startsWith('webgl')) return null
      return nativeGetContext.call(this, type, ...args)
    }
  })
  await noWebgl.goto(base + '/genesis?scene=beginning&quality=low')
  await noWebgl.getByText('The 3D scene could not start.', { exact: true }).waitFor()
  await noWebgl.getByText('Loading scene…', { exact: true }).waitFor({ state: 'detached' })
  const fallbackTimeline = noWebgl.getByLabel('Genesis time')
  const fallbackStart = Number(await fallbackTimeline.inputValue())
  await noWebgl.getByRole('button', { name: 'Play', exact: true }).click()
  await noWebgl.waitForTimeout(900)
  assert(Number(await fallbackTimeline.inputValue()) > fallbackStart, 'fallback timeline did not advance')
  assert(await noWebgl.evaluate(() => window.__clips.some(a => !a.paused)), 'fallback narration did not play')
  const beforeUnavailableRetry = Number(await fallbackTimeline.inputValue())
  await noWebgl.getByRole('button', { name: 'Retry 3D scene', exact: true }).click()
  await noWebgl.waitForTimeout(900)
  assert(Number(await fallbackTimeline.inputValue()) > beforeUnavailableRetry, 'persistent no-WebGL retry froze the fallback timeline')
  assert(await noWebgl.evaluate(() => window.__clips.some(a => !a.paused)), 'persistent no-WebGL retry paused narration')
  await noWebgl.evaluate(() => { window.__webglDisabled = false })
  await noWebgl.getByRole('button', { name: 'Retry 3D scene', exact: true }).click()
  await noWebgl.locator('.app.has-scene-fallback').waitFor({ state: 'detached', timeout: 15_000 })
  await noWebgl.locator('canvas').waitFor({ state: 'visible' })
  await noWebgl.getByText('Loading scene…', { exact: true }).waitFor({ state: 'detached', timeout: 15_000 })
  await noWebgl.screenshot({ path: `${out}/webgl-fallback-1280.png` })
  await noWebgl.close()
  checks.push('Unavailable WebGL stays playable after a failed retry and restores Canvas after graphics recovery')

  let blockFish = true
  const failedModel = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  await failedModel.route('**/models/genesis/fish.glb', async (route) => {
    if (blockFish) await route.abort('failed')
    else await route.continue()
  })
  await failedModel.goto(base + '/genesis?scene=day5&quality=low')
  await failedModel.getByText('The 3D scene could not start.', { exact: true }).waitFor()
  assert.equal(await failedModel.locator('h1').textContent(), 'Fish and fowl')
  await failedModel.getByRole('button', { name: 'Play', exact: true }).waitFor()
  blockFish = false
  await failedModel.getByRole('button', { name: 'Retry 3D scene', exact: true }).click()
  await failedModel.getByText('The 3D scene could not start.', { exact: true }).waitFor({ state: 'hidden' })
  await failedModel.locator('canvas').waitFor({ state: 'visible' })
  await failedModel.getByText('Loading scene…', { exact: true }).waitFor({ state: 'detached', timeout: 15_000 })
  await failedModel.close()
  checks.push('A blocked Day 5 fish model preserves the readable app and Retry restores the authored Canvas')
  assert.deepEqual(errors, [])
  await writeFile(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(checks.join('\n'))
} catch (error) {
  console.error(error)
  throw error
} finally { await browser.close() }
