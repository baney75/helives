#!/usr/bin/env node
import { chromium } from 'playwright'

const base = process.env.HELIVES_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--disable-audio-output'],
})

try {
  const automatic = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await automatic.emulateMedia({ reducedMotion: 'reduce' })
  await automatic.addInitScript(() => {
    window.__helivesAutoplay = []
    const original = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      const event = { src: this.src, state: 'called' }
      window.__helivesAutoplay.push(event)
      const result = original.apply(this, args)
      void result.then(() => { event.state = 'resolved' }, () => { event.state = 'rejected' })
      return result
    }
  })
  await automatic.goto(`${base}/genesis?quality=medium`, { waitUntil: 'networkidle' })
  await automatic.waitForFunction(() => window.__helivesAutoplay?.some(
    (event) => event.src.includes('/audio/beginning.mp3') && event.state === 'resolved',
  ))
  await automatic.getByRole('button', { name: 'Pause' }).waitFor()
  if (await automatic.getByRole('button', { name: 'Begin with sound' }).count()) {
    throw new Error('sound gate appeared despite successful autoplay')
  }
  await automatic.close()

  const blocked = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await blocked.addInitScript(() => {
    window.__helivesPlayAttempts = 0
    window.__helivesPauseCalls = 0
    window.__helivesAllowSound = false
    const originalPlay = HTMLMediaElement.prototype.play
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.play = function (...args) {
      window.__helivesPlayAttempts += 1
      if (!window.__helivesAllowSound) {
        return Promise.reject(new DOMException('gesture required', 'NotAllowedError'))
      }
      return originalPlay.apply(this, args)
    }
    HTMLMediaElement.prototype.pause = function (...args) {
      window.__helivesPauseCalls += 1
      return originalPause.apply(this, args)
    }
  })
  await blocked.goto(`${base}/genesis?quality=medium`, { waitUntil: 'networkidle' })
  const gate = blocked.getByRole('button', { name: 'Begin with sound' })
  await gate.waitFor()
  await blocked.getByRole('button', { name: 'Play' }).waitFor()
  const timeline = blocked.getByLabel('Genesis time')
  const progressBefore = Number(await timeline.inputValue())
  await blocked.waitForTimeout(1200)
  const progressWhileBlocked = Number(await timeline.inputValue())
  const blockedAttempts = await blocked.evaluate(() => window.__helivesPlayAttempts)
  const pausesWhileBlocked = await blocked.evaluate(() => window.__helivesPauseCalls)
  if (blockedAttempts !== 1) {
    throw new Error(`blocked autoplay must make one attempt, got ${blockedAttempts}`)
  }
  if (Math.abs(progressWhileBlocked - progressBefore) > 0.0005) {
    throw new Error(`timeline moved while sound was blocked: ${progressBefore} -> ${progressWhileBlocked}`)
  }
  await blocked.evaluate(() => { window.__helivesAllowSound = true })
  // The capture-phase unlock intentionally fires before the React click handler,
  // so any first pointer interaction can authorize sound.
  await blocked.locator('body').dispatchEvent('pointerdown')
  await gate.waitFor({ state: 'detached' })
  await blocked.getByRole('button', { name: 'Pause' }).waitFor()
  const attempts = await blocked.evaluate(() => window.__helivesPlayAttempts)
  if (attempts !== 2) throw new Error(`expected exactly one autoplay retry, got ${attempts} play attempt(s)`)
  await blocked.waitForTimeout(1200)
  const pausesAfterResume = await blocked.evaluate(() => window.__helivesPauseCalls)
  if (pausesAfterResume !== pausesWhileBlocked) {
    throw new Error(`audio was paused after successful unlock: ${pausesWhileBlocked} -> ${pausesAfterResume}`)
  }
  const resumedProgress = Number(await timeline.inputValue())
  if (resumedProgress <= progressWhileBlocked) {
    throw new Error(`timeline did not resume after sound unlock: ${progressWhileBlocked} -> ${resumedProgress}`)
  }
  await blocked.close()

  console.log('Genesis autoplay passed: automatic reduced-motion start + blocked-policy synchronized retry')
} finally {
  await browser.close()
}
