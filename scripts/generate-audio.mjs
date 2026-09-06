#!/usr/bin/env node
/**
 * Generate reverent, role-aware narration. Never prints provider keys.
 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, access, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mpegDurationSeconds } from '../src/genesis/mpegDuration.ts'
import { NARRATION, SCENE_VOICE_CUES } from '../src/genesis/script.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'audio')
const sampleDir = path.join(root, 'demo', 'voice-tests')

const VOICES = {
  george: 'JBFqnCBsd6RMkjVDRZzb',
  adam: 'pNInz6obpgDQGcFmaJgB',
  brian: 'nPczCjzI2devNBz1zQrb',
}

const VOICE_PROFILES = {
  narrator: { oneMin: 'echo', speed: 0.96, eleven: VOICES.george },
  god: { oneMin: 'onyx', speed: 0.94, eleven: VOICES.george },
  serpent: { oneMin: 'echo', speed: 0.94, eleven: VOICES.brian },
  woman: { oneMin: 'nova', speed: 0.94, eleven: VOICES.george },
  man: { oneMin: 'echo', speed: 0.9, eleven: VOICES.adam },
}

function loadEnvLocal(text) {
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function ttsEleven(apiKey, voiceId, text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.72,
        similarity_boost: 0.7,
        style: 0.12,
        use_speaker_boost: true,
      },
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`ElevenLabs ${response.status}: ${body.slice(0, 240)}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function assetUrl(result) {
  if (typeof result === 'string' && result.startsWith('http')) return result
  if (typeof result === 'string') return `https://s3.us-east-1.amazonaws.com/asset.1min.ai/${result}`
  return null
}

async function ttsOneMin(apiKey, text, profile) {
  const response = await fetch('https://api.1min.ai/api/features', {
    method: 'POST',
    headers: {
      'API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'TEXT_TO_SPEECH',
      model: 'tts-1-hd',
      conversationId: 'TEXT_TO_SPEECH',
      promptObject: {
        text,
        voice: profile.oneMin,
        response_format: 'mp3',
        speed: profile.speed,
      },
    }),
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`1min.ai ${response.status}: ${raw.slice(0, 240)}`)
  }
  const payload = JSON.parse(raw)
  const record = payload.aiRecord
  const href =
    record?.temporaryUrl ||
    assetUrl(record?.aiRecordDetail?.resultObject?.[0])
  if (!href) {
    throw new Error('1min.ai returned no audio URL')
  }
  const audio = await fetch(href)
  if (!audio.ok) {
    throw new Error(`1min.ai asset ${audio.status}`)
  }
  return Buffer.from(await audio.arrayBuffer())
}

function assertMpegAudio(buffer, label) {
  const id3 = buffer.subarray(0, 3).toString('ascii') === 'ID3'
  const frame = buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0
  if (buffer.byteLength < 8_000 || (!id3 && !frame)) {
    throw new Error(`${label} returned invalid MPEG audio`)
  }
  return buffer
}

async function tts(env, text, role = 'narrator') {
  const profile = VOICE_PROFILES[role]
  if (!profile) throw new Error(`Unknown voice role: ${role}`)
  const oneMin = process.env.ONE_MIN_AI_API_KEY || env.ONE_MIN_AI_API_KEY
  if (oneMin) return assertMpegAudio(await ttsOneMin(oneMin, text, profile), `1min.ai ${role}`)
  const eleven = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY
  const voice = process.env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_VOICE_ID || profile.eleven
  if (eleven) return assertMpegAudio(await ttsEleven(eleven, voice, text), `ElevenLabs ${role}`)
  throw new Error('Missing ONE_MIN_AI_API_KEY or ELEVENLABS_API_KEY in .env.local')
}

async function compositeCues(env, id, cues, dest) {
  const cueDir = path.join(root, 'demo', 'audio-cache', id)
  await mkdir(cueDir, { recursive: true })
  const parts = []
  const timings = []
  let elapsed = 0
  for (const [index, cue] of cues.entries()) {
    const prefix = String(index + 1).padStart(2, '0')
    const raw = path.join(cueDir, `${prefix}-${cue.role}-raw.mp3`)
    const part = path.join(cueDir, `${prefix}-${cue.role}.wav`)
    await cachedVoice(env, cue.text, cue.role, raw)
    await soften(raw, part, cue.role)
    parts.push(part)
    const duration = Number(await runCapture('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', part]))
    timings.push({ ...cue, start: elapsed, end: elapsed + duration })
    elapsed += duration
    console.log(`wrote ${id} cue ${prefix} (${cue.role})`)
  }
  const list = path.join(cueDir, 'concat.txt')
  await writeFile(list, parts.map((part) => `file '${part.replaceAll("'", "'\\''")}'`).join('\n'))
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '192k', dest])
  await writeFile(path.join(cueDir, 'timing.json'), JSON.stringify(timings))
  // Retain paid source audio so interrupted runs can resume without another charge.
}

function runCapture(cmd, args, stderr = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', stderr ? 'pipe' : 'ignore'] })
    let stdout = ''
    const stream = stderr ? child.stderr : child.stdout
    stream.on('data', (chunk) => { stdout += chunk })
    child.on('exit', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${cmd} exited ${code}`)))
    child.on('error', reject)
  })
}

async function refreshDurations() {
  const timingPath = path.join(root, 'src', 'genesis', 'sceneTiming.ts')
  let source = await readFile(timingPath, 'utf8')
  for (const id of Object.keys(SCENE_VOICE_CUES).concat(Object.keys(NARRATION))) {
    if (id === 'trailer' || !NARRATION[id]) continue
    const file = path.join(outDir, `${id}.mp3`)
    try {
      await access(file)
    } catch {
      continue
    }
    const raw = await runCapture('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
    const duration = Math.max(Number(raw), mpegDurationSeconds(new Uint8Array(await readFile(file))))
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid duration for ${id}.mp3`)
    source = source.replace(new RegExp(`(\\s${id}: )\\d+(?:\\.\\d+)?(,)`), `$1${duration.toFixed(3)}$2`)
  }
  await writeFile(timingPath, source)
  const manifest = {}
  for (const id of Object.keys(NARRATION).filter((id) => id !== 'trailer')) {
    if (SCENE_VOICE_CUES[id]) {
      try { manifest[id] = JSON.parse(await readFile(path.join(root, 'demo', 'audio-cache', id, 'timing.json'), 'utf8')) } catch { continue }
    } else {
      const seconds = Number(await runCapture('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path.join(outDir, `${id}.mp3`)]))
      manifest[id] = [{ role: 'narrator', text: NARRATION[id], start: 0, end: seconds }]
    }
  }
  await writeFile(path.join(root, 'src', 'genesis', 'audioCues.ts'), '// Generated from the exact mastered cue files. Do not estimate these offsets.\nexport const AUDIO_CUES = ' + JSON.stringify(manifest, null, 2) + ' as const\n')
  console.log('refreshed scene audio durations and cue offsets')
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code}`))
    })
    child.on('error', reject)
  })
}

async function cachedVoice(env, text, role, dest) {
  const profile = VOICE_PROFILES[role]
  const hash = createHash('sha256').update(JSON.stringify({ text, profile, model: 'tts-1-hd' })).digest('hex')
  const cache = path.join(root, 'demo', 'audio-cache', `${hash}.mp3`)
  await mkdir(path.dirname(cache), { recursive: true })
  let bytes
  try { bytes = assertMpegAudio(await readFile(cache), role) }
  catch {
    bytes = await tts(env, text, role)
    await writeFile(cache, bytes)
  }
  await writeFile(dest, bytes)
}

async function soften(input, output) {
  // Two-pass mastering keeps levels stable without a reverberant tail on every word.
  const clean = 'highpass=f=65,lowpass=f=14500,acompressor=threshold=0.125:ratio=2:attack=10:release=100'
  const report = await runCapture('ffmpeg', ['-hide_banner', '-i', input, '-af',
    `${clean},loudnorm=I=-16:LRA=9:TP=-1.5:print_format=json`, '-f', 'null', '-'], true)
  const match = report.match(/\{\s*"input_i"[\s\S]*?\}/)
  if (!match) throw new Error('Audio loudness measurement failed')
  const measured = JSON.parse(match[0])
  const normalize = `loudnorm=I=-16:LRA=9:TP=-1.5:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
  await run('ffmpeg', ['-y', '-i', input, '-af', `${clean},${normalize}`,
    '-ar', '48000', ...(output.endsWith('.wav') ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', '192k']), output])
  return true
}

async function main() {
  const local = loadEnvLocal(await readFile(path.join(root, '.env.local'), 'utf8'))
  await mkdir(outDir, { recursive: true })
  if (process.argv.includes('--timing-only')) { await refreshDurations(); return }
  if (process.argv.includes('--sample')) {
    await mkdir(sampleDir, { recursive: true })
    const raw = path.join(sampleDir, '1min-narrator-raw.mp3')
    await cachedVoice(local, NARRATION.day1, 'narrator', raw)
    await soften(raw, path.join(sampleDir, '1min-narrator.mp3'))
    console.log('1min.ai sample ready in demo/voice-tests/1min-narrator.mp3')
    return
  }
  const runVoices = process.argv.includes('--voices')
  if (runVoices) {
    const eleven = process.env.ELEVENLABS_API_KEY || local.ELEVENLABS_API_KEY
    if (!eleven) throw new Error('Voice A/B needs ELEVENLABS_API_KEY')
    await mkdir(sampleDir, { recursive: true })
    const probe = NARRATION.day1
    for (const [name, id] of Object.entries(VOICES)) {
      const raw = path.join(sampleDir, `${name}-raw.mp3`)
      const out = path.join(sampleDir, `${name}.mp3`)
      await writeFile(raw, await ttsEleven(eleven, id, probe))
      await soften(raw, out)
      console.log(`wrote voice test ${name}`)
    }
  }

  const wanted = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('-')))
  const force = process.argv.includes('--force')
  const staging = path.join(root, 'demo', 'audio-staging')
  await mkdir(staging, { recursive: true })
  const tmp = path.join(staging, 'raw.mp3')
  const pending = Object.entries(NARRATION).sort((a, b) => a[1].length - b[1].length)
  for (const [id, text] of pending) {
    if (wanted.size > 0 && !wanted.has(id)) continue
    const dest = path.join(outDir, `${id}.mp3`)
    try {
      await access(dest)
      if (!force) {
        console.log(`skip ${id}.mp3 (exists)`)
        continue
      }
    } catch {
      // generate
    }
    const cues = SCENE_VOICE_CUES[id]
    if (cues) {
      const staged = path.join(staging, `${id}.mp3`)
      await compositeCues(local, id, cues, staged)
      await rename(staged, dest)
      console.log(`wrote ${id}.mp3 (${[...new Set(cues.map((cue) => cue.role))].join(' + ')})`)
      continue
    }
    await cachedVoice(local, text, 'narrator', tmp)
    const staged = path.join(staging, `${id}.mp3`)
    const softened = await soften(tmp, staged)
    await rename(staged, dest)
    console.log(`wrote ${id}.mp3${softened ? '' : ' (no ffmpeg soften)'}`)
  }
  await refreshDurations()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
