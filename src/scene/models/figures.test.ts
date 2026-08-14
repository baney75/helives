import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function gltfNodeNames(path: string): string[] {
  const buf = readFileSync(path)
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as { nodes?: Array<{ name?: string }> }
  return (json.nodes ?? []).map((node) => node.name ?? '')
}

describe('authored figure GLBs', () => {
  it('ships man and woman meshes with a human hierarchy, not a single bean', () => {
    for (const role of ['man', 'woman'] as const) {
      const cutout = readFileSync(resolve(`public/models/genesis/${role}.png`))
      expect(cutout.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      expect(cutout.byteLength).toBeGreaterThan(20_000)
      const path = resolve(`public/models/genesis/${role}.glb`)
      const names = gltfNodeNames(path)
      expect(names).toEqual(expect.arrayContaining(['Root', 'Head', 'Neck', 'Robe']))
    }
  })
})
