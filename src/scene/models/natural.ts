import { BufferGeometry, Color, DataTexture, Float32BufferAttribute, RepeatWrapping, RGBAFormat, SRGBColorSpace, Vector3 } from 'three'
import { mulberry32 } from '../../lib/rng.ts'
import { createTaperedTube } from './geometry.ts'

/** Small authored bark tile: furrows, knots and warm/cool growth bands. */
export function createBarkTexture(): DataTexture {
  const size = 128
  const pixels = new Uint8Array(size * size * 4)
  const rng = mulberry32(401)
  const color = new Color()
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size
    const groove = Math.pow(Math.abs(Math.sin(u * Math.PI * 24 + Math.sin(v * Math.PI * 2) * 0.65)), 12)
    const fine = Math.sin(u * Math.PI * 86 + Math.sin(v * 18)) * 0.035
    const value = 0.61 - groove * 0.25 + fine + rng() * 0.1
    color.setRGB(value, value * 0.89, value * 0.73)
    const i = (y * size + x) * 4
    pixels[i] = color.r * 255; pixels[i + 1] = color.g * 255; pixels[i + 2] = color.b * 255; pixels[i + 3] = 255
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function organicBranch(points: Array<readonly [number, number, number]>, radius: number): BufferGeometry {
  const geometry = createTaperedTube(points.map((p) => new Vector3(...p)), radius, radius * 0.12, 12)
  const pos = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv: number[] = []
  for (let i = 0; i < pos.count; i += 1) {
    const angle = (i % 12) / 12 * Math.PI * 2
    const t = Math.floor(i / 12) / (pos.count / 12 - 1)
    const ridge = radius * 0.055 * (1 - t) * Math.sin(angle * 5 + t * 8)
    pos.setXYZ(i, pos.getX(i) + normal.getX(i) * ridge, pos.getY(i) + normal.getY(i) * ridge, pos.getZ(i) + normal.getZ(i) * ridge)
    uv.push((i % 12) / 12, t * 2)
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.computeVertexNormals()
  return geometry
}

/** Staggered scale edges with a restrained olive pattern. */
export function createScaleTexture(): DataTexture {
  const size = 128, pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const row = Math.floor(y / 16)
    const u = ((x + row % 2 * 8) % 16) / 16
    const v = (y % 16) / 16
    const edge = Math.abs(v - (0.28 + Math.sin(u * Math.PI) * 0.6)) < 0.06
    const value = edge ? 0.45 : 0.72 + Math.sin(u * Math.PI) * 0.15
    const i = (y * size + x) * 4
    pixels[i] = value * 180; pixels[i + 1] = value * 170; pixels[i + 2] = value * 100; pixels[i + 3] = 255
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
