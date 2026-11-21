import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ytId, loadMedia } from '../lib/load.mjs'

test('ytId reads watch, short and embed URLs', () => {
  assert.equal(ytId('https://www.youtube.com/watch?v=j9phNEaPrv8'), 'j9phNEaPrv8')
  assert.equal(ytId('https://youtu.be/j9phNEaPrv8?t=3'), 'j9phNEaPrv8')
  assert.equal(ytId('https://www.youtube-nocookie.com/embed/j9phNEaPrv8'), 'j9phNEaPrv8')
  assert.equal(ytId('https://example.com/bibleproject-book-of-psalms'), null)
})

test('every catalog video has a real YouTube id', () => {
  const raw = loadMedia().videos
  assert.ok(raw.length > 100, `videos loaded: ${raw.length}`)
  for (const v of raw) assert.match(v.id, /^[\w-]{11}$/, v.slug)
})

test('every image and map is a site path that exists in public/', async () => {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { ROOT } = await import('../lib/load.mjs')
  const m = loadMedia()
  assert.ok(m.images.length > 200 && m.maps.length > 40)
  for (const x of [...m.images, ...m.maps]) {
    assert.match(x.file, /^\/media\/[\w./-]+$/, x.id)
    assert.ok(existsSync(join(ROOT, 'public', x.file)), x.file)
  }
})
