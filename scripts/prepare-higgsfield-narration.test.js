import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { prepareNarrationManifest } from './prepare-higgsfield-narration.mjs'

const root = new URL('../', import.meta.url)
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('source-built manifest preserves every paid input and transcript', async () => {
  const built = await prepareNarrationManifest()
  const bound = await readJson('docs/audio/higgsfield-narration-2026-09-23.json')
  assert.equal(built.generationUnits.length, 44)
  assert.deepEqual(built.generationUnits, bound.generationUnits)
  assert.deepEqual(built.scenes.map(({ id, narrationText }) => ({ id, narrationText })),
    bound.scenes.map(({ id, narrationText }) => ({ id, narrationText })))
  assert.equal(built.trailer.narrationText, bound.trailer.narrationText)
  for (const [file, expected] of Object.entries(built.sourceFiles)) {
    assert.equal(hash(await readFile(new URL(file, root))), expected)
  }
  assert.deepEqual(built.sourceFiles, bound.sourceFiles)
  assert.deepEqual(built.generationUnits.filter((unit) => unit.sceneId === 'fall').map((unit) => unit.action).filter(Boolean),
    ['look', 'take', 'give', 'depart'])
})

test('public session copy contains no private result URLs', async () => {
  const bytes = await readFile(new URL('docs/audio/higgsfield-narration-2026-09-23.json', root))
  assert.equal(hash(bytes), '1877685fee52b10eef04fe4abd98305a87fa20446662547490c827ba3e5cedcf')
  const urls = bytes.toString('utf8').match(/https?:\/\/[^"\s]+/g) ?? []
  assert.equal(urls.length, 5)
  assert.ok(urls.every((url) => new URL(url).hostname === 'www.biblegateway.com'))
})
