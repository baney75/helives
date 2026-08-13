#!/usr/bin/env node
/** Rasterize favicon, apple-touch, and Open Graph images from the brand SVGs. */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'public')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await rasterSvg(page, 'favicon.svg', 'favicon-32.png', 32)
  await rasterSvg(page, 'icon.svg', 'apple-touch-icon.png', 180)
  await rasterOg(page)
  await browser.close()
}

async function rasterSvg(page, svgName, outName, size) {
  const svg = await readFile(path.join(pub, svgName), 'utf8')
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><head><style>
      html,body{margin:0;background:#07060a}
      svg{display:block;width:${size}px;height:${size}px}
    </style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' },
  )
  await page.screenshot({
    path: path.join(pub, outName),
    type: 'png',
    clip: { x: 0, y: 0, width: size, height: size },
  })
}

async function rasterOg(page) {
  const font = pathToFileURL(path.join(pub, 'fonts', 'cormorant-garamond-latin-500.woff2')).href
  const icon = await readFile(path.join(pub, 'icon.svg'), 'utf8')
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.setContent(
    `<!doctype html><html><head><style>
      @font-face {
        font-family: 'Cormorant Garamond';
        src: url('${font}') format('woff2');
        font-weight: 500;
        font-style: normal;
      }
      html, body {
        margin: 0;
        width: 1200px;
        height: 630px;
        background: #07060a;
        color: #ece6d8;
        font-family: 'Cormorant Garamond', Palatino, serif;
      }
      .og {
        width: 1200px;
        height: 630px;
        box-sizing: border-box;
        padding: 88px 108px;
        background:
          radial-gradient(ellipse at 18% 42%, rgba(232, 184, 109, 0.18), transparent 58%),
          #07060a;
      }
      .mark { width: 72px; height: 72px; color: #e8b86d; }
      .mark svg { width: 72px; height: 72px; display: block; }
      h1 {
        margin: 28px 0 0;
        font-size: 128px;
        font-weight: 500;
        letter-spacing: -0.045em;
        line-height: 0.86;
      }
      .verse {
        margin: 28px 0 0;
        font-size: 32px;
        font-style: italic;
        color: #ece6d8;
      }
      .host {
        margin: 36px 0 0;
        font-size: 18px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #9a9184;
        font-style: normal;
        font-family: ui-monospace, Menlo, monospace;
      }
    </style></head><body>
      <div class="og">
        <div class="mark">${icon}</div>
        <h1>He Lives</h1>
        <p class="verse">because I live, ye shall live also.</p>
        <p class="host">helives.dev</p>
      </div>
    </body></html>`,
    { waitUntil: 'load' },
  )
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: path.join(pub, 'og.png'),
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
