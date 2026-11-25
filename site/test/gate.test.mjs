import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PARTS } from '../assets/gate.js'
import { GATE_SECTIONS, gateAudio } from '../lib/gate-audio.mjs'

const root = new URL('../../', import.meta.url)
const src = readFileSync(new URL('site/assets/gate.js', root), 'utf8')

test('nothing on the gate is locked', () => {
  assert.ok(!/\bdisabled\b/.test(src), 'no disabled Enter button')
  assert.ok(!/preventDefault/.test(src), 'Escape is not blocked')
  assert.ok(!/setTimeout/.test(src), 'no waiting time')
})

test('one part on the gate for each recording', () => assert.equal(PARTS.length, GATE_SECTIONS.length))

test('the narrator does not render the gate, and device speech is never used', () => {
  assert.ok(!existsSync(new URL('audio/gate.toml', root)))
  assert.ok(!/speechSynthesis/.test(src))
})

test('gate-audio offers the recordings only when all three parts and their timing are there', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'))
  assert.equal(gateAudio(dir), null)
  for (const s of GATE_SECTIONS) writeFileSync(join(dir, `${s}.m4a`), s)
  assert.equal(gateAudio(dir), null, 'no timing yet')
  for (const s of GATE_SECTIONS) writeFileSync(join(dir, `${s}.json`), '{}')
  const { parts } = gateAudio(dir)
  assert.deepEqual(parts.map((p) => p.section), GATE_SECTIONS)
  assert.match(parts[0].src, /^\/gate-voice\/lords-prayer\.m4a\?v=[0-9a-f]{10}$/)
  writeFileSync(join(dir, 'lords-prayer.m4a'), 'a new reading')
  assert.notEqual(gateAudio(dir).parts[0].src, parts[0].src, 'a new reading gets a new URL')
})
