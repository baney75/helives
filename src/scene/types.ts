import type { SceneId } from '../genesis/scenes.ts'
import type { Quality } from '../lib/budget.ts'

export type SceneClock = {
  progress: number
  presence: Record<SceneId, number>
  scale: number
  distance: number
  reducedMotion: boolean
  isMobile: boolean
  cinematic: boolean
  quality: Quality
  playing: boolean
}
