#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.HELIVES_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--disable-audio-output'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    window.__helivesPlayAttempts = 0
    window.__helivesAllowSound = false
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      window.__helivesPlayAttempts += 1
      if (!window.__helivesAllowSound) {
        return Promise.reject(new DOMException('gesture required', 'NotAllowedError'))
      }
      return originalPlay.apply(this, args)
    }
  })

  await page.goto(`${base}/genesis?quality=medium`, { waitUntil: 'networkidle' })
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await play.waitFor()
  const timeline = page.getByLabel('Genesis time')
  const initial = Number(await timeline.inputValue())
  await page.waitForTimeout(1000)
  assert.equal(await page.evaluate(() => window.__helivesPlayAttempts), 0, 'a route visit must not attempt audio')
  assert(Math.abs(Number(await timeline.inputValue()) - initial) < 0.0005, 'the default route must remain paused')

  await page.locator('body').dispatchEvent('pointerdown')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.__helivesPlayAttempts), 0, 'pointer and Reset interactions must not consent to sound')

  await play.click()
  const gate = page.getByRole('button', { name: 'Begin with sound', exact: true })
  await gate.waitFor()
  assert.equal(await page.evaluate(() => window.__helivesPlayAttempts), 1, 'Play should make the first audio attempt')
  const blockedAt = Number(await timeline.inputValue())
  await page.waitForTimeout(800)
  assert(Math.abs(Number(await timeline.inputValue()) - blockedAt) < 0.0005, 'blocked narration must pause the timeline')

  await page.evaluate(() => { window.__helivesAllowSound = true })
  await page.locator('body').dispatchEvent('pointerdown')
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.__helivesPlayAttempts), 1, 'only the sound gate may retry blocked audio')
  await gate.click()
  await gate.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__helivesPlayAttempts), 2, 'Begin with sound should make one explicit retry')
  await page.waitForTimeout(1000)
  assert(Number(await timeline.inputValue()) > blockedAt, 'timeline must resume after explicit sound consent')

  const stalled = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await stalled.emulateMedia({ reducedMotion: 'reduce' })
  await stalled.addInitScript(() => {
    window.__stalledClips = []
    const NativeAudio = window.Audio
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args)
      window.__stalledClips.push(audio)
      return audio
    }
    window.Audio.prototype = NativeAudio.prototype
    HTMLMediaElement.prototype.play = function () { return Promise.resolve() }
  })
  await stalled.goto(`${base}/genesis?quality=low`, { waitUntil: 'networkidle' })
  const stalledTimeline = stalled.getByLabel('Genesis time')
  await stalled.getByRole('button', { name: 'Play', exact: true }).click()
  const continueSilent = stalled.getByRole('button', { name: 'Waiting for audio — continue without sound', exact: true })
  await continueSilent.waitFor({ timeout: 5_000 })
  await stalled.evaluate(() => { window.__stalledClips.at(-1).currentTime = 0.25 })
  await continueSilent.waitFor({ state: 'detached', timeout: 1_500 })
  await continueSilent.waitFor({ timeout: 5_000 })
  const stalledAt = Number(await stalledTimeline.inputValue())
  await continueSilent.click()
  await stalled.waitForTimeout(900)
  assert(Number(await stalledTimeline.inputValue()) > stalledAt, 'silent recovery must resume the visual clock')
  await stalled.close()

  console.log('Genesis consent passed: silent default, explicit blocked-audio retry, and stalled-clock silent recovery')
} finally {
  await browser.close()
}
