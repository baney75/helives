import { DPR, type Quality } from './budget.ts'

export const STORAGE_KEY = 'helives.genesis.quality.v1'
export const HIGH_FRAME_MS = 18
export const MEDIUM_FRAME_MS = 1000 / 30
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type QualityRecord = {
  tier: Quality
  dpr: number
  ts: number
  uaHash: string
}

export function hashUa(ua: string): string {
  let hash = 2166136261
  for (let i = 0; i < ua.length; i += 1) {
    hash ^= ua.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY
  const sorted = values.toSorted((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const a = sorted[lo]
  const b = sorted[hi]
  if (a === undefined) return Number.POSITIVE_INFINITY
  if (b === undefined || lo === hi) return a
  return a + (b - a) * (idx - lo)
}

export function chooseTier(frameTimes: readonly number[]): Quality {
  const p90 = percentile(frameTimes, 90)
  if (p90 <= HIGH_FRAME_MS) return 'high'
  if (p90 <= MEDIUM_FRAME_MS) return 'medium'
  return 'low'
}

export function qualityFromSearch(search: string): Quality | null {
  const value = new URLSearchParams(search).get('quality')
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return null
}

export function shouldReuse(
  record: QualityRecord,
  now: number,
  uaHash: string,
): boolean {
  if (record.uaHash !== uaHash) return false
  if (now - record.ts > MAX_AGE_MS) return false
  if (record.tier === 'low') return false
  return true
}

export function parseQualityRecord(raw: string): QualityRecord | null {
  try {
    const data: unknown = JSON.parse(raw)
    return asQualityRecord(data)
  } catch {
    return null
  }
}

export function makeQualityRecord(tier: Quality, now: number, ua: string): QualityRecord {
  const range = DPR[tier]
  return { tier, dpr: range[1], ts: now, uaHash: hashUa(ua) }
}

export function readReusableQuality(
  raw: string | null,
  now: number,
  uaHash: string,
): QualityRecord | null {
  if (!raw) return null
  const record = parseQualityRecord(raw)
  if (!record || !shouldReuse(record, now, uaHash)) return null
  return record
}

function asQualityRecord(data: unknown): QualityRecord | null {
  if (typeof data !== 'object' || data === null) return null
  if (!('tier' in data) || !('dpr' in data) || !('ts' in data) || !('uaHash' in data)) {
    return null
  }
  if (!isQuality(data.tier)) return null
  if (typeof data.dpr !== 'number' || !Number.isFinite(data.dpr)) return null
  if (typeof data.ts !== 'number' || !Number.isFinite(data.ts)) return null
  if (typeof data.uaHash !== 'string' || data.uaHash.length === 0) return null
  return { tier: data.tier, dpr: data.dpr, ts: data.ts, uaHash: data.uaHash }
}

function isQuality(value: unknown): value is Quality {
  return value === 'low' || value === 'medium' || value === 'high'
}
