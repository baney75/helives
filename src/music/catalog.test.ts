import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { MUSIC_TRACKS } from './catalog.ts'
import { mpegDurationSeconds } from '../genesis/mpegDuration.ts'

it('lists unique, real MPEG recordings and no unpublished placeholders', () => {
  expect(new Set(MUSIC_TRACKS.map(t => t.id)).size).toBe(MUSIC_TRACKS.length)
  expect(new Set(MUSIC_TRACKS.map(t => t.file)).size).toBe(MUSIC_TRACKS.length)
  expect(MUSIC_TRACKS.length).toBeGreaterThan(0)
  expect(readdirSync('public/audio/music').filter(f => f.endsWith('.mp3')).toSorted()).toEqual(MUSIC_TRACKS.map(t => t.file).toSorted())
  for (const track of MUSIC_TRACKS) {
    expect(track.file).toMatch(/^[a-z0-9-]+\.mp3$/)
    expect(track.title.length).toBeGreaterThan(0)
    expect(mpegDurationSeconds(new Uint8Array(readFileSync(resolve('public/audio/music', track.file))))).toBeGreaterThan(1)
  }
})
