#!/usr/bin/env node
/**
 * Generate narration mp3s with ElevenLabs.
 * Requires ELEVENLABS_API_KEY in .env.local. Never prints the key.
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'audio')
const sampleDir = path.join(root, 'demo', 'voice-tests')

const VOICES = {
  george: 'JBFqnCBsd6RMkjVDRZzb',
  adam: 'pNInz6obpgDQGcFmaJgB',
  brian: 'nPczCjzI2devNBz1zQrb',
}

/** Keep in sync with src/genesis/script.ts */
const NARRATION = {
  beginning:
    'In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep.',
  day1: 'And God said, Let there be light: and there was light. And God saw the light, that it was good.',
  day2: 'And God said, Let there be a firmament in the midst of the waters. And God called the firmament Heaven.',
  day3: 'And God said, Let the waters under the heaven be gathered together unto one place, and let the dry land appear: and it was so. And God said, Let the earth bring forth grass. And God saw that it was good.',
  day4: 'And God made two great lights; the greater light to rule the day, and the lesser light to rule the night: he made the stars also. And God saw that it was good.',
  day5: 'And God said, Let the waters bring forth abundantly the moving creature that hath life, and fowl that may fly above the earth. And God saw that it was good.',
  day6:
    'And God said, Let us make man in our image, after our likeness. So God created man in his own image, in the image of God created he him; male and female created he them. And God saw every thing that he had made, and, behold, it was very good.',
  day7: 'And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made. And God blessed the seventh day, and sanctified it.',
  garden:
    'And the Lord God planted a garden eastward in Eden; and there he put the man whom he had formed. And the Lord God commanded the man, saying, Of every tree of the garden thou mayest freely eat: but of the tree of the knowledge of good and evil, thou shalt not eat of it.',
  fall: 'Now the serpent was more subtil than any beast of the field. And the serpent said unto the woman, Ye shall not surely die. And when the woman saw that the tree was good for food, she took of the fruit thereof, and did eat. Therefore the Lord God sent him forth from the garden of Eden.',
  closing:
    'This is a visual meditation on Genesis, not a documentary. Go to church. Hear the Word. Live for Jesus Christ.',
  doubt: 'Got doubt?',
  measure:
    'Physicists describe an expanding universe, and a faint microwave glow left from early light. That is what we can measure. It does not replace the Word. Read the NASA and Planck pages. Then go to church.',
  trailer:
    'In the beginning God created the heaven and the earth. And God said, Let there be light: and there was light. And God saw every thing that he had made, and, behold, it was very good. And the serpent said unto the woman, Ye shall not surely die. And she took of the fruit thereof, and did eat. Go to church. Live for Jesus Christ. Got doubt?',
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

async function tts(apiKey, voiceId, text) {
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

async function soften(input, output) {
  try {
    await run('ffmpeg', [
      '-y',
      '-i',
      input,
      '-af',
      'aecho=0.8:0.9:40:0.12,loudnorm=I=-16:LRA=11:TP=-1.5',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      output,
    ])
    return true
  } catch {
    await writeFile(output, await readFile(input))
    return false
  }
}

async function main() {
  const local = loadEnvLocal(await readFile(path.join(root, '.env.local'), 'utf8'))
  const apiKey = process.env.ELEVENLABS_API_KEY || local.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY in .env.local')
  }
  const chosen =
    process.env.ELEVENLABS_VOICE_ID || local.ELEVENLABS_VOICE_ID || VOICES.george
  await mkdir(outDir, { recursive: true })
  const runVoices = process.argv.includes('--voices')
  if (runVoices) {
    await mkdir(sampleDir, { recursive: true })
    const probe = NARRATION.day1
    for (const [name, id] of Object.entries(VOICES)) {
      const raw = path.join(sampleDir, `${name}-raw.mp3`)
      const out = path.join(sampleDir, `${name}.mp3`)
      await writeFile(raw, await tts(apiKey, id, probe))
      await soften(raw, out)
      console.log(`wrote voice test ${name}`)
    }
  }

  const tmp = path.join(outDir, '.tmp.mp3')
  const pending = Object.entries(NARRATION).sort((a, b) => a[1].length - b[1].length)
  for (const [id, text] of pending) {
    const dest = path.join(outDir, `${id}.mp3`)
    try {
      await access(dest)
      console.log(`skip ${id}.mp3 (exists)`)
      continue
    } catch {
      // generate
    }
    await writeFile(tmp, await tts(apiKey, chosen, text))
    const softened = await soften(tmp, dest)
    console.log(`wrote ${id}.mp3${softened ? '' : ' (no ffmpeg soften)'}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
