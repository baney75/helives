#!/usr/bin/env node
/**
 * Compress an Imagine still into docs/targets/<book>/<scene>.webp
 * Usage: node scripts/compress-target.mjs <input> <book/scene>
 * Example: node scripts/compress-target.mjs ./still.jpg genesis/garden
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = process.argv[2]
const dest = process.argv[3]

if (!input || !dest || dest.includes('..')) {
  console.error('usage: node scripts/compress-target.mjs <input-image> <book/scene>')
  process.exit(1)
}

const out = path.join(root, 'docs', 'targets', `${dest}.webp`)
await mkdir(path.dirname(out), { recursive: true })

const child = spawn('cwebp', ['-q', '78', '-m', '6', path.resolve(input), '-o', out], {
  stdio: 'inherit',
})
child.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1)
  console.log(out)
})
