import { sceneBounds } from '../genesis/sceneTiming.ts'
import { clamp01, type SceneId } from '../genesis/scenes.ts'

export type Mark = { x: number; y: number; r: number; opacity: number }

/** Fixed seeds keep every scene identical across seeks, reloads, and screenshots. */
export function marks(count: number, seed: number, bounds: [number, number, number, number]): Mark[] {
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
  const [left, top, width, height] = bounds
  return Array.from({ length: count }, () => ({
    x: left + random() * width,
    y: top + random() * height,
    r: 0.45 + random() * 1.7,
    opacity: 0.24 + random() * 0.65,
  }))
}

export function localSceneProgress(sceneId: SceneId, progress: number): number {
  const { start, end } = sceneBounds(sceneId)
  return clamp01((progress - start) / (end - start))
}

export const SKY_STARS = marks(86, 1703, [22, 22, 1150, 540])
export const DEEP_STARS = marks(44, 5021, [220, 25, 900, 560])
export const CANOPY_MARKS = marks(84, 3601, [-110, -110, 220, 164])
export const MEADOW_MARKS = marks(76, 7241, [320, 515, 870, 185])

export const wavePaths = Array.from({ length: 14 }, (_, index) => {
  const y = 565 + index * 16
  const phase = index % 3
  return `M -40 ${y} C 112 ${y - 16 - phase * 4} 188 ${y + 18} 332 ${y} S 556 ${y - 20} 704 ${y} S 922 ${y + 18} 1240 ${y - 6}`
})

export const hillContours = Array.from({ length: 7 }, (_, index) => {
  const y = 560 + index * 24
  return `M 0 ${y + 12} Q 210 ${y - 38} 440 ${y + 12} T 840 ${y - 12} T 1200 ${y + 7}`
})
