import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateInputs, validatePronunciationOverrides } from './import-higgsfield-audio.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bytes = readFileSync(path.join(root, 'docs/audio/higgsfield-narration-2026-09-23.json'))
const manifest = JSON.parse(bytes.toString('utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceHashes = Object.fromEntries(Object.keys(manifest.sourceFiles).map((file) =>
  [file, sha256(readFileSync(path.join(root, file)))]))

function fixture() {
  const units = manifest.generationUnits
  return {
    binding: { manifestSha256: sha256(bytes), units: units.map((unit, index) =>
      ({ index, id: unit.id, textSha256: sha256(unit.text) })) },
    submitted: units.map((unit, i) => ({ i, id: unit.id, text: unit.text })),
    jobs: units.map((_unit, index) => ({ index, job_id: `job-${String(index).padStart(8, '0')}`,
      status: 'completed', result_url: `https://example.org/audio/${index}.mp3` })),
  }
}

describe('Higgsfield import binding', () => {
  it('permits only the reviewed pronunciation alias tied to its exact job', () => {
    const { jobs } = fixture()
    const text = manifest.generationUnits[26].text
    const override = { index: 26, canonicalText: text, synthesisText: text.replace(/\bye\b/g, 'yee'), reason: 'Pronunciation', job_id: jobs[26].job_id }
    assert.equal(validatePronunciationOverrides([override], manifest, jobs).size, 1)
    assert.throws(() => validatePronunciationOverrides([{ ...override, synthesisText: 'Changed Scripture' }], manifest, jobs), /differs/)
    assert.throws(() => validatePronunciationOverrides([{ ...override, job_id: 'other-job' }], manifest, jobs), /differs/)
  })
  it('accepts all 44 unique units only when submitted text matches the saved manifest', () => {
    const { binding, submitted, jobs } = fixture()
    const result = validateInputs(manifest, bytes, binding, submitted, jobs, sourceHashes)
    assert.equal(result.completed, 44)
    assert.equal(result.missing, 0)
  })

  it('rejects changed text, duplicate jobs, and untrusted result URLs before staging', () => {
    const changed = fixture()
    changed.submitted[9].text += ' extra'
    assert.throws(() => validateInputs(manifest, bytes, changed.binding, changed.submitted, changed.jobs, sourceHashes), /Submitted text/)

    const duplicate = fixture()
    duplicate.jobs[9].index = 8
    assert.throws(() => validateInputs(manifest, bytes, duplicate.binding, duplicate.submitted, duplicate.jobs, sourceHashes), /duplicate index/)

    const insecure = fixture()
    insecure.jobs[9].result_url = 'http://example.org/audio.mp3'
    assert.throws(() => validateInputs(manifest, bytes, insecure.binding, insecure.submitted, insecure.jobs, sourceHashes), /public HTTPS/)
  })

  it('fails closed when the source or submission manifest changes', () => {
    const { binding, submitted, jobs } = fixture()
    assert.throws(() => validateInputs(manifest, bytes, binding, submitted, jobs,
      { ...sourceHashes, 'src/genesis/script.ts': 'outdated' }), /Manifest source changed/)
    binding.manifestSha256 = 'outdated'
    assert.throws(() => validateInputs(manifest, bytes, binding, submitted, jobs, sourceHashes), /Submission binding/)
  })
})
