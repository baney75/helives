import { expect, it } from 'vitest'
import { AUDIO_CUES } from './audioCues.ts'
import { fallStoryBeat, cueAt, type TimedCue } from './choreography.ts'
import { INTERACTIVE_SECONDS, SCENE_ORDER, sceneBounds, SCENE_AUDIO_SECONDS } from './sceneTiming.ts'
import { fallFruitStory, edenPairStory } from '../scene/models/eden.ts'
import { NARRATION } from './script.ts'

it('preserves the complete narration and contiguous measured cues for every scene', () => {
  for (const id of SCENE_ORDER) {
    const cues: readonly TimedCue[] = AUDIO_CUES[id]
    expect(cues.map((cue) => cue.text).join(' ')).toBe(NARRATION[id])
    let end = 0
    for (const cue of cues) {
      expect(cue.start).toBeCloseTo(end, 3)
      expect(cue.end).toBeGreaterThan(cue.start)
      end = cue.end
    }
    expect(Math.abs(end - SCENE_AUDIO_SECONDS[id])).toBeLessThan(0.1)
    expect(cueAt(id, sceneBounds(id).start)?.text).toBe(cues[0]?.text)
  }
})

it('times the fruit and departure to their spoken phrases', () => {
  const cues: readonly TimedCue[] = AUDIO_CUES.fall
  const take = cues.find((cue) => cue.action === 'take')!
  const give = cues.find((cue) => cue.action === 'give')!
  const depart = cues.find((cue) => cue.action === 'depart')!
  expect(fallFruitStory(fallStoryBeat(take.start - 0.1)).holder).toBe('tree')
  expect(fallFruitStory(fallStoryBeat(take.start + 1)).holder).toBe('woman')
  expect(fallFruitStory(fallStoryBeat(give.start + 0.1)).holder).toBe('man')
  const fallStart = sceneBounds('fall').start
  const at = (seconds: number) => edenPairStory(fallStart + seconds / INTERACTIVE_SECONDS)
  expect(at(depart.start - 0.1).leave).toBe(0)
  expect(at(depart.end).leave).toBeCloseTo(1)
})
