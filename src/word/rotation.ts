import { POOL, POOL_STEP } from './pool.ts'
import { passageIndex } from './clock.ts'

export function rotatedPassage(start: Date, offset: number) {
  const index = ((passageIndex(start) + offset * POOL_STEP) % POOL.length + POOL.length) % POOL.length
  return POOL[index]!
}
export function rotationLabel(seconds: number) {
  return seconds === 3600 ? 'Every hour' : seconds === 120 ? 'Every 2 minutes' : `Every ${seconds} seconds`
}
