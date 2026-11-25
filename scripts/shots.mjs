// Screenshots of a running build. Usage: node scripts/shots.mjs <base-url> <out-dir> <path>...
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const [, , base, out, ...paths] = process.argv
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const path of paths) for (const w of [390, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 860 }, deviceScaleFactor: w === 390 ? 2 : 1, colorScheme: process.env.SCHEME || 'light' })
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`${path} ${w}: ${r.status()} ${r.url()}`) })
  p.on('pageerror', (e) => errors.push(`${path} ${w}: ${e.message}`))
  await p.goto(base + path, { waitUntil: 'networkidle' })
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (wide > 0) errors.push(`${path} ${w}: page scrolls sideways by ${wide}px`)
  const name = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
  await p.screenshot({ path: `${out}/${name}-${w}.png` })
  await p.close()
}
await b.close()
console.log(errors.length ? errors.join('\n') : 'no console errors, no sideways scroll')
