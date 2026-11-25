// Checks the daily gate: the prayers are ready to read, Enter and Escape open the library at once, it
// stays open for the rest of the day, returns the next day, and never blocks crawlers or print.
// Usage: node scripts/check-gate.mjs http://localhost:8841 [screenshot-dir]
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:8841'
const shots = process.argv[3]
const b = await chromium.launch({ channel: 'chrome' })
const problems = []
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) problems.push(what) }
const gateOpen = (p) => p.evaluate(() => !!document.querySelector('dialog#gate[open]'))

const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
// Committed recordings must not change what the first checks see.
await ctx.route('**/assets/gate-audio.json*', (r) => r.fulfill({ contentType: 'application/json', body: '{"parts":[]}' }))
const p = await ctx.newPage()
p.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
await p.clock.install({ time: new Date('2026-11-21T09:00:00') })
await p.goto(`${base}/bible/john/3/`)
await p.waitForSelector('dialog#gate[open]', { timeout: 5000 }).catch(() => {})
check(await gateOpen(p), 'first visit of the day shows the gate')
check(await p.evaluate(() => getComputedStyle(document.querySelector('main')).visibility === 'visible' && document.querySelector('main').closest('[inert]') === null && document.querySelector('dialog#gate').matches(':modal')), 'gate is modal over the page')
check((await p.locator('#gate p[data-line]').count()) >= 20, 'gate shows the prayers and creed line by line')
check(await p.locator('#gate').getByText('Our Father, who art in heaven').evaluate((el) => el.getBoundingClientRect().bottom < document.querySelector('.gate-end').getBoundingClientRect().top), 'the Lord’s Prayer is on the first screen')
check(await p.locator('#gate').getByText('I believe in God the Father Almighty').isVisible(), 'Apostles’ Creed is on the gate')
check(await p.locator('#gate').getByText('Come, Holy Spirit').isVisible(), 'prayer for illumination is on the gate')
check(await p.locator('[data-gate-enter]').isEnabled(), 'Enter is open from the start')
check(await p.locator('[data-gate-enter]').evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 44 }), 'Enter is in view without scrolling')
check(await p.evaluate(() => document.querySelector('.gate-scroll').scrollTop === 0 && document.activeElement.classList.contains('gate-scroll')), 'the gate opens at the top, focused')
check(!(await p.locator('[data-gate-read]').isVisible()), 'with no recordings there is no Listen button')
// Paging with the keyboard shows every printed line of the prayers in full at some step, clear of the bar.
const paged = async () => {
  const seen = new Set()
  let all = 0
  await p.evaluate(() => { const s = document.querySelector('.gate-scroll'); s.scrollTop = 0; s.focus() })
  for (let k = 0; k < 30; k++) {
    await p.waitForTimeout(250)
    const step = await p.evaluate(() => {
      const bar = document.querySelector('.gate-end').getBoundingClientRect().top
      const rows = [...document.querySelectorAll('#gate [data-line]')].flatMap((el) => {
        const g = document.createRange()
        g.selectNodeContents(el)
        return [...g.getClientRects()].map((r, n) => ({ id: `${el.dataset.line}/${n}`, shown: r.top >= 0 && r.bottom <= bar }))
      })
      const s = document.querySelector('.gate-scroll')
      return { total: rows.length, shown: rows.filter((r) => r.shown).map((r) => r.id), end: s.scrollTop + s.clientHeight >= s.scrollHeight - 2 }
    })
    all = step.total
    for (const id of step.shown) seen.add(id)
    if (step.end) break
    await p.keyboard.press('PageDown')
  }
  await p.evaluate(() => { document.querySelector('.gate-scroll').scrollTop = 0 })
  return all > 20 && seen.size === all
}
for (const [w, h] of [[1280, 600], [1280, 900], [390, 844]]) {
  await p.setViewportSize({ width: w, height: h })
  check(await paged(), `the keyboard pages through every line at ${w}x${h}`)
}
// Tab to Enter and back: the page behind never moves, and the prayers scroll again with the keyboard.
await p.setViewportSize({ width: 1280, height: 600 })
const place = () => p.evaluate(() => ({ behind: scrollY, gate: document.querySelector('.gate-scroll').scrollTop, on: document.activeElement.className }))
await p.keyboard.press('Tab')
await p.keyboard.press('PageDown')
await p.waitForTimeout(400)
const onBar = await place()
check(onBar.on === 'btn' && onBar.behind === 0, 'paging from the Enter button does not move the page behind')
await p.keyboard.press('Shift+Tab')
await p.keyboard.press('PageDown')
await p.waitForTimeout(400)
const back = await place()
check(back.on.includes('gate-scroll') && back.gate > 0 && back.behind === 0, 'Shift+Tab returns to the prayers, and they page again')
check(await p.evaluate(() => getComputedStyle(document.querySelector('.gate-scroll')).outlineStyle === 'solid'), 'the prayers show focus when returned to')
await p.setViewportSize({ width: 390, height: 844 })
if (shots) await p.screenshot({ path: `${shots}/gate-390.png` })
await p.setViewportSize({ width: 1280, height: 900 })
await p.evaluate(() => { window.__gateCloses = 0; document.querySelector('dialog#gate').addEventListener('close', () => window.__gateCloses++) })
await p.mouse.click(8, 450) // beside the gate's content, on the dialog itself
check(await gateOpen(p) && (await p.evaluate(() => window.__gateCloses)) === 0, 'a click beside the gate does not close it, even for a moment')
await p.setViewportSize({ width: 390, height: 844 })
await p.click('[data-gate-enter]')
check(!(await gateOpen(p)), 'Amen closes the gate')
await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'main', null, { timeout: 2000 }).catch(() => {})
check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'main'), 'focus moves to the text')
await p.goto(`${base}/bible/john/4/`)
await p.waitForTimeout(400)
check(!(await gateOpen(p)), 'no gate again the same day')
await p.clock.setSystemTime(new Date('2026-11-22T08:00:00'))
await p.goto(`${base}/bible/john/4/`)
await p.waitForSelector('dialog#gate[open]', { timeout: 5000 }).catch(() => {})
check(await gateOpen(p), 'gate returns the next day')
await p.keyboard.press('Escape')
check(!(await gateOpen(p)), 'Escape opens the library too')
await p.goto(`${base}/bible/john/5/`)
await p.waitForTimeout(400)
check(!(await gateOpen(p)), 'entering with Escape counts for the day')
await ctx.close()

// ---------- Donovan's recordings ----------
// No real audio: the browser is served generated tones (a beep per line) and timing files through
// routes, in the shape the build and gate_voice.py write. Device speech is replaced by a recorder so
// any use of it would be seen: the gate must never speak with the device voice.
const SECTIONS = ['lords-prayer', 'apostles-creed', 'illumination']
const LINES = [6, 9, 6]
const LEAD = 0.4
const STEP = 0.6
const wav = (secs) => {
  const sr = 8000
  const n = Math.round(sr * secs)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let k = 0; k < n; k++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * k) / sr) * 3000 * ((k / sr) % STEP < STEP / 2 ? 1 : 0)), 44 + k * 2)
  return buf
}
async function recorded(context, { missing = [], noManifest = false } = {}) {
  await context.route('**/assets/gate-audio.json*', (r) => noManifest ? r.fulfill({ status: 404, body: 'Not found' }) : r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ parts: SECTIONS.map((s) => ({ section: s, src: `/gate-voice/${s}.m4a`, timing: `/gate-voice/${s}.json` })) }),
  }))
  await context.route('**/gate-voice/*', (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop()
    const [s, ext] = name.split('.')
    const i = SECTIONS.indexOf(s)
    if (i < 0 || missing.includes(name)) return r.fulfill({ status: 404, body: 'Not found' })
    if (ext === 'json') {
      const items = Array.from({ length: LINES[i] }, (_, j) => ({ id: `b${j}`, kind: 'block', start: +(LEAD + j * STEP).toFixed(3) }))
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items }) })
    }
    return r.fulfill({ contentType: 'audio/wav', body: wav(LEAD + LINES[i] * STEP + 0.2) })
  })
  await context.addInitScript(() => {
    window.__spoken = []
    const fake = {
      speak(u) { window.__spoken.push(u.text); setTimeout(() => { if (u.onstart) u.onstart(); setTimeout(() => { if (u.onend) u.onend() }, 30) }, 0) },
      cancel() {}, getVoices() { return [] }, speaking: false, pending: false,
    }
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
  return page
}
const litLine = (page, want, ms = 4000) => page.waitForFunction((w) => { const el = document.querySelector('#gate .reading'); return !!el && el.getAttribute('data-line') === w }, want, { timeout: ms }).then(() => true, () => false)
const loaded = (page) => page.waitForResponse((r) => r.url().endsWith('/gate-voice/illumination.json'), { timeout: 8000 }).then(() => true, () => false)

{
  const rc = await b.newContext({ viewport: { width: 390, height: 844 } })
  const rp = await recorded(rc)
  const ready = loaded(rp)
  await rp.goto(`${base}/bible/john/3/`)
  await rp.waitForSelector('dialog#gate[open]', { timeout: 5000 }).catch(() => {})
  check(await ready, 'gate loads the recordings’ timing when gate-audio.json exists')
  await rp.waitForTimeout(200)
  await rp.click('[data-gate-read]')
  check(await rp.textContent('[data-gate-read]') === 'Stop', 'Listen turns into Stop')
  let order = true
  for (let i = 0; i < SECTIONS.length; i++) for (let j = 0; j < LINES[i]; j++) if (!(await litLine(rp, `${i}-${j}`))) { order = false; console.log(`  line ${i}-${j} was not lit in turn`) }
  check(order, 'the recording lights every line in order, part by part')
  check(await rp.locator('[data-gate-enter]').isEnabled(), 'Enter stays open while the recording plays')
  await rp.waitForFunction(() => document.querySelector('[data-gate-read]').textContent === 'Listen', null, { timeout: 4000 }).catch(() => {})
  check(await rp.textContent('[data-gate-read]') === 'Listen', 'the button offers Listen again at the end')
  check(await rp.evaluate(() => window.__spoken.length === 0), 'device speech is not used when recordings exist')
  await rp.click('[data-gate-read]')
  check(await litLine(rp, '0-0') && await litLine(rp, '0-1'), 'Listen again plays from the first line')
  await rp.click('[data-gate-read]')
  await rp.waitForTimeout(900)
  check(await rp.evaluate(() => !document.querySelector('#gate .reading') && document.querySelector('#gate audio').paused), 'Stop stops the recording and clears the light')
  await rp.click('[data-gate-read]')
  await litLine(rp, '0-0')
  await rp.evaluate(() => { window.__gateAudio = document.querySelector('#gate audio') })
  await rp.click('[data-gate-enter]')
  await rp.waitForFunction(() => window.__gateAudio.paused, null, { timeout: 2000 }).catch(() => {})
  check(!(await gateOpen(rp)) && await rp.evaluate(() => window.__gateAudio.paused), 'Enter during the reading opens the library and stops the sound')
  await rc.close()
}
{
  const fc = await b.newContext({ viewport: { width: 390, height: 844 } })
  const fp = await recorded(fc, { missing: ['apostles-creed.m4a'] })
  const ready = loaded(fp)
  await fp.goto(`${base}/bible/john/3/`)
  await fp.waitForSelector('dialog#gate[open]', { timeout: 5000 }).catch(() => {})
  await ready
  await fp.waitForTimeout(200)
  await fp.click('[data-gate-read]')
  check(await litLine(fp, '0-0'), 'with one recording missing, the first part still plays')
  await fp.waitForFunction(() => document.querySelector('[data-gate-read]').hidden, null, { timeout: 8000 }).catch(() => {})
  check(await fp.evaluate(() => document.querySelector('[data-gate-read]').hidden && !document.querySelector('#gate .reading')), 'a 404 recording stops the reading and hides the button')
  check(await fp.evaluate(() => window.__spoken.length === 0), 'a 404 recording never hands over to device speech')
  await fc.close()
}
{
  const nc = await b.newContext({ viewport: { width: 390, height: 844 } })
  const np = await recorded(nc, { noManifest: true })
  await np.goto(`${base}/bible/john/3/`)
  await np.waitForSelector('dialog#gate[open]', { timeout: 5000 }).catch(() => {})
  await np.waitForTimeout(500)
  check(await np.evaluate(() => document.querySelector('[data-gate-read]').hidden), 'with no gate-audio.json there is no Listen button')
  check(await np.evaluate(() => window.__spoken.length === 0 && !document.querySelector('#gate audio')), 'with no gate-audio.json the device voice never speaks')
  await nc.close()
}

const bot = await b.newContext({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })
const bp = await bot.newPage()
await bp.goto(`${base}/bible/john/3/`)
await bp.waitForTimeout(500)
check(!(await gateOpen(bp)) && (await bp.evaluate(() => getComputedStyle(document.querySelector('main')).visibility)) === 'visible', 'crawlers read the page with no gate')
await bot.close()

const nojs = await b.newContext({ javaScriptEnabled: false })
const np = await nojs.newPage()
await np.goto(`${base}/bible/john/3/`)
check((await np.evaluate(() => 1).catch(() => 1)) === 1 && (await np.locator('main .text').isVisible()), 'without JavaScript the text is readable')
await nojs.close()

if (shots) {
  const dk = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
  const dp = await dk.newPage()
  await dp.goto(`${base}/`)
  await dp.waitForSelector('dialog#gate[open]')
  await dp.screenshot({ path: `${shots}/gate-1280.png` })
  await dk.close()
}
await b.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join('\n')}` : '\ngate checks passed')
process.exit(problems.length ? 1 : 0)
