#!/usr/bin/env node
/**
 * Record the cinematic Genesis tour at 1920×1080, then encode H.264.
 * Requires: pnpm build, Playwright Chromium, ffmpeg.
 */
import { spawn } from 'node:child_process'
import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTERACTIVE_SECONDS, SCENE_ORDER, sceneSeconds } from '../src/genesis/sceneTiming.ts'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demoDir = path.join(root, 'demo')
const rawDir = path.join(demoDir, 'raw')
const PORT = 4173
const DURATION_MS = (INTERACTIVE_SECONDS + 3) * 1000
const DOWNLOADS = path.join(process.env.HOME ?? '', 'Downloads', 'Genesis-HeLives-16x9.mp4')

function run(cmd, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...extra })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function latestWebm(dir) {
  const names = await readdir(dir)
  const ranked = []
  for (const name of names) {
    if (!name.endsWith('.webm')) continue
    const info = await stat(path.join(dir, name))
    ranked.push({ name, mtime: info.mtimeMs })
  }
  ranked.sort((a, b) => b.mtime - a.mtime)
  const first = ranked[0]
  if (!first) throw new Error('Playwright did not write a webm')
  return path.join(dir, first.name)
}

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

async function encode(input, output, lead) {
  const args = ['-y', '-ss', String(lead), '-i', input]
  for (const id of SCENE_ORDER) args.push('-i', path.join(root, 'public', 'audio', `${id}.mp3`))
  const tracks = SCENE_ORDER.map((id, index) => `[${index + 1}:a]apad,atrim=duration=${sceneSeconds(id)},asetpts=PTS-STARTPTS[a${index}]`)
  const concat = SCENE_ORDER.map((_, index) => `[a${index}]`).join('') + `concat=n=${SCENE_ORDER.length}:v=0:a=1[a]`
  const picture = `[0:v]fade=t=in:st=0:d=0.7,fade=t=out:st=${INTERACTIVE_SECONDS - 1.2}:d=1.2,fps=30,format=yuv420p[v]`
  args.push('-filter_complex', [...tracks, concat, picture].join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '17', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k', '-t', String(INTERACTIVE_SECONDS), '-movflags', '+faststart', output)
  await run('ffmpeg', args)
}

async function main() {
  await mkdir(rawDir, { recursive: true })
  await run('pnpm', ['build'], { cwd: root })

  const preview = spawn(
    'pnpm',
    ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  try {
    await waitForPreview(preview)
    const browser = await chromium.launch({
      args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
    })
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
      recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
    })
    const recordingStart = Date.now()
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${PORT}/genesis?cinematic=1&quality=high&pause=1`, {
      waitUntil: 'load',
      timeout: 30_000,
    })
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await page.locator('.scene-loading').waitFor({ state: 'detached' })
    const lead = (Date.now() - recordingStart) / 1000
    await page.keyboard.press('Space')
    await sleep(DURATION_MS)
    await context.close()
    await browser.close()

    const webm = await latestWebm(rawDir)
    const landscape = path.join(demoDir, 'genesis-16x9.mp4')
    await encode(webm, landscape, lead)
    await run('cp', [landscape, DOWNLOADS])
    console.log(`wrote ${landscape}`)
    console.log(`copied ${DOWNLOADS}`)
  } finally {
    preview.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
