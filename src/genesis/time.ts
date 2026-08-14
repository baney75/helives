import { clamp01 } from './scenes.ts'

export const INTERACTIVE_SECONDS = 148
export const CINEMATIC_SECONDS = 48
export const OPENING_HOLD_SECONDS = 4
export const CINEMATIC_HOLD_SECONDS = 2.2

export function visualScale(progress: number): number {
  const p = clamp01(progress)
  if (p < 0.17) return 0.2 + (p / 0.17) ** 0.7 * 1.4
  if (p < 0.73) return 1.6 + (p - 0.17) * 2.2
  return 2.8 - (p - 0.73) * 1.1
}

export function cameraDistance(progress: number): number {
  const p = clamp01(progress)
  if (p < 0.08) return 4.2
  if (p < 0.17) return 4.2 + (p - 0.08) * 18
  if (p < 0.36) return 5.8 + (p - 0.17) * 8
  if (p < 0.46) return 8.2
  if (p < 0.7) return 6.6
  if (p < 0.855) return 6.2
  return 9.2
}

/** Composed garden/fall viewpoint. Used when paused so the heroes stay on camera. */
export function framedCamera(progress: number): { x: number; y: number; z: number } {
  const p = clamp01(progress)
  if (p >= 0.6 && p < 0.7) return { x: 0.15, y: 1.42, z: 5.35 }
  if (p >= 0.7 && p < 0.86) return { x: 0.35, y: 1.38, z: 5.05 }
  const dist = cameraDistance(p)
  return { x: 0, y: 0.35 + p * 0.4, z: dist }
}

export function fogFar(progress: number): number {
  const p = clamp01(progress)
  if (p < 0.07) return 18
  if (p < 0.46) return 48 + p * 40
  if (p < 0.83) return 36
  return 22
}
