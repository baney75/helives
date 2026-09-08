import { fallStoryBeat } from '../../genesis/choreography.ts'
import { INTERACTIVE_SECONDS } from '../../genesis/sceneTiming.ts'
import type { Quality } from '../../lib/budget.ts'
import { sceneBounds } from '../../genesis/sceneTiming.ts'
import { mulberry32 } from '../../lib/rng.ts'

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
    position: [-1.72, 0, -0.08] as const satisfies Vec3,
    height: 2.9,
    trunkColor: '#8b6634',
    canopyColor: '#c8b86a',
    fruitColor: '#fff4d6',
  },
  knowledge: {
    id: 'tree-of-knowledge' as const,
    position: [1.5, 0, 0.08] as const satisfies Vec3,
    height: 2.38,
    trunkColor: '#3a2818',
    canopyColor: '#4d5738',
    fruitColor: '#8a2a22',
    fruitLocal: [-0.46, 1.4, 0.62] as const satisfies Vec3,
  },
  river: {
    id: 'river' as const,
    width: 0.5,
    points: [
      [-3.45, 0.02, 2.75],
      [-2.55, 0.02, 2.12],
      [-1.5, 0.02, 1.62],
      [-0.62, 0.02, 0.96],
      [-0.12, 0.02, 0.28],
      [-0.35, 0.02, -0.52],
      [-0.02, 0.02, -1.48],
      [-0.42, 0.02, -2.7],
    ] as const satisfies readonly Vec3[],
  },
  man: {
    id: 'man' as const,
    garden: [0.16, 0, 1.34] as const satisfies Vec3,
    depart: [3.02, 0, 1.76] as const satisfies Vec3,
  },
  woman: {
    id: 'woman' as const,
    garden: [0.72, 0, 1.2] as const satisfies Vec3,
    reach: [0.82, 0, 0.86] as const satisfies Vec3,
    depart: [3.48, 0, 1.94] as const satisfies Vec3,
  },
  east: {
    flame: [2.72, 0, 0.72] as const satisfies Vec3,
  },
} as const

/** Deliberate planted beds. Their spacing is part of the garden composition. */
export const GARDEN_BEDS = [
  { center: [-3.08, 1.06] as const, radius: [0.72, 0.38] as const, turn: 0.18 },
  { center: [-2.76, -1.38] as const, radius: [0.82, 0.5] as const, turn: -0.12 },
  { center: [-1.45, -1.78] as const, radius: [0.76, 0.42] as const, turn: 0.08 },
  { center: [0.2, -1.92] as const, radius: [0.88, 0.48] as const, turn: -0.05 },
  { center: [1.72, -1.66] as const, radius: [0.78, 0.44] as const, turn: 0.14 },
  { center: [2.78, -1.08] as const, radius: [0.68, 0.4] as const, turn: -0.2 },
  { center: [3.02, 1.32] as const, radius: [0.86, 0.46] as const, turn: -0.16 },
] as const

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
  const beat = fallStoryBeat((p - fall.start) * INTERACTIVE_SECONDS)
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
  if (quality === 'medium') return 6
  return 8
}

export function herbCount(quality: Quality): number {
  if (quality === 'low') return 58
  if (quality === 'medium') return 96
  return 142
}

export function canopyLeafCount(quality: Quality, kind: 'life' | 'knowledge'): number {
  // Each instance is a five-leaf sprig rooted on a modeled branchlet.
  const base = kind === 'life' ? 128 : 156
  if (quality === 'low') return Math.floor(base * 0.52)
  if (quality === 'medium') return Math.floor(base * 0.76)
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
  const anchors: readonly (readonly [number, number])[] = [
    [-3.45, -2.68], [-2.65, -3.18], [-1.25, -3.42], [-0.02, -3.55],
    [1.28, -3.4], [2.52, -3.12], [3.36, -2.5], [-3.72, -1.9],
  ]
  const rng = mulberry32(seed)
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const anchor = anchors[i % anchors.length] ?? [0, -3.5]
    const i3 = i * 3
    out[i3] = anchor[0] + (rng() - 0.5) * 0.16
    out[i3 + 1] = 0
    out[i3 + 2] = anchor[1] + (rng() - 0.5) * 0.12
  }
  return out
}

export function herbPositions(count: number, seed: number): Float32Array {
  const out = new Float32Array(count * 3)
  const rng = mulberry32(seed + 9)
  for (let i = 0; i < count; i += 1) {
    const bed = GARDEN_BEDS[i % GARDEN_BEDS.length]!
    const row = Math.floor(i / GARDEN_BEDS.length)
    const lane = ((row * 0.61803398875) % 1) * 2 - 1
    const across = ((row * 0.38196601125 + i * 0.17) % 1) * 2 - 1
    const localX = across * bed.radius[0] * 0.78
    const localZ = lane * bed.radius[1] * 0.62
    const cos = Math.cos(bed.turn), sin = Math.sin(bed.turn)
    const i3 = i * 3
    out[i3] = bed.center[0] + localX * cos - localZ * sin + (rng() - 0.5) * 0.07
    out[i3 + 1] = 0.02 + rng() * 0.03
    out[i3 + 2] = bed.center[1] + localX * sin + localZ * cos + (rng() - 0.5) * 0.05
  }
  return out
}

/** Reeds follow the river banks instead of doubling every garden herb. */
export function riverPlantPositions(count: number, seed: number): Float32Array {
  const rng = mulberry32(seed + 71)
  const out = new Float32Array(count * 3)
  const points = EDEN.river.points
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count * (points.length - 1)
    const index = Math.min(points.length - 2, Math.floor(t))
    const phase = t - index
    const a = points[index]!
    const b = points[index + 1]!
    const dx = b[0] - a[0], dz = b[2] - a[2]
    const length = Math.max(0.001, Math.hypot(dx, dz))
    const side = i % 2 === 0 ? -1 : 1
    const bank = EDEN.river.width * 0.68 + 0.14 + rng() * 0.08
    const i3 = i * 3
    out[i3] = a[0] + dx * phase - dz / length * bank * side
    out[i3 + 1] = 0.025
    out[i3 + 2] = a[2] + dz * phase + dx / length * bank * side
  }
  return out
}

export function serpentPoints(turns = 2.35, samples = 28): Vec3[] {
  const [cx, , cz] = EDEN.knowledge.position
  const fruit = knowledgeFruitWorld()
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i += 1) {
    const t = i / (samples - 1)
    const angle = t * turns * Math.PI * 2 + 0.4
    const radius = 0.22 + (1 - t) * 0.16
    const y = 0.12 + t * 1.55
    pts.push([cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius])
  }
  pts[pts.length - 1] = [fruit[0] - 0.08, fruit[1] + 0.06, fruit[2] + 0.04]
  return pts
}
