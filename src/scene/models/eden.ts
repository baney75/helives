import type { Quality } from '../../lib/budget.ts'
import { sceneBounds } from '../../genesis/sceneTiming.ts'
import { fillDisk, mulberry32 } from '../../lib/rng.ts'

export type Vec3 = readonly [number, number, number]

export type GardenPartId = 'tree-of-life' | 'tree-of-knowledge' | 'river' | 'man' | 'woman'

export type FallPartId =
  | 'serpent'
  | 'fruit-taken'
  | 'eaten'
  | 'expulsion-man'
  | 'expulsion-woman'
  | 'east-flame'

export const GARDEN_REQUIRED: readonly GardenPartId[] = [
  'tree-of-life',
  'tree-of-knowledge',
  'river',
  'man',
  'woman',
]

export const FALL_REQUIRED: readonly FallPartId[] = [
  'serpent',
  'fruit-taken',
  'eaten',
  'expulsion-man',
  'expulsion-woman',
  'east-flame',
]

/** Shared world layout. Garden and Fall both read these positions. */
export const EDEN = {
  origin: [0, -0.12, 0] as const satisfies Vec3,
  groundRadius: 4.35,
  life: {
    id: 'tree-of-life' as const,
    position: [-1.72, 0, 0.08] as const satisfies Vec3,
    height: 2.9,
    trunkColor: '#8a6a32',
    canopyColor: '#c4b85a',
    fruitColor: '#fff4d6',
  },
  knowledge: {
    id: 'tree-of-knowledge' as const,
    position: [1.48, 0, 0.22] as const satisfies Vec3,
    height: 2.38,
    trunkColor: '#3a2818',
    canopyColor: '#5a3a28',
    fruitColor: '#8a2a22',
    fruitLocal: [-0.18, 1.58, 0.32] as const satisfies Vec3,
  },
  river: {
    id: 'river' as const,
    width: 0.46,
    points: [
      [-3.15, 0.02, 2.55],
      [-2.35, 0.02, 1.85],
      [-1.55, 0.02, 1.55],
      [-0.55, 0.02, 0.82],
      [0.35, 0.02, 0.95],
      [1.15, 0.02, 0.22],
      [2.15, 0.02, -0.55],
      [3.05, 0.02, -1.15],
    ] as const satisfies readonly Vec3[],
  },
  man: {
    id: 'man' as const,
    garden: [0.06, 0, 1.62] as const satisfies Vec3,
    depart: [3.02, 0, 1.76] as const satisfies Vec3,
  },
  woman: {
    id: 'woman' as const,
    garden: [0.78, 0, 1.28] as const satisfies Vec3,
    reach: [0.88, 0, 0.82] as const satisfies Vec3,
    depart: [3.48, 0, 1.94] as const satisfies Vec3,
  },
  east: {
    flame: [2.72, 0, 0.72] as const satisfies Vec3,
  },
} as const

export function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  const u = Math.min(1, Math.max(0, t))
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
}

export function knowledgeFruitWorld(): Vec3 {
  return add3(EDEN.knowledge.position, EDEN.knowledge.fruitLocal)
}

export const FALL_HANDS = {
  woman: [EDEN.woman.reach[0] + 0.08, 1.02, EDEN.woman.reach[2] - 0.08] as const satisfies Vec3,
  man: [EDEN.man.garden[0] + 0.03, 1.08, EDEN.man.garden[2] - 0.08] as const satisfies Vec3,
}

export type FruitHolder = 'none' | 'tree' | 'air' | 'woman' | 'man'

export function fallFruitStory(beat: number): {
  visible: boolean
  holder: FruitHolder
  from: Vec3
  to: Vec3
  phase: number
  eatenScale: number
} {
  const b = Math.min(1, Math.max(0, beat))
  let from: Vec3 = knowledgeFruitWorld()
  let to: Vec3 = FALL_HANDS.woman
  let phase = smoothstep((b - 0.12) / 0.18)
  let holder: FruitHolder = 'tree'
  if (b >= 0.12 && b < 0.3) {
    holder = 'air'
  } else if (b >= 0.3 && b < 0.52) {
    from = FALL_HANDS.woman
    to = FALL_HANDS.woman
    phase = 1
    holder = 'woman'
  } else if (b >= 0.52 && b < 0.72) {
    from = FALL_HANDS.woman
    to = FALL_HANDS.man
    phase = smoothstep((b - 0.52) / 0.12)
    holder = 'man'
  } else if (b >= 0.72) {
    from = FALL_HANDS.man
    to = FALL_HANDS.man
    phase = 1
    holder = 'none'
  }
  return {
    visible: holder === 'air',
    holder,
    from,
    to,
    phase,
    eatenScale: holder === 'man' && b > 0.66 ? Math.max(0.02, 1 - (b - 0.66) / 0.06) : 1,
  }
}

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

/**
 * Pair timing from clock progress. Do not key this off presence.fall:
 * persistAfter holds that at 1 for the rest of the journey, which hid
 * Adam and Eve for the entire Fall beat.
 */
export function edenPairStory(progress: number): { beat: number; leave: number; fade: number } {
  const p = Math.min(1, Math.max(0, progress))
  const fall = sceneBounds('fall')
  const closing = sceneBounds('closing')
  const beat = Math.min(1, Math.max(0, (p - fall.start) / (fall.end - fall.start)))
  const leave = Math.min(1, Math.max(0, (beat - 0.72) / 0.18))
  const fadeWindow = Math.max(0.001, (closing.end - closing.start) * 0.55)
  const fade = p < fall.end ? 1 : Math.min(1, Math.max(0, 1 - (p - fall.end) / fadeWindow))
  return { beat, leave, fade }
}

export function gardenParts(): readonly { id: GardenPartId; position: Vec3 }[] {
  return [
    { id: EDEN.life.id, position: EDEN.life.position },
    { id: EDEN.knowledge.id, position: EDEN.knowledge.position },
    { id: EDEN.river.id, position: EDEN.river.points[2] ?? [0, 0, 0] },
    { id: EDEN.man.id, position: EDEN.man.garden },
    { id: EDEN.woman.id, position: EDEN.woman.garden },
  ]
}

export function fallParts(): readonly { id: FallPartId; position: Vec3 }[] {
  return [
    { id: 'serpent', position: EDEN.knowledge.position },
    { id: 'fruit-taken', position: knowledgeFruitWorld() },
    { id: 'eaten', position: FALL_HANDS.woman },
    { id: 'expulsion-man', position: EDEN.man.depart },
    { id: 'expulsion-woman', position: EDEN.woman.depart },
    { id: 'east-flame', position: EDEN.east.flame },
  ]
}

export function treesAreDistinct(): boolean {
  const dx = EDEN.life.position[0] - EDEN.knowledge.position[0]
  const dz = EDEN.life.position[2] - EDEN.knowledge.position[2]
  const colors: readonly string[] = [EDEN.life.fruitColor, EDEN.knowledge.fruitColor]
  return Math.hypot(dx, dz) > 1.8 && colors[0] !== colors[1]
}

export function groveCount(quality: Quality): number {
  if (quality === 'low') return 4
  if (quality === 'medium') return 7
  return 10
}

export function herbCount(quality: Quality): number {
  if (quality === 'low') return 55
  if (quality === 'medium') return 100
  return 150
}

export function canopyLeafCount(quality: Quality, kind: 'life' | 'knowledge'): number {
  const base = kind === 'life' ? 280 : 420
  if (quality === 'low') return Math.floor(base * 0.45)
  if (quality === 'medium') return Math.floor(base * 0.72)
  return base
}

export function isNearHero(x: number, z: number): boolean {
  const life = Math.hypot(x - EDEN.life.position[0], z - EDEN.life.position[2])
  const knowledge = Math.hypot(x - EDEN.knowledge.position[0], z - EDEN.knowledge.position[2])
  const pair = Math.hypot(x - 0.5, z - 1.3)
  if (life < 1.15 || knowledge < 1.2 || pair < 0.85) return true
  return riverDistance(x, z) < 0.55
}

export function riverDistance(x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY
  const pts = EDEN.river.points
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]
    const b = pts[i + 1]
    if (!a || !b) continue
    const dx = b[0] - a[0]
    const dz = b[2] - a[2]
    const len2 = dx * dx + dz * dz
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[2]) * dz) / len2))
    const px = a[0] + dx * t
    const pz = a[2] + dz * t
    best = Math.min(best, Math.hypot(x - px, z - pz))
  }
  return best
}

/** Extra grove trees. Never the two named trees; never on the river or the pair. */
export function grovePositions(count: number, seed: number): Float32Array {
  const oversample = fillDisk(Math.max(count * 8, 32), 3.85, seed, 0)
  const out = new Float32Array(count * 3)
  let written = 0
  for (let i = 0; i < oversample.length / 3 && written < count; i += 1) {
    const x = oversample[i * 3] ?? 0
    const z = oversample[i * 3 + 2] ?? 0
    if (isNearHero(x, z)) continue
    if (Math.hypot(x, z) < 2.4) continue
    if (z > -0.8) continue
    const i3 = written * 3
    out[i3] = x
    out[i3 + 1] = 0
    out[i3 + 2] = z
    written += 1
  }
  return out.subarray(0, written * 3)
}

export function herbPositions(count: number, seed: number): Float32Array {
  const oversample = fillDisk(Math.max(count * 3, 12), 3.6, seed, 0.04)
  const out = new Float32Array(count * 3)
  const rng = mulberry32(seed + 9)
  let written = 0
  for (let i = 0; i < oversample.length / 3 && written < count; i += 1) {
    const x = oversample[i * 3] ?? 0
    const z = oversample[i * 3 + 2] ?? 0
    if (isNearHero(x, z)) continue
    const i3 = written * 3
    out[i3] = x
    out[i3 + 1] = 0.02 + rng() * 0.03
    out[i3 + 2] = z
    written += 1
  }
  return out.subarray(0, written * 3)
}

export function serpentPoints(turns = 3, samples = 60): Vec3[] {
  const [cx, , cz] = EDEN.knowledge.position
  const fruit = knowledgeFruitWorld()
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i += 1) {
    const t = i / (samples - 1)
    const climb = t * t * (3 - 2 * t)
    const angle = t * turns * Math.PI * 2 + 0.4
    const radius = (0.13 + (1 - t) * 0.085) * (1 + Math.sin(t * Math.PI * 4) * 0.14)
    const y = 0.1 + climb * 1.5
    const coilX = cx + Math.cos(angle) * radius
    const coilZ = cz + Math.sin(angle) * radius
    const reach = smoothstep((t - 0.76) / 0.24)
    const headX = fruit[0] - 0.1
    const headZ = fruit[2] + 0.16
    pts.push([coilX + (headX - coilX) * reach, y + reach * 0.2, coilZ + (headZ - coilZ) * reach])
  }
  pts[pts.length - 1] = [fruit[0] - 0.08, fruit[1] + 0.06, fruit[2] + 0.04]
  return pts
}
