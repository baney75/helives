#!/usr/bin/env node
/** Reproducible, self-contained exports from one vector master. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { BRAND as b } from '../src/site/brand.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'public')
const mark = `<path d="${b.cross}" fill="${b.gold}"/><path d="${b.light}" fill="${b.dawn}"/>`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.viewBox}"><title>He Lives</title>${mark}</svg>`
const icon = svg.replace(mark, `<rect width="64" height="64" fill="${b.void}"/>${mark}`)
await mkdir(path.join(pub, 'brand'), { recursive: true })
await writeFile(path.join(pub, 'brand/mark.svg'), svg)
await writeFile(path.join(pub, 'favicon.svg'), icon)
await writeFile(path.join(pub, 'icon.svg'), icon)
await writeFile(path.join(pub, 'mask-icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.viewBox}"><path d="${b.cross}"/></svg>`)
const font = (await readFile(path.join(pub, 'fonts/cormorant-garamond-latin-500.woff2'))).toString('base64')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const [size, name] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [512, 'brand/icon-512.png']]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>body{margin:0;background:${b.void}}svg{display:block;width:100%;height:100%}</style>${icon}`)
    await page.screenshot({ path: path.join(pub, name) })
  }
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.setContent(`<!doctype html><style>
    @font-face{font-family:Brand;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:500}
    *{box-sizing:border-box}body{margin:0;background:${b.void};color:#ece6d8;font-family:Brand,serif}
    main{width:1200px;height:630px;padding:70px 88px;position:relative}
    .rule{height:1px;background:#e8b86d40;width:100%}
    .identity{display:flex;align-items:center;gap:36px;margin-top:95px}
    svg{width:114px;height:114px;flex:none}h1{font-size:140px;font-weight:500;letter-spacing:-6px;margin:0;line-height:1}
    .verse{font-size:33px;margin:36px 0 12px 151px;color:${b.dawn}}
    .cite{font:12px Georgia,serif;letter-spacing:2px;margin-left:151px;color:#b5ab9d}
    footer{position:absolute;bottom:58px;left:88px;right:88px;display:flex;justify-content:space-between;font:12px Georgia,serif;letter-spacing:2px;color:#b5ab9d}
    </style><main><div class="rule"></div><div class="identity">${svg}<h1>He Lives</h1></div>
    <p class="verse">because I live, ye shall live also.</p><p class="cite">JOHN 14:19 · KING JAMES VERSION</p>
    <footer><span>SCRIPTURE. LIGHT IN DARKNESS.</span><span>HELIVES.DEV</span></footer></main>`)
  await page.evaluate(async () => { await document.fonts.ready; if (!document.fonts.check('500 140px Brand')) throw new Error('Brand font failed to load') })
  await page.screenshot({ path: path.join(pub, 'og.png') })
} finally { await browser.close() }
console.log('Generated shared vector mark, favicons, app icons, and 1200 × 630 share artwork.')
