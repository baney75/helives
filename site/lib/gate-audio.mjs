// The daily gate's recordings (site/assets/gate.js): Donovan reading the prayers, committed as
// public/gate-voice/<section>.m4a with <section>.json timing. The gate offers Listen only when all three
// parts are there. No synthetic voice goes here.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const GATE_SECTIONS = ['lords-prayer', 'apostles-creed', 'illumination']

// dir: the folder of recordings. Each URL carries the file's hash, so a new reading is never hidden by a cache.
export function gateAudio(dir) {
  const url = (name) => {
    const file = join(dir, name)
    return existsSync(file) ? `/gate-voice/${name}?v=${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10)}` : null
  }
  const parts = GATE_SECTIONS.map((section) => ({ section, src: url(`${section}.m4a`), timing: url(`${section}.json`) }))
  return parts.every((p) => p.src && p.timing) ? { parts } : null
}
