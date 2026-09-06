import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const base = process.env.HELIVES_PREVIEW_URL || 'http://127.0.0.1:8787'
const out = 'demo/refresh'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const errors = []
const checks = []
try {
  for (const width of [375, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
    page.on('pageerror', (error) => errors.push(String(error)))
    for (const [name, path] of [['home', '/'], ['scriptures', '/scriptures'], ['faith', '/faith'], ['afterword', '/genesis/afterword'], ['genesis', '/genesis?pause=1&progress=0.65&quality=low']]) {
      await page.goto(base + path)
      await page.evaluate(() => document.fonts.ready)
      await page.locator('h1').first().waitFor()
      if (name === 'genesis') await page.waitForTimeout(1600)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width} overflow`)
      await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: name !== 'genesis' })
      checks.push(`${name} at ${width}: no horizontal overflow, captured`)
    }
    await page.close()
  }
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
  checks.push('Testament and afterword anchors reach sections; route change resets scroll')
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
  assert.deepEqual(errors, [])
  await writeFile(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(checks.join('\n'))
} finally { await browser.close() }
