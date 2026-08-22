import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mpegDurationSeconds } from './mpegDuration.ts'
import { AUDIO_BREATH_SECONDS, SCENE_AUDIO_SECONDS, sceneSeconds } from './sceneTiming.ts'
import { VOICED_IDS } from './voiced.ts'

describe('voiced MPEG durations', () => {
  it('keeps scene seconds at or above every real mp3 plus a breath', () => {
    for (const id of VOICED_IDS) {
      const bytes = new Uint8Array(readFileSync(resolve('public/audio', `${id}.mp3`)))
      const duration = mpegDurationSeconds(bytes)
      expect(duration, id).toBeGreaterThan(4)
      expect(SCENE_AUDIO_SECONDS[id], id).toBeGreaterThanOrEqual(duration - 0.02)
      expect(sceneSeconds(id), id).toBeGreaterThanOrEqual(duration + AUDIO_BREATH_SECONDS)
    }
  })

  it('does not invent a duration for a missing file head', () => {
    expect(mpegDurationSeconds(new Uint8Array([0x00, 0x01, 0x02]))).toBe(0)
  })
})
