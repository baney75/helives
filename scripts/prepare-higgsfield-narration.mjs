#!/usr/bin/env node
/** Rebuild the public narration transcript from the current Genesis source. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SCENES } from '../src/genesis/scenes.ts'
import { NARRATION, SCENE_VOICE_CUES } from '../src/genesis/script.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutput = path.join(root, 'demo', '2d-refresh', 'narration-manifest.generated.json')
const boundManifest = path.join(root, 'demo', '2d-refresh', 'narration-manifest.json')
const sourceFiles = ['src/genesis/script.ts', 'src/genesis/kjv.ts']
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export async function prepareNarrationManifest() {
  const hashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) =>
    [file, sha256(await readFile(path.join(root, file)))],
  )))
  const generationUnits = []
  const buildScene = (scene) => {
    const id = scene.id
    const cues = SCENE_VOICE_CUES[id]
    const source = cues?.length ? 'SCENE_VOICE_CUES' : 'NARRATION'
    const takes = cues?.length ? cues : [{ role: 'narrator', text: NARRATION[id] }]
    const narrationText = takes.map((cue) => cue.text).join(' ')
    if (narrationText !== NARRATION[id]) throw new Error(`${id}: voice cues differ from NARRATION`)
    const generationUnitIds = takes.map((cue, cueIndex) => {
      const unitId = `${id}-${String(cueIndex + 1).padStart(2, '0')}`
      if (!cue.text || cue.text.length > 2048) throw new Error(`${unitId}: text is empty or exceeds 2048 characters`)
      generationUnits.push({
        id: unitId,
        sceneId: id,
        cueIndex,
        role: cue.role,
        ...(cue.action ? { action: cue.action } : {}),
        text: cue.text,
        characterCount: cue.text.length,
        source,
      })
      return unitId
    })
    return {
      id,
      kind: scene.kind,
      name: scene.name,
      citation: scene.kind === 'scripture' || scene.kind === 'mixed' ? scene.citation :
        scene.kind === 'exhortation' ? 'Not Scripture' :
          id === 'measure' ? 'NASA / ESA Planck | not Scripture' : 'Not Scripture',
      source,
      narrationText,
      characterCount: narrationText.length,
      generationUnitIds,
    }
  }
  const scenes = SCENES.map(buildScene)
  const trailer = buildScene({ id: 'trailer', kind: 'mixed', name: 'Trailer', citation: 'Genesis excerpts and authored invitation' })
  const max = Math.max(...generationUnits.map((unit) => unit.characterCount))
  return {
    schemaVersion: 2,
    purpose: 'Exact ordered public transcript and one voice-generation input per cue.',
    generationReady: true,
    sourceFiles: hashes,
    sourceVerification: {
      version: 'King James Version',
      urls: [
        'https://www.biblegateway.com/passage/?search=Genesis+1%3A6-13&version=KJV',
        'https://www.biblegateway.com/passage/?search=Genesis+1%3A14-23&version=KJV',
        'https://www.biblegateway.com/passage/?search=Genesis+1%3A24-31&version=KJV',
        'https://www.biblegateway.com/passage/?search=Genesis+2&version=KJV',
        'https://www.biblegateway.com/passage/?search=Genesis+3&version=KJV',
      ],
    },
    limits: { seedAudioMaxInputCharacters: 2048, longestUnitCharacters: max },
    audioTiming: 'Measure cue offsets from each new recording before replacing published audio.',
    editorialNotes: [
      'Day 6 narration selects Genesis 1:24–27 and 1:31; it does not voice verses 28–30.',
      'Closing, doubt, and measure are authored prose, not Scripture. Trailer mixes KJV excerpts with authored invitation.',
    ],
    scenes,
    trailer,
    generationUnits,
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length > 2 || (args[0] && args[0] !== '--output') || (args[0] === '--output' && !args[1])) {
    throw new Error('Usage: node scripts/prepare-higgsfield-narration.mjs [--output path]')
  }
  const output = path.resolve(args[1] ?? defaultOutput)
  if (output === boundManifest) throw new Error('Refusing to overwrite the bound narration manifest')
  const manifest = await prepareNarrationManifest()
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${manifest.generationUnits.length} ordered voice units to ${output}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
