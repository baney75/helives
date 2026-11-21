import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from 'smol-toml'
import { PARTS } from '../assets/gate.js'
import { GATE_SECTIONS, gateAudio } from '../lib/gate-audio.mjs'

const toml = parse(readFileSync(new URL('../../audio/gate.toml', import.meta.url), 'utf8'))

// The narrator reads audio/gate.toml; the gate shows PARTS. Block j of section i is lit as data-line="i-j",
// so the two must hold the same lines in the same order, one p block per line.
test('audio/gate.toml holds exactly the lines gate.js shows', () => {
  assert.equal(toml.work.id, 'gate')
  assert.deepEqual(toml.section.map((s) => s.id), GATE_SECTIONS)
  assert.equal(toml.section.length, PARTS.length)
  PARTS.forEach((part, i) => {
    const s = toml.section[i]
    assert.equal(s.title, part.title, `section ${s.id} title`)
    assert.ok(s.blocks.every((b) => b.t === 'p'), `section ${s.id} has only p blocks`)
    assert.deepEqual(s.blocks.map((b) => b.text), part.lines, `section ${s.id} lines`)
  })
})

const item = (section) => ({ work: 'gate', section, url: `/audio/gate/${section}.m4a`, timing: `/audio/gate/${section}.json` })

test('gate-audio lists the three recordings in order when all are published', () => {
  const audio = new Map(GATE_SECTIONS.map((s) => [`gate/${s}`, item(s)]))
  audio.set('bsb-psalms/23', { work: 'bsb-psalms', section: '23', url: '/audio/bsb-psalms/23.m4a', timing: '/audio/bsb-psalms/23.json' })
  assert.deepEqual(gateAudio(audio), {
    parts: [
      { section: 'lords-prayer', src: '/audio/gate/lords-prayer.m4a', timing: '/audio/gate/lords-prayer.json' },
      { section: 'apostles-creed', src: '/audio/gate/apostles-creed.m4a', timing: '/audio/gate/apostles-creed.json' },
      { section: 'illumination', src: '/audio/gate/illumination.m4a', timing: '/audio/gate/illumination.json' },
    ],
  })
})

test('gate-audio is nothing until every part is published', () => {
  assert.equal(gateAudio(new Map()), null)
  assert.equal(gateAudio(new Map(GATE_SECTIONS.slice(0, 2).map((s) => [`gate/${s}`, item(s)]))), null)
})
