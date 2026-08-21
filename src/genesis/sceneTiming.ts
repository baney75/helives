import type { SceneId } from './scenes.ts'

/**
 * Audited MPEG durations, rounded up and given a visual breathing hold.
 * `scripts/generate-audio.mjs` rewrites these values after voice generation.
 */
export const SCENE_AUDIO_SECONDS: Record<SceneId, number> = {
  beginning: 12.592,
  day1: 9.272,
  day2: 13.976,
  day3: 28.224,
  day4: 10.264,
  day5: 14.144,
  day6: 21.912,
  day7: 11.920,
  garden: 18.568,
  fall: 102.632,
  closing: 10.000,
  doubt: 11.296,
  measure: 19.120,
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
