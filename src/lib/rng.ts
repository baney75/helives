/** Deterministic mulberry32 — same field every reload. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function fillSphere(
  count: number,
  radius: number,
  seed: number,
): Float32Array {
  const rng = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const u = rng()
    const v = rng()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = radius * Math.cbrt(rng())
    const i3 = i * 3
    pos[i3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i3 + 2] = r * Math.cos(phi)
  }
  return pos
}

export function fillHemisphere(
  count: number,
  radius: number,
  seed: number,
): Float32Array {
  const rng = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const u = rng()
    const v = rng()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(v)
    const r = radius * (0.45 + 0.55 * rng())
    const i3 = i * 3
    pos[i3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i3 + 1] = Math.abs(r * Math.cos(phi))
    pos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  return pos
}

export function fillDisk(count: number, radius: number, seed: number, y = 0): Float32Array {
  const rng = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const t = 2 * Math.PI * rng()
    const r = radius * Math.sqrt(rng())
    const i3 = i * 3
    pos[i3] = Math.cos(t) * r
    pos[i3 + 1] = y + (rng() - 0.5) * 0.18
    pos[i3 + 2] = Math.sin(t) * r
  }
  return pos
}

/** Logarithmic spiral disk for a late-time galaxy. */
export function fillSpiral(
  count: number,
  radius: number,
  seed: number,
  arms = 2,
): Float32Array {
  const rng = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const arm = i % arms
    const t = rng() ** 0.65
    const r = 0.12 + t * radius
    const theta = (arm * (Math.PI * 2)) / arms + t * 4.2 + (rng() - 0.5) * 0.42
    const i3 = i * 3
    pos[i3] = Math.cos(theta) * r
    pos[i3 + 1] = (rng() - 0.5) * 0.14 * (1 - t)
    pos[i3 + 2] = Math.sin(theta) * r
  }
  return pos
}
