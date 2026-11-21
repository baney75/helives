import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectionBundles, PART_LIMIT } from '../lib/bundles.mjs'

test('collection zips stay under the Workers asset limit and split when they must', () => {
  const dist = mkdtempSync(join(tmpdir(), 'hl-bundles-'))
  try {
    // A 1 MB limit forces Aquinas (about 4 MB zipped) to split, which proves the splitter.
    const limit = 1024 * 1024
    const got = collectionBundles(dist, { limit, only: ['apostolic', 'aquinas'] })
    assert.equal(got.length, 4, 'md and toml for both collections')
    assert.ok(got.find((b) => b.collection === 'aquinas').parts.length > 1, 'Aquinas is split into parts')
    assert.equal(got.find((b) => b.collection === 'apostolic').parts.length, 1, 'a small collection stays one zip')
    for (const b of got) for (const p of b.parts) {
      assert.ok(p.bytes <= limit || p.works === 1, `${p.href} is ${p.bytes} bytes`)
      assert.ok(p.bytes <= PART_LIMIT)
      assert.equal(statSync(join(dist, p.href)).size, p.bytes)
    }
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
})
