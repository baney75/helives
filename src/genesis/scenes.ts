import { KJV } from './kjv.ts'

export type SceneId =
  | 'beginning'
  | 'day1'
  | 'day2'
  | 'day3'
  | 'day4'
  | 'day5'
  | 'day6'
  | 'day7'
  | 'garden'
  | 'fall'
  | 'closing'
  | 'doubt'
  | 'measure'

export type SceneKind = 'scripture' | 'exhortation' | 'science'

export type Scene = {
  id: SceneId
  name: string
  kicker: string
  start: number
  end: number
  persistAfter: boolean
  color: string
  headline: string
  body: string
  citation: string
  kind: SceneKind
  audio: string
  tick: string
}

export const SCENES: readonly Scene[] = [
  {
    id: 'beginning',
    name: 'In the beginning',
    kicker: 'Genesis 1',
    start: 0,
    end: 0.055,
    persistAfter: false,
    color: '#6b7a99',
    headline: KJV.gen1_1,
    body: KJV.gen1_2,
    citation: 'Genesis 1:1–2',
    kind: 'scripture',
    audio: 'beginning.mp3',
    tick: 'Begin',
  },
  {
    id: 'day1',
    name: 'Let there be light',
    kicker: 'First day',
    start: 0.055,
    end: 0.14,
    persistAfter: true,
    color: '#fff4d6',
    headline: KJV.gen1_3,
    body: KJV.gen1_4,
    citation: 'Genesis 1:3–4',
    kind: 'scripture',
    audio: 'day1.mp3',
    tick: 'Day 1',
  },
  {
    id: 'day2',
    name: 'The firmament',
    kicker: 'Second day',
    start: 0.14,
    end: 0.215,
    persistAfter: true,
    color: '#8eb4e8',
    headline: KJV.gen1_6,
    body: KJV.gen1_8,
    citation: 'Genesis 1:6–8',
    kind: 'scripture',
    audio: 'day2.mp3',
    tick: 'Day 2',
  },
  {
    id: 'day3',
    name: 'Earth and seas',
    kicker: 'Third day',
    start: 0.215,
    end: 0.3,
    persistAfter: true,
    color: '#7a9e6a',
    headline: KJV.gen1_9,
    body: `${KJV.gen1_10} ${KJV.gen1_11}`,
    citation: 'Genesis 1:9–13',
    kind: 'scripture',
    audio: 'day3.mp3',
    tick: 'Day 3',
  },
  {
    id: 'day4',
    name: 'Lights in heaven',
    kicker: 'Fourth day',
    start: 0.3,
    end: 0.385,
    persistAfter: true,
    color: '#ffd28a',
    headline: KJV.gen1_16,
    body: 'And God set them in the firmament of the heaven to give light upon the earth.',
    citation: 'Genesis 1:14–19',
    kind: 'scripture',
    audio: 'day4.mp3',
    tick: 'Day 4',
  },
  {
    id: 'day5',
    name: 'Fish and fowl',
    kicker: 'Fifth day',
    start: 0.385,
    end: 0.46,
    persistAfter: true,
    color: '#6ea8c9',
    headline: KJV.gen1_20,
    body: 'And God created great whales, and every living creature that moveth, and every winged fowl after his kind.',
    citation: 'Genesis 1:20–23',
    kind: 'scripture',
    audio: 'day5.mp3',
    tick: 'Day 5',
  },
  {
    id: 'day6',
    name: 'Man and woman',
    kicker: 'Sixth day',
    start: 0.46,
    end: 0.555,
    persistAfter: true,
    color: '#e8c27a',
    headline: KJV.gen1_27,
    body: `${KJV.gen1_26} ${KJV.gen1_31}`,
    citation: 'Genesis 1:24–31',
    kind: 'scripture',
    audio: 'day6.mp3',
    tick: 'Day 6',
  },
  {
    id: 'day7',
    name: 'God rested',
    kicker: 'Seventh day',
    start: 0.555,
    end: 0.605,
    persistAfter: false,
    color: '#f0d9a8',
    headline: KJV.gen2_2,
    body: 'And God blessed the seventh day, and sanctified it.',
    citation: 'Genesis 2:1–3',
    kind: 'scripture',
    audio: 'day7.mp3',
    tick: 'Day 7',
  },
  {
    id: 'garden',
    name: 'A garden in Eden',
    kicker: 'Genesis 2',
    start: 0.605,
    end: 0.7,
    persistAfter: true,
    color: '#9cbf7a',
    headline: KJV.gen2_8,
    body: KJV.gen2_16_17,
    citation: 'Genesis 2:8–17',
    kind: 'scripture',
    audio: 'garden.mp3',
    tick: 'Eden',
  },
  {
    id: 'fall',
    name: 'The Fall',
    kicker: 'Genesis 3',
    start: 0.7,
    end: 0.79,
    persistAfter: true,
    color: '#c45a3a',
    headline: KJV.gen3_6,
    body: `${KJV.gen3_4} ${KJV.gen3_23}`,
    citation: 'Genesis 3:1–23',
    kind: 'scripture',
    audio: 'fall.mp3',
    tick: 'Fall',
  },
  {
    id: 'closing',
    name: 'Live for Jesus Christ',
    kicker: 'An invitation',
    start: 0.79,
    end: 0.855,
    persistAfter: false,
    color: '#e8e4dc',
    headline: 'Go to church. Live for Jesus Christ.',
    body: 'This is a visual meditation on Genesis 1 through 3, not a documentary. Hear the Word. Worship with the church. Follow Jesus.',
    citation: 'Not Scripture',
    kind: 'exhortation',
    audio: 'closing.mp3',
    tick: 'Christ',
  },
  {
    id: 'doubt',
    name: 'Got doubt?',
    kicker: 'A quiet question',
    start: 0.855,
    end: 0.9,
    persistAfter: false,
    color: '#9bb4d4',
    headline: 'Got doubt?',
    body: 'That is allowed. Measurement is not unbelief. Look at what physics can describe. Then read. Then go to church anyway.',
    citation: 'Not Scripture',
    kind: 'science',
    audio: 'doubt.mp3',
    tick: 'Doubt',
  },
  {
    id: 'measure',
    name: 'What we can measure',
    kicker: 'ΛCDM, after the Word',
    start: 0.9,
    end: 1,
    persistAfter: true,
    color: '#c9d6ea',
    headline: 'The sky still holds a faint heat.',
    body: 'Physicists describe an expanding universe, leftover microwave light, and an age near 13.8 billion years. That account does not dethrone Genesis. It is what instruments can see.',
    citation: 'NASA / ESA Planck — not Scripture',
    kind: 'science',
    audio: 'measure.mp3',
    tick: 'Sky',
  },
] as const

export function findSceneAt(progress: number): Scene {
  const last = SCENES[SCENES.length - 1]
  if (!last) throw new Error('SCENES is empty')
  const p = clamp01(progress)
  let current = SCENES[0] ?? last
  for (const scene of SCENES) {
    if (p >= scene.start) current = scene
  }
  return current
}

export function scenePresence(progress: number, scene: Scene, fade = 0.035): number {
  const p = clamp01(progress)
  if (p < scene.start - fade) return 0
  if (scene.persistAfter && p >= scene.start) {
    return Math.min(1, Math.max(0, (p - (scene.start - fade)) / fade))
  }
  if (p > scene.end + fade) return 0
  if (p >= scene.start && p <= scene.end) return 1
  if (p < scene.start) return (p - (scene.start - fade)) / fade
  return 1 - (p - scene.end) / fade
}

export function presenceById(progress: number): Record<SceneId, number> {
  const out = {} as Record<SceneId, number>
  for (const scene of SCENES) {
    out[scene.id] = clamp01(scenePresence(progress, scene))
  }
  return out
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
