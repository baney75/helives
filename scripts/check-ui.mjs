// Drives the interactive parts of a running build and fails on any broken step.
// Usage: node scripts/check-ui.mjs http://localhost:8841
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:8841'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const problems = []
// A returning visitor who already passed today's gate (scripts/check-gate.mjs covers the gate itself).
await p.addInitScript(() => { const d = new Date(); localStorage.setItem('hl:gate', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) })
p.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/nope')) problems.push(`${r.status()} ${r.url()}`) })
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) problems.push(what) }

// 1. A reference typed into search opens the passage
await p.goto(`${base}/search/?q=${encodeURIComponent('John 3:16')}`)
await p.waitForURL(/\/bible\/john\/3\/#v16$/, { timeout: 5000 }).catch(() => {})
check(p.url().endsWith('/bible/john/3/#v16'), 'reference search opens John 3:16')

// 2. A word search lists results with highlighted terms
await p.goto(`${base}/search/?q=grace`)
await p.waitForSelector('#results li', { timeout: 8000 }).catch(() => {})
const n = await p.locator('#results li').count()
check(n > 10, `word search lists results (${n})`)
check((await p.locator('#results mark').count()) > 0, 'results highlight the term')

// 3. Reading settings change the page and persist across pages
await p.goto(`${base}/bible/psalms/23/`)
await p.click('.dock [data-open="settings"]')
check(await p.locator('#settings').evaluate((d) => d.open), 'settings open from the dock')
await p.click('#settings label:has(input[name="theme"][value="dusk"])')
await p.click('#settings label:has(input[name="fx"][value="off"])')
check((await p.getAttribute('html', 'data-theme')) === 'dusk', 'theme changes to Dusk')
const w = await p.locator('.text b').first().evaluate((el) => getComputedStyle(el).fontWeight)
check(w === '400', `focus bold off leaves words at normal weight (${w})`)
await p.keyboard.press('Escape')
await p.goto(`${base}/bible/psalms/24/`)
check((await p.getAttribute('html', 'data-theme')) === 'dusk' && (await p.getAttribute('html', 'data-fx')) === 'off', 'settings persist on the next page')
await p.click('.dock [data-open="settings"]')
await p.click('#settings [data-reset]')
check((await p.getAttribute('html', 'data-fx')) === 'on', 'reset restores focus bold')
await p.keyboard.press('Escape')

// 4. Background sound starts without errors
await p.click('.dock [data-open="sounds"]')
await p.click('#sounds label:has(input[name="sound"][value="rain"])')
await p.waitForTimeout(600)
check((await p.locator('.dock [data-open="sounds"]').getAttribute('aria-pressed')) === 'true', 'sound shows as on')
await p.click('#sounds label:has(input[name="sound"][value="off"])')
await p.keyboard.press('Escape')

// 5. Keyboard: right arrow goes to the next chapter
await p.goto(`${base}/bible/psalms/23/`)
await p.keyboard.press('ArrowRight')
await p.waitForURL(/psalms\/24\//, { timeout: 4000 }).catch(() => {})
check(p.url().includes('/bible/psalms/24/'), 'right arrow opens the next chapter')

// 6. Place keeping: home offers to continue, book page shades chapters read
await p.goto(`${base}/`)
check(await p.locator('#continue').isVisible(), 'home offers Continue reading')
await p.goto(`${base}/bible/psalms/`)
check((await p.locator('.chapters a.read').count()) >= 2, 'chapters read are shaded')

// 7. Filters on list pages
await p.goto(`${base}/encyclicals/`)
const total = await p.locator('.list > li').count()
await p.fill('#ef', 'leo xiii')
const shown = await p.locator('.list > li:not([hidden])').count()
check(total > 0 && shown > 0 && shown < total, `encyclical filter narrows the list (${shown} of ${total})`)

// 8. 404 page
const r = await p.goto(`${base}/nope/`)
check(r.status() === 404 && (await p.textContent('h1')).includes('not here'), 'unknown pages get the 404 page')

// 9. Every art plate and map loads (scrolls so lazy images fetch).
for (const path of ['/art/', '/maps/']) {
  await p.goto(`${base}${path}`)
  const bad = await p.evaluate(async () => {
    const imgs = [...document.querySelectorAll('main img')]
    for (const i of imgs) { i.loading = 'eager'; i.scrollIntoView() }
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
    return { n: imgs.length, bad: imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')).slice(0, 5) }
  })
  check(bad.n > 40 && bad.bad.length === 0, `${path} images all load (${bad.n}${bad.bad.length ? `; broken: ${bad.bad.join(', ')}` : ''})`)
}

// 10. A jump link lands under the header, though the pictures above it load on the way.
await p.emulateMedia({ reducedMotion: 'no-preference' })
await p.goto(`${base}/evidence/stones-and-places/`)
const last = await p.locator('.exhibit').last().getAttribute('id')
await p.click(`.notice a[href="#${last}"]`)
await p.waitForTimeout(4000)
const y = Math.round(await p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, last))
check(y >= 60 && y <= 100, `evidence jump link lands under the header (${y})`)

await b.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join('\n')}` : '\nall interactive checks passed')
process.exit(problems.length ? 1 : 0)
