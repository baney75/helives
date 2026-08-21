import { POOL, POOL_STEP } from './pool.ts'
import type { Passage } from './types.ts'

const HOUR_MS = 3_600_000

/** Whole UTC hours since the Unix epoch. */
export function utcHourIndex(at: Date): number {
  return Math.floor(at.getTime() / HOUR_MS)
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x
}

export function passageIndex(at: Date, length = POOL.length, step = POOL_STEP): number {
  if (length <= 0) {
    throw new Error('word pool is empty')
  }
  if (length === 1) return 0
  if (gcd(step, length) !== 1) {
    throw new Error(`POOL_STEP ${step} must be coprime with pool length ${length}`)
  }
  const hour = utcHourIndex(at)
  return ((hour % length) * (step % length)) % length
}

export function passageAt(at: Date): Passage {
  const passage = POOL[passageIndex(at)]
  if (!passage) {
    throw new Error('word pool index out of range')
  }
  return passage
}

/** Milliseconds until the next UTC hour. */
export function msUntilNextHour(at: Date): number {
  const rem = HOUR_MS - (at.getTime() % HOUR_MS)
  return rem === 0 ? HOUR_MS : rem
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
