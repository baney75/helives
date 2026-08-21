import { clamp01 } from './scenes.ts'
import { findSceneAt, SCENES } from './scenes.ts'
import { INTERACTIVE_SECONDS } from './sceneTiming.ts'

export { INTERACTIVE_SECONDS } from './sceneTiming.ts'
export const CINEMATIC_SECONDS = 48
export const OPENING_HOLD_SECONDS = 0.6
export const CINEMATIC_HOLD_SECONDS = 0.8
export const MAX_FRAME_DELTA_SECONDS = 1 / 20

/** Avoid jumping past narration and animation beats after a slow render frame. */
export function clampedFrameDelta(now: number, previous: number): number {
  return Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, (now - previous) / 1000))
}

export function advanceProgress(
  current: number,
  dt: number,
  cinematic: boolean,
  speed: number,
  holdRef: { current: number },
  stop: () => void,
): number {
  if (current <= 0) {
    holdRef.current += dt
    const hold = cinematic ? CINEMATIC_HOLD_SECONDS : OPENING_HOLD_SECONDS
    if (holdRef.current < hold) return 0
  }
  const journey = cinematic ? CINEMATIC_SECONDS : INTERACTIVE_SECONDS
  const next = current + dt / (journey / speed)
  if (next >= 1) {
    stop()
    return 1
  }
  return next
}

export function visualScale(progress: number): number {
  const scene = findSceneAt(progress)
  const local = sceneLocalProgress(progress)
  const index = SCENES.findIndex((item) => item.id === scene.id)
  const creationGrowth = Math.min(1, Math.max(0, index / 6))
  if (scene.id === 'beginning') return 0.35 + local * 0.45
  if (scene.id === 'day1') return 0.8 + local * 0.75
  if (scene.id === 'closing' || scene.id === 'doubt' || scene.id === 'measure') return 2.15
  return 1.45 + creationGrowth * 1.35
}

export function cameraDistance(progress: number): number {
  const scene = findSceneAt(progress)
  const distances: Record<string, number> = {
    beginning: 4.6,
    day1: 5.4,
    day2: 6.4,
    day3: 7.4,
    day4: 8.3,
    day5: 6.6,
    day6: 6.1,
    day7: 6.5,
    garden: 5.35,
    fall: 5.15,
    closing: 7.8,
    doubt: 8.5,
    measure: 9.4,
  }
  return distances[scene.id] ?? 6
}

export function sceneLocalProgress(progress: number): number {
  const scene = findSceneAt(progress)
  return clamp01((progress - scene.start) / Math.max(0.0001, scene.end - scene.start))
}

export type CameraPose = {
  position: [number, number, number]
  target: [number, number, number]
}

/** An authored camera rail per beat; no generic orbit during playback. */
export function cameraPose(progress: number, mobile = false): CameraPose {
  const scene = findSceneAt(progress)
  const t = sceneLocalProgress(progress)
  const side = Math.sin(t * Math.PI) * (mobile ? 0.28 : 0.7)
  const fallFollow = Math.min(1, Math.max(0, (t - 0.58) / 0.38))
  const poses: Record<string, CameraPose> = {
    beginning: { position: [-0.35 + side, 0.22 + t * 0.18, 4.6 - t * 0.3], target: [0, -0.25, 0] },
    day1: { position: [1.1 - t * 1.8, 0.5 + t * 0.35, 5.5], target: [0, 0.15, 0] },
    day2: { position: [-1.15 + side, 0.28 + t * 0.55, 6.1 - t * 0.45], target: [0, 1.05, 0] },
    day3: { position: [1.4 - t * 0.9, 1.0 + t * 0.25, 7.1], target: [0, 0.25, 0.4] },
    day4: { position: [-1.0 + side, 1.15 + t * 0.55, 8.0], target: [0, 0.75, 0] },
    day5: { position: [-1.25 + t * 1.7, 0.35 + t * 0.48, 6.15 - t * 0.35], target: [0, 0.5, 0.9] },
    day6: { position: [0.85 - t * 0.5, 1.24 + t * 0.16, 5.25], target: [0.1, 0.62, 1.08] },
    day7: { position: [-0.6 + side, 1.55, 6.4], target: [0, 0.45, 0] },
    garden: { position: [0.2 + side * 0.35, 1.45, 5.2 - t * 0.25], target: [0.55, 0.72, 0.85] },
    fall: mobile
      ? {
          position: [0.32 + fallFollow * 2.16, 1.3 + fallFollow * 0.12, 4.75 + fallFollow * 0.25],
          target: [0.52 + fallFollow * 3.05, 0.66, 1.02 + fallFollow * 0.68],
        }
      : {
          position: [0.42 + t * 2.2, 1.38 + t * 0.16, 5.15 + t * 0.3],
          target: [0.62 + Math.max(0, t - 0.58) * 6.7, 0.7, 1.02 + Math.max(0, t - 0.58) * 1.12],
        },
    closing: { position: [-0.8 + side, 1.1, 7.7], target: [0, 0.35, 0] },
    doubt: { position: [0.9 - t * 0.5, 1.65, 8.4], target: [0, 0.6, 0] },
    measure: { position: [-1.25 + side, 1.85 + t * 0.3, 9.2], target: [0, 0.65, 0] },
  }
  return poses[scene.id] ?? { position: [0, 0.5, cameraDistance(progress)], target: [0, 0, 0] }
}

/** Composed garden/fall viewpoint. Used when paused so the heroes stay on camera. */
export function framedCamera(progress: number): { x: number; y: number; z: number } {
  const pose = cameraPose(progress)
  return { x: pose.position[0], y: pose.position[1], z: pose.position[2] }
}

export function fogFar(progress: number): number {
  const scene = findSceneAt(progress)
  if (scene.id === 'beginning') return 20
  if (scene.id === 'day1' || scene.id === 'day2') return 58
  if (scene.id === 'day3' || scene.id === 'day4' || scene.id === 'day5') return 68
  if (scene.id === 'doubt' || scene.id === 'measure') return 28
  return 38
}
