/**
 * MPEG duration from a local mp3 buffer. Used so scene seconds stay ≥ the file.
 * Prefers Xing/Info frame count; falls back to CBR from the first frame header.
 */
const BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
const SAMPLE_V1 = [44100, 48000, 32000]
const SAMPLE_V2 = [22050, 24000, 16000]

export function mpegDurationSeconds(bytes: Uint8Array): number {
  const frame = firstMpegFrame(bytes)
  if (frame < 0) return 0
  const header = readFrameHeader(bytes, frame)
  if (!header) return 0
  const xing = findTag(bytes, frame, header.channelMode === 3 ? 21 : 36)
  if (xing >= 0) {
    const flags = readU32(bytes, xing + 4)
    if (flags & 1) {
      const frames = readU32(bytes, xing + 8)
      if (frames > 0 && header.sampleRate > 0) {
        return (frames * header.samplesPerFrame) / header.sampleRate
      }
    }
  }
  if (header.bitrate <= 0) return 0
  return ((bytes.length - frame) * 8) / header.bitrate
}

function firstMpegFrame(bytes: Uint8Array): number {
  let offset = 0
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = ((bytes[6] ?? 0) << 21) | ((bytes[7] ?? 0) << 14) | ((bytes[8] ?? 0) << 7) | (bytes[9] ?? 0)
    offset = 10 + size
  }
  for (let i = offset; i < bytes.length - 4; i += 1) {
    if (bytes[i] === 0xff && ((bytes[i + 1] ?? 0) & 0xe0) === 0xe0) return i
  }
  return -1
}

function readFrameHeader(bytes: Uint8Array, offset: number): {
  bitrate: number
  sampleRate: number
  samplesPerFrame: number
  channelMode: number
} | null {
  const b1 = bytes[offset + 1] ?? 0
  const b2 = bytes[offset + 2] ?? 0
  const versionBits = (b1 >> 3) & 3
  const layerBits = (b1 >> 1) & 3
  if (versionBits === 1 || layerBits !== 1) return null
  const bitrate = (BITRATE_V1_L3[(b2 >> 4) & 15] ?? 0) * 1000
  const srTable = versionBits === 3 ? SAMPLE_V1 : SAMPLE_V2
  const sampleRate = srTable[(b2 >> 2) & 3] ?? 0
  const samplesPerFrame = versionBits === 3 ? 1152 : 576
  const channelMode = ((bytes[offset + 3] ?? 0) >> 6) & 3
  return { bitrate, sampleRate, samplesPerFrame, channelMode }
}

function findTag(bytes: Uint8Array, frame: number, guess: number): number {
  const start = frame + 4
  const end = Math.min(bytes.length - 8, frame + 200)
  const atGuess = start + guess
  if (isXing(bytes, atGuess)) return atGuess
  for (let i = start; i < end; i += 1) {
    if (isXing(bytes, i)) return i
  }
  return -1
}

function isXing(bytes: Uint8Array, offset: number): boolean {
  const a = bytes[offset]
  const b = bytes[offset + 1]
  const c = bytes[offset + 2]
  const d = bytes[offset + 3]
  return (
    (a === 0x58 && b === 0x69 && c === 0x6e && d === 0x67) ||
    (a === 0x49 && b === 0x6e && c === 0x66 && d === 0x6f)
  )
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0
}
