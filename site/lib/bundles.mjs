// Zips each collection's Markdown and TOML for /downloads/, and the whole library for GitHub releases.
// A Workers asset may be at most 25 MiB, so a collection that zips larger is split into numbered parts.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { COLLECTIONS, LIB } from './load.mjs'

export const PART_LIMIT = 24 * 1024 * 1024

function files(dir, ext) {
  const found = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(`.${ext}`) && e.name !== 'SCHEMA.md') found.push(relative(LIB, p))
    }
  }
  if (existsSync(dir)) walk(dir)
  return found.sort()
}

function zip(target, list) {
  rmSync(target, { force: true })
  execFileSync('zip', ['-q', '-9', '-X', target, '-@'], { cwd: LIB, input: list.join('\n') })
  return statSync(target).size
}

// Groups files by raw size so each zip lands under the limit: this text compresses well over 2.5 times,
// so a group of at most limit * 2.5 raw bytes fits. A group that still zips too large is halved.
const RATIO = 2.5
function groupsOf(list, limit) {
  const groups = [[]]
  let raw = 0
  for (const f of list) {
    const n = statSync(join(LIB, f)).size
    if (raw + n > limit * RATIO && groups.at(-1).length) {
      groups.push([])
      raw = 0
    }
    groups.at(-1).push(f)
    raw += n
  }
  return groups
}

function writeParts(dir, base, ext, list, limit) {
  let groups = groupsOf(list, limit)
  for (;;) {
    const parts = groups.map((g, i) => {
      const name = groups.length > 1 ? `${base}-part-${i + 1}-${ext}.zip` : `${base}-${ext}.zip`
      return { name, g, bytes: zip(join(dir, name), g) }
    })
    const over = parts.findIndex((p) => p.bytes > limit && p.g.length > 1)
    if (over < 0) return parts
    for (const p of parts) rmSync(join(dir, p.name), { force: true })
    const g = groups[over]
    groups = [...groups.slice(0, over), g.slice(0, Math.ceil(g.length / 2)), g.slice(Math.ceil(g.length / 2)), ...groups.slice(over + 1)]
  }
}

/** Writes dist/dl/collections/*.zip and returns [{collection, title, ext, parts:[{href, bytes, works}]}]. */
export function collectionBundles(dist, { limit = PART_LIMIT, only } = {}) {
  const dir = join(dist, 'dl', 'collections')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const out = []
  for (const c of COLLECTIONS.filter((x) => !only || only.includes(x.id))) {
    for (const ext of ['md', 'toml']) {
      const list = files(join(LIB, c.id), ext)
      if (!list.length) continue
      const parts = writeParts(dir, c.id, ext, list, limit).map((p) => ({ href: `/dl/collections/${p.name}`, bytes: p.bytes, works: p.g.length }))
      for (const p of parts) if (p.bytes > PART_LIMIT) throw new Error(`${p.href} is ${p.bytes} bytes, over the Workers asset limit`)
      out.push({ collection: c.id, title: c.title, ext, parts })
    }
  }
  return out
}

/** Writes the whole library as two zips into outDir, for a GitHub release. Returns their paths. */
export function libraryBundles(outDir) {
  mkdirSync(outDir, { recursive: true })
  return ['md', 'toml'].map((ext) => {
    const target = join(outDir, `helives-library-${ext}.zip`)
    zip(target, COLLECTIONS.flatMap((c) => files(join(LIB, c.id), ext)))
    return target
  })
}
