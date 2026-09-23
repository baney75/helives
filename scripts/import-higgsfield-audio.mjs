#!/usr/bin/env node
/** Import paid, source-bound Higgsfield takes without regenerating them. */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, rename, copyFile, rm, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mpegDurationSeconds } from '../src/genesis/mpegDuration.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const taskDir = path.join(root, 'demo', '2d-refresh')
const stageRoot = path.join(root, 'demo', 'audio-staging', 'higgsfield-2d')
const manifestPath = path.join(taskDir, 'narration-manifest.json')
const jobsPath = path.join(taskDir, 'voice-jobs.json')
const bindingsPath = path.join(taskDir, 'submission-bindings.json')
const submittedPath = path.join(taskDir, 'submitted-units.json')
const overridesPath = path.join(taskDir, 'pronunciation-overrides.json')
const sceneTimingPath = path.join(root, 'src', 'genesis', 'sceneTiming.ts')
const audioCuesPath = path.join(root, 'src', 'genesis', 'audioCues.ts')
const maxDownloadBytes = 32 * 1024 * 1024
const sceneIds = [
  'beginning', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7',
  'garden', 'fall', 'closing', 'doubt', 'measure',
]

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const textHash = (value) => sha256(Buffer.from(value, 'utf8'))
const byIndex = (rows) => new Map(rows.map((row) => [row.index ?? row.i, row]))

async function readJson(file) {
  // The ledger is written by another process during generation.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { return JSON.parse(await readFile(file, 'utf8')) }
    catch (error) {
      if (attempt === 3) throw new Error(`Cannot read ${path.basename(file)}: ${error.message}`, { cause: error })
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}

function exactIndexes(rows, count, label) {
  const seen = new Set()
  for (const [position, row] of rows.entries()) {
    const index = row.index ?? row.i
    if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) {
      throw new Error(`${label} has an invalid or duplicate index at row ${position}`)
    }
    seen.add(index)
  }
  return seen
}

function validateUrl(value) {
  if (typeof value !== 'string') throw new Error('Completed job is missing its result URL')
  let url
  try { url = new URL(value) } catch { throw new Error('Completed job has an invalid result URL') }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.hostname === 'localhost' || url.hostname.endsWith('.local') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(':')) {
    throw new Error('Completed job result URL must use a public HTTPS host')
  }
  return url
}

export function validateInputs(manifest, manifestBytes, bindings, submitted, jobs, sourceHashes) {
  if (manifest.schemaVersion !== 2 || !manifest.generationReady ||
      manifest.scenes?.length !== sceneIds.length || !Array.isArray(manifest.generationUnits) ||
      manifest.generationUnits.length !== 44) throw new Error('Manifest coverage or version is invalid')
  const manifestSha256 = sha256(manifestBytes)
  if (bindings?.manifestSha256 !== manifestSha256 || !Array.isArray(bindings.units) ||
      bindings.units.length !== manifest.generationUnits.length) throw new Error('Submission binding does not match this manifest')
  if (!Array.isArray(submitted) || submitted.length !== manifest.generationUnits.length || !Array.isArray(jobs)) {
    throw new Error('Submitted inputs or job ledger is incomplete')
  }
  exactIndexes(bindings.units, 44, 'Submission binding')
  exactIndexes(submitted, 44, 'Submitted input')
  exactIndexes(jobs, 44, 'Job ledger')
  for (const [file, expected] of Object.entries(manifest.sourceFiles ?? {})) {
    if (sourceHashes[file] !== expected) throw new Error(`Manifest source changed: ${file}`)
  }
  const bound = byIndex(bindings.units)
  const sent = byIndex(submitted)
  const ledger = byIndex(jobs)
  const jobIds = new Set()
  for (const [index, unit] of manifest.generationUnits.entries()) {
    const binding = bound.get(index)
    const input = sent.get(index)
    if (unit.id !== binding.id || unit.id !== input.id || unit.text !== input.text ||
        unit.characterCount !== unit.text.length || unit.characterCount > 2048 ||
        binding.textSha256 !== textHash(unit.text)) {
      throw new Error(`Submitted text or binding differs from manifest at index ${index}`)
    }
    const job = ledger.get(index)
    if (!job) continue
    if (typeof job.job_id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(job.job_id) || jobIds.has(job.job_id)) {
      throw new Error(`Invalid or duplicate job ID at index ${index}`)
    }
    jobIds.add(job.job_id)
    if (job.status === 'completed') validateUrl(job.result_url)
  }
  for (const scene of [...manifest.scenes, manifest.trailer]) {
    const texts = scene.generationUnitIds.map((id) => manifest.generationUnits.find((unit) => unit.id === id)?.text)
    if (texts.some((text) => text === undefined) || texts.join(' ') !== scene.narrationText) {
      throw new Error(`Manifest cue order differs from scene transcript: ${scene.id}`)
    }
  }
  const completed = jobs.filter((job) => job.status === 'completed').length
  const failed = jobs.filter((job) => job.status === 'submission_failed' || job.status === 'failed').length
  return { manifestSha256, completed, failed, missing: 44 - jobs.length, pending: jobs.length - completed - failed, jobsByIndex: ledger }
}

async function loadInputs() {
  const manifestBytes = await readFile(manifestPath)
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  const [bindings, submitted, jobs] = await Promise.all([
    readJson(bindingsPath), readJson(submittedPath), readJson(jobsPath),
  ])
  const sourceHashes = Object.fromEntries(await Promise.all(
    Object.keys(manifest.sourceFiles ?? {}).map(async (file) => {
      if (!file.startsWith('src/genesis/') || file.includes('..')) throw new Error('Unsafe source path in manifest')
      return [file, sha256(await readFile(path.join(root, file)))]
    }),
  ))
  let overrides = []
  try { overrides = JSON.parse(await readFile(overridesPath, 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const pronunciation = validatePronunciationOverrides(overrides, manifest, jobs)
  return { manifest, jobs, pronunciation, ...validateInputs(manifest, manifestBytes, bindings, submitted, jobs, sourceHashes) }
}

/** One reviewed phonetic alias; the published Scripture and captions remain exact KJV. */
export function validatePronunciationOverrides(overrides, manifest, jobs) {
  if (!Array.isArray(overrides) || overrides.length > 1) throw new Error('Unknown pronunciation override')
  const result = new Map()
  for (const override of overrides) {
    const unit = manifest.generationUnits[override.index]
    if (override.index !== 26 || unit?.id !== 'fall-03' || override.canonicalText !== unit.text ||
        override.synthesisText !== unit.text.replace(/\bye\b/g, 'yee') || !override.reason ||
        override.job_id !== jobs.find((job) => job.index === override.index)?.job_id) {
      throw new Error('Pronunciation override differs from reviewed alias or job')
    }
    result.set(override.index, override)
  }
  return result
}

async function run(command, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', capture ? 'pipe' : 'ignore', capture ? 'pipe' : 'ignore'] })
    let output = ''
    if (capture) {
      child.stdout.on('data', (chunk) => { output += chunk })
      child.stderr.on('data', (chunk) => { output += chunk })
    }
    child.on('error', () => reject(new Error(`${command} is unavailable`)))
    child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`${command} failed with exit ${code}`)))
  })
}

async function probe(file) {
  const raw = await run('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_name,sample_rate,channels,duration_ts,time_base,duration:format=duration',
    '-of', 'json', file], true)
  const data = JSON.parse(raw)
  const stream = data.streams?.find((item) => item.codec_name && item.codec_name !== 'attached_pic')
  const duration = Number(data.format?.duration ?? stream?.duration)
  if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > 3600) {
    throw new Error(`Invalid audio stream in ${path.basename(file)}`)
  }
  return { stream, duration }
}

async function fetchAudio(value, label) {
  let url = validateUrl(value)
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(120_000) })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === 4) throw new Error(`${label} exceeded redirect limit`)
      const location = response.headers.get('location')
      if (!location) throw new Error(`${label} redirect is missing a location`)
      url = validateUrl(new URL(location, url).href)
      continue
    }
    if (!response.ok || !response.body) throw new Error(`${label} download failed with HTTP ${response.status}`)
    const announced = Number(response.headers.get('content-length'))
    if (announced > maxDownloadBytes) throw new Error(`${label} exceeds source size limit`)
    const chunks = []
    let length = 0
    for await (const chunk of response.body) {
      length += chunk.length
      if (length > maxDownloadBytes) throw new Error(`${label} exceeds source size limit`)
      chunks.push(chunk)
    }
    if (length < 8_000) throw new Error(`${label} source is too small to be narration`)
    return Buffer.concat(chunks)
  }
  throw new Error(`${label} could not be downloaded`)
}

async function ensureSource(unit, job, rawDir) {
  const file = path.join(rawDir, `${unit.id}-${job.job_id}.mp3`)
  const receipt = `${file}.sha256`
  try {
    const [bytes, expected] = await Promise.all([readFile(file), readFile(receipt, 'utf8')])
    if (sha256(bytes) === expected.trim()) { await probe(file); return { file, sha256: expected.trim() } }
  } catch { /* Fetch the same paid result again; never submit a new generation. */ }
  const bytes = await fetchAudio(job.result_url, unit.id)
  const temp = `${file}.partial`
  await writeFile(temp, bytes)
  try {
    const checked = await probe(temp)
    if (checked.stream.codec_name !== 'mp3') throw new Error(`${unit.id} result is not MP3 audio`)
    await rename(temp, file)
  } catch (error) { await rm(temp, { force: true }); throw error }
  const digest = sha256(bytes)
  await writeFile(receipt, `${digest}\n`)
  return { file, sha256: digest }
}

async function normalize(input, output) {
  const clean = 'highpass=f=65,lowpass=f=14500,acompressor=threshold=0.125:ratio=2:attack=10:release=100'
  const report = await run('ffmpeg', ['-hide_banner', '-i', input, '-af',
    `${clean},loudnorm=I=-16:LRA=9:TP=-1.5:print_format=json`, '-f', 'null', '-'], true)
  const measured = report.match(/\{\s*"input_i"[\s\S]*?\}/)
  if (!measured) throw new Error(`Cannot measure loudness for ${path.basename(input)}`)
  const value = JSON.parse(measured[0])
  const filter = `loudnorm=I=-16:LRA=9:TP=-1.5:measured_I=${value.input_i}:measured_LRA=${value.input_lra}:measured_TP=${value.input_tp}:measured_thresh=${value.input_thresh}:offset=${value.target_offset}:linear=true`
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-af', `${clean},${filter}`,
    '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', output])
  const checked = await probe(output)
  if (checked.stream.codec_name !== 'pcm_s16le' || checked.stream.sample_rate !== '44100' || checked.stream.channels !== 1) {
    throw new Error(`Normalized cue has wrong format: ${path.basename(output)}`)
  }
  const samples = Number(checked.stream.duration_ts)
  if (!Number.isInteger(samples) || samples <= 0 || checked.stream.time_base !== '1/44100') {
    throw new Error(`Cannot measure exact cue samples: ${path.basename(output)}`)
  }
  return samples
}

function concatPath(file) { return `file '${file.replaceAll("'", "'\\''")}'` }

async function makeMaster(scene, units, normalizedDir, mastersDir) {
  const paths = units.map((unit) => path.join(normalizedDir, `${unit.id}.wav`))
  const list = path.join(mastersDir, `${scene.id}.concat.txt`)
  await writeFile(list, `${paths.map(concatPath).join('\n')}\n`)
  const output = path.join(mastersDir, `${scene.id}.mp3`)
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', output])
  const checked = await probe(output)
  if (checked.stream.codec_name !== 'mp3' || checked.stream.sample_rate !== '44100' || checked.stream.channels !== 1) {
    throw new Error(`Master has wrong format: ${scene.id}`)
  }
  const bytes = await readFile(output)
  if (bytes.length < 8_000) throw new Error(`Master is too small: ${scene.id}`)
  return { output, sha256: sha256(bytes), duration: checked.duration, mpegDuration: mpegDurationSeconds(new Uint8Array(bytes)) }
}

function renderAudioCues(manifest, sampleCounts) {
  const result = {}
  for (const scene of manifest.scenes) {
    let totalSamples = 0
    result[scene.id] = scene.generationUnitIds.map((id) => {
      const unit = manifest.generationUnits.find((item) => item.id === id)
      const start = totalSamples / 44100
      totalSamples += sampleCounts[id]
      return { role: unit.role, ...(unit.action ? { action: unit.action } : {}), text: unit.text,
        start: Number(start.toFixed(6)), end: Number((totalSamples / 44100).toFixed(6)) }
    })
  }
  return '// Measured from the normalized 44.1 kHz cue files assembled by import-higgsfield-audio.mjs.\n' +
    `export const AUDIO_CUES = ${JSON.stringify(result, null, 2)} as const\n`
}

function renderSceneTiming(original, durations) {
  const block = original.match(/export const SCENE_AUDIO_SECONDS:[\s\S]*?= \{[\s\S]*?\n\}/)
  if (!block) throw new Error('Cannot locate SCENE_AUDIO_SECONDS block')
  let updated = block[0]
  for (const id of sceneIds) {
    const duration = durations[id]
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`No measured duration for ${id}`)
    const pattern = new RegExp(`(^\\s*${id}: )\\d+(?:\\.\\d+)?(,)`, 'm')
    if (!pattern.test(updated)) throw new Error(`No timing entry for ${id}`)
    updated = updated.replace(pattern, (_match, before, after) =>
      `${before}${(Math.ceil((duration + 0.024) * 1000) / 1000).toFixed(3)}${after}`)
  }
  return original.replace(block[0], updated)
}

async function stage(inputs) {
  const { manifest, jobsByIndex, manifestSha256, completed, failed, missing, pending } = inputs
  if (completed !== 44 || failed || missing || pending) throw new Error(`Staging needs all 44 completed unique jobs; currently ${completed} completed, ${pending} pending, ${failed} failed, ${missing} missing`)
  const dir = path.join(stageRoot, manifestSha256.slice(0, 16))
  const rawDir = path.join(dir, 'source-clips')
  const normalizedDir = path.join(dir, 'normalized-cues')
  const mastersDir = path.join(dir, 'masters')
  await Promise.all([mkdir(rawDir, { recursive: true }), mkdir(normalizedDir, { recursive: true }), mkdir(mastersDir, { recursive: true })])
  const sources = []
  const sampleCounts = {}
  for (const [index, unit] of manifest.generationUnits.entries()) {
    const job = jobsByIndex.get(index)
    const source = await ensureSource(unit, job, rawDir)
    const normalized = path.join(normalizedDir, `${unit.id}.wav`)
    sampleCounts[unit.id] = await normalize(source.file, normalized)
    const pronunciation = inputs.pronunciation.get(index)
    sources.push({ index, unitId: unit.id, jobId: job.job_id, textSha256: textHash(unit.text),
      synthesisTextSha256: textHash(pronunciation?.synthesisText ?? unit.text),
      ...(pronunciation ? { pronunciation: { reason: pronunciation.reason, synthesisText: pronunciation.synthesisText } } : {}),
      sourceSha256: source.sha256 })
    console.log(`Staged cue ${index + 1}/44: ${unit.id}`)
  }
  const masters = {}
  for (const scene of [...manifest.scenes, manifest.trailer]) {
    const units = scene.generationUnitIds.map((id) => manifest.generationUnits.find((unit) => unit.id === id))
    const master = await makeMaster(scene, units, normalizedDir, mastersDir)
    const cueSeconds = scene.generationUnitIds.reduce((total, id) => total + sampleCounts[id], 0) / 44100
    if (Math.abs(master.duration - cueSeconds) > 0.1) throw new Error(`Master duration differs from cue assembly: ${scene.id}`)
    masters[scene.id] = { sha256: master.sha256, duration: Math.max(master.duration, master.mpegDuration), cueSeconds }
  }
  const audioCues = renderAudioCues(manifest, sampleCounts)
  const timing = renderSceneTiming(await readFile(sceneTimingPath, 'utf8'), Object.fromEntries(sceneIds.map((id) => [id, masters[id].duration])))
  await writeFile(path.join(dir, 'audioCues.ts'), audioCues)
  await writeFile(path.join(dir, 'sceneTiming.ts'), timing)
  const receipt = { manifestSha256, sources, masters,
    outputHashes: { audioCues: textHash(audioCues), sceneTiming: textHash(timing) } }
  await writeFile(path.join(dir, 'stage.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(`Staged 44 cues and 14 masters in ${dir}`)
}

async function promote(inputs) {
  const { manifestSha256, manifest, jobsByIndex, completed, failed, missing, pending } = inputs
  if (completed !== 44 || failed || missing || pending) throw new Error('Promotion needs all 44 completed jobs')
  const dir = path.join(stageRoot, manifestSha256.slice(0, 16))
  const receipt = await readJson(path.join(dir, 'stage.json'))
  if (receipt.manifestSha256 !== manifestSha256 || receipt.sources?.length !== 44) throw new Error('Stage receipt differs from manifest')
  for (const [index, unit] of manifest.generationUnits.entries()) {
    const source = receipt.sources[index]
    if (source.index !== index || source.unitId !== unit.id || source.jobId !== jobsByIndex.get(index)?.job_id ||
        source.textSha256 !== textHash(unit.text) ||
        source.synthesisTextSha256 !== textHash(inputs.pronunciation.get(index)?.synthesisText ?? unit.text)) throw new Error(`Staged job binding changed at index ${index}`)
    const raw = path.join(dir, 'source-clips', `${unit.id}-${source.jobId}.mp3`)
    if (sha256(await readFile(raw)) !== source.sourceSha256) throw new Error(`Source clip changed: ${unit.id}`)
  }
  const targets = []
  for (const id of [...sceneIds, 'trailer']) {
    const staged = path.join(dir, 'masters', `${id}.mp3`)
    if (sha256(await readFile(staged)) !== receipt.masters?.[id]?.sha256) throw new Error(`Master changed: ${id}`)
    await probe(staged)
    targets.push({ staged, live: path.join(root, 'public', 'audio', `${id}.mp3`) })
  }
  for (const [file, digest] of [['audioCues.ts', receipt.outputHashes?.audioCues], ['sceneTiming.ts', receipt.outputHashes?.sceneTiming]]) {
    if (textHash(await readFile(path.join(dir, file), 'utf8')) !== digest) throw new Error(`Staged source changed: ${file}`)
  }
  targets.push({ staged: path.join(dir, 'audioCues.ts'), live: audioCuesPath })
  targets.push({ staged: path.join(dir, 'sceneTiming.ts'), live: sceneTimingPath })
  const backup = path.join(dir, `baseline-${new Date().toISOString().replaceAll(':', '-')}`)
  await mkdir(backup, { recursive: true })
  const originals = []
  for (const [index, target] of targets.entries()) {
    const saved = path.join(backup, `${String(index).padStart(2, '0')}-${path.basename(target.live)}`)
    try { await access(target.live) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      originals.push(null)
      continue
    }
    await copyFile(target.live, saved)
    originals.push(saved)
  }
  const changed = []
  try {
    for (const target of targets) {
      const temp = `${target.live}.higgsfield-new`
      await copyFile(target.staged, temp)
      await rename(temp, target.live)
      changed.push(target)
    }
  } catch (error) {
    for (const [index, target] of targets.entries()) {
      if (!changed.includes(target)) continue
      if (originals[index]) await copyFile(originals[index], target.live)
      else await rm(target.live, { force: true })
    }
    throw error
  }
  await writeFile(path.join(backup, 'promotion.json'), `${JSON.stringify({ manifestSha256, promotedAt: new Date().toISOString(), files: targets.map((item) => path.relative(root, item.live)) }, null, 2)}\n`)
  console.log(`Promoted 14 masters and timed cues; baseline preserved in ${backup}`)
}

async function main() {
  const command = process.argv[2] ?? 'dry-run'
  if (!['dry-run', 'stage', 'promote'].includes(command)) {
    throw new Error('Usage: node scripts/import-higgsfield-audio.mjs [dry-run|stage|promote]')
  }
  const inputs = await loadInputs()
  console.log(`Binding ${inputs.manifestSha256.slice(0, 16)}: ${inputs.completed}/44 completed, ${inputs.pending} pending, ${inputs.failed} failed, ${inputs.missing} missing`)
  if (command === 'stage') await stage(inputs)
  if (command === 'promote') await promote(inputs)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
