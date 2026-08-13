#!/usr/bin/env node
/**
 * Screenshot paused Genesis beats for still-vs-shot compare.
 * Usage: node scripts/capture-genesis.mjs --out <dir>
 * Serves `dist/` via `pnpm preview` unless HELIVES_PREVIEW_URL is set.
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outFlag = process.argv.indexOf('--out')
const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : path.join(root, 'demo', 'captures')
const PORT = Number(process.env.HELIVES_PREVIEW_PORT ?? 4177)
const givenUrl = process.env.HELIVES_PREVIEW_URL

const BEATS = [
  { name: 'beginning', path: '/genesis?pause=1&progress=0.02&quality=high', title: 'Genesis — He Lives' },
  { name: 'garden', path: '/genesis?pause=1&progress=0.65&quality=high', title: 'Genesis — He Lives' },
  { name: 'fall', path: '/genesis?pause=1&progress=0.745&quality=high', title: 'Genesis — He Lives' },
  { name: 'home', path: '/', title: 'He Lives' },
]

function waitForPreview(child) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk) => {
      buf += String(chunk)
      if (buf.includes('Local:') || buf.includes(String(PORT))) {
        child.stdout?.off('data', onData)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    setTimeout(() => reject(new Error('preview did not start')), 20_000)
  })
}

await mkdir(outDir, { recursive: true })

let preview
let base = givenUrl
if (!base) {
  preview = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(preview)
  base = `http://127.0.0.1:${PORT}`
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const errors = []
try {
  for (const beat of BEATS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    page.on('pageerror', (err) => errors.push(`${beat.name}: ${err.message}`))
    const url = `${base}${beat.path}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    const title = await page.title()
    if (title !== beat.title) {
      throw new Error(`wrong app at ${url}: title=${title}`)
    }
    await page.waitForTimeout(2800)
    const shot1280 = path.join(outDir, `${beat.name}-1280.png`)
    await page.screenshot({ path: shot1280 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: shot1280 })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(outDir, `${beat.name}-375.png`) })
    await page.close()
  }
} finally {
  await browser.close()
  preview?.kill('SIGTERM')
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(outDir)
