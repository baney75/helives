// Checks the audiobook player against a build that has audio for Psalm 23 and First Clement 1 and 2.
// It fails if the verse or paragraph being read is not highlighted, or if the player stops between sections.
// Usage: node scripts/check-listen.mjs http://localhost:8841
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:8841'
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
const problems = []
// A returning visitor who already passed today's gate (scripts/check-gate.mjs covers the gate itself).
await p.addInitScript(() => { const d = new Date(); localStorage.setItem('hl:gate', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) })
p.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
p.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`) })
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) problems.push(what) }
// Waits until the lit element is the expected one; the order of waits proves the order of highlights.
const litIs = (want, ms = 4000) => p.waitForFunction((w) => { const el = document.querySelector('.reading'); return !!el && (el.getAttribute('data-v') || el.getAttribute('data-b')) === w }, want, { timeout: ms }).then(() => true, () => false)

await p.goto(`${base}/bible/psalms/23/`)
await p.click('.desk-tools [data-listen]')
check(await litIs('1'), 'Psalm 23: verse 1 is lit')
check(await litIs('2'), 'Psalm 23: then verse 2 is lit')
check((await p.getAttribute('.desk-tools [data-listen]', 'aria-pressed')) === 'true', 'button shows playing')

await p.goto(`${base}/read/first-clement/introductory-note-to-the-first-epistle-of/`)
const n = await p.evaluate(() => JSON.parse(document.querySelector('[data-listen]').getAttribute('data-listen')).length)
check(n === 2, `prose page lists both sections with audio (${n})`)
await p.click('.desk-tools [data-listen]')
check(await litIs('chapter-1:0'), 'chapter 1, first paragraph lit')
check(await litIs('chapter-1:1'), 'then chapter 1, second paragraph lit')
check(await litIs('chapter-2:0', 6000), 'player moves on to chapter 2 by itself')

await b.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join('\n')}` : '\nlisten checks passed')
process.exit(problems.length ? 1 : 0)
