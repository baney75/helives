import type { SceneId } from './scenes.ts'

/**
 * Spoken files that actually exist in public/audio.
 * Missing days stay on-screen KJV. Do not request 404 mp3s.
 */
export const VOICED_IDS = [
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
] as const satisfies readonly SceneId[]

const VOICED = new Set<string>([...VOICED_IDS, 'trailer'])

export function hasVoice(id: SceneId | 'trailer'): boolean {
  return VOICED.has(id)
}

export function narrationFile(id: SceneId | 'trailer'): string | null {
  if (!hasVoice(id)) return null
  return `${id}.mp3`
}
