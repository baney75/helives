import { AUDIO_CUES } from './audioCues.ts'
import { INTERACTIVE_SECONDS, sceneBounds, sceneSeconds } from './sceneTiming.ts'
import type { SceneId } from './scenes.ts'

export type TimedCue = { text: string; start: number; end: number; action?: string }
export function cueAt(id: SceneId, progress: number): TimedCue | undefined {
  const seconds = Math.max(0, (progress - sceneBounds(id).start) * INTERACTIVE_SECONDS)
  const cues: readonly TimedCue[] = AUDIO_CUES[id]
  return cues.find((cue) => seconds >= cue.start && seconds < cue.end) ?? cues.at(-1)
}

/** Map measured spoken phrases onto the existing connected character poses. */
export function fallStoryBeat(seconds: number): number {
  const cues: readonly TimedCue[] = AUDIO_CUES.fall
  const action = (name: string) => {
    const cue = cues.find((item) => item.action === name)
    if (!cue) throw new Error(`Missing Fall cue: ${name}`)
    return cue
  }
  const look = action('look'), take = action('take'), give = action('give'), depart = action('depart')
  const marks = [
    [0, 0], [look.start, 0.06], [take.start, 0.12],
    [take.start + Math.min(0.7, (take.end - take.start) * 0.25), 0.3],
    [give.start, 0.52], [give.end, 0.72],
    [depart.start, 0.72], [depart.end, 0.9], [sceneSeconds('fall'), 1],
  ] as const
  for (let i = 1; i < marks.length; i += 1) {
    const [end, to] = marks[i]!, [start, from] = marks[i - 1]!
    if (seconds <= end) return from + (to - from) * Math.max(0, Math.min(1, (seconds - start) / Math.max(0.001, end - start)))
  }
  return 1
}
