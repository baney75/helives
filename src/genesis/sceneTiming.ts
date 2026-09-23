import type { SceneId } from './scenes.ts'

/**
 * Audited MPEG durations, rounded up and given a visual breathing hold.
 * `scripts/generate-audio.mjs` rewrites these values after voice generation.
 */
export const SCENE_AUDIO_SECONDS: Record<SceneId, number> = {
  beginning: 12.851,
  day1: 9.350,
  day2: 22.150,
  day3: 42.395,
  day4: 41.585,
  day5: 33.905,
  day6: 55.012,
  day7: 16.873,
  garden: 20.713,
  fall: 96.233,
  closing: 12.459,
  doubt: 17.971,
  measure: 20.217,
}

export const SCENE_ORDER: readonly SceneId[] = [
  'beginning',
  'day1',
  'day2',
  'day3',
  'day4',
  'day5',
  'day6',
  'day7',
  'garden',
  'fall',
  'closing',
  'doubt',
  'measure',
]

export const SCENE_PAD_SECONDS = 4.5
/** Breath after `audio.ended` before the clock may leave the scene. */
export const AUDIO_BREATH_SECONDS = 0.8

export function sceneSeconds(id: SceneId): number {
  const minimum = id === 'doubt' ? 7 : 0
  return Math.max(minimum, SCENE_AUDIO_SECONDS[id] + SCENE_PAD_SECONDS)
}

export const INTERACTIVE_SECONDS = SCENE_ORDER.reduce((total, id) => total + sceneSeconds(id), 0)

export function sceneBounds(id: SceneId): { start: number; end: number } {
  const index = SCENE_ORDER.indexOf(id)
  if (index < 0) throw new Error(`Unknown Genesis scene: ${id}`)
  const elapsed = SCENE_ORDER.slice(0, index).reduce((total, item) => total + sceneSeconds(item), 0)
  return {
    start: elapsed / INTERACTIVE_SECONDS,
    end: (elapsed + sceneSeconds(id)) / INTERACTIVE_SECONDS,
  }
}
