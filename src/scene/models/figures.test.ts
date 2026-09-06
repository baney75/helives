import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sceneBounds } from '../../genesis/sceneTiming.ts'
import { edenPairStory } from './eden.ts'
import { figureJointPose, figureJointShift, heldFruitJoint } from './figurePose.ts'

function gltfNodeNames(path: string): string[] {
  const buf = readFileSync(path)
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as { nodes?: Array<{ name?: string }> }
  return (json.nodes ?? []).map((node) => node.name ?? '')
}

describe('authored figure GLBs', () => {
  it('keeps the single pair visible through the Fall and expulsion beats', () => {
    const fall = sceneBounds('fall')
    const atFall = (local: number) => fall.start + (fall.end - fall.start) * local
    expect(edenPairStory(atFall(0.5))).toMatchObject({ leave: 0, fade: 1 })
    expect(edenPairStory(atFall(0.9)).leave).toBeGreaterThan(0.8)
    expect(edenPairStory(atFall(0.9)).fade).toBe(1)
    const closing = sceneBounds('closing')
    expect(edenPairStory(closing.end).fade).toBeCloseTo(0)
  })

  it('draws the GLB, not the photo plane', () => {
    const src = readFileSync(resolve('src/scene/models/Figure.tsx'), 'utf8')
    expect(src).toContain('useGLTF')
    expect(src).toContain('/models/genesis/man.glb')
    expect(src).toContain('/models/genesis/woman.glb')
    expect(src).not.toContain('PhotoPerson')
    expect(src).not.toContain('man.png')
    expect(src).not.toContain('woman.png')
  })

  it('ships man and woman meshes with a human hierarchy, not a single bean', () => {
    for (const role of ['man', 'woman'] as const) {
      expect(existsSync(resolve(`public/models/genesis/${role}.png`))).toBe(false)
      const path = resolve(`public/models/genesis/${role}.glb`)
      expect(readFileSync(path).byteLength).toBeGreaterThan(80_000)
      const names = gltfNodeNames(path)
      expect(names).toEqual(
        expect.arrayContaining([
          'Root',
          'Head',
          'Neck',
          'Robe',
          'Sash',
          'LEye',
          'REye',
          'LEar',
          'REar',
          'LLowerLeg',
          'RLowerLeg',
        ]),
      )
    }
    const figureSource = readFileSync(resolve('src/scene/models/Figure.tsx'), 'utf8')
    expect(figureSource).not.toMatch(/\.png/)
  })

  it('moves named joints as people in the story, not as a lean-only capsule', () => {
    const reach = figureJointPose('reach', 'woman', 0)
    const eat = figureJointPose('eat', 'woman', 0)
    const walkA = figureJointPose('depart', 'man', 0.4)
    const walkB = figureJointPose('depart', 'man', 0.4 + Math.PI / 3.05)
    expect(reach.LUpperArm?.x ?? 0).toBeGreaterThan(1)
    expect(eat.Head?.x ?? 0).toBeGreaterThan(reach.Head?.x ?? 0)
    expect(eat.LForearm?.x ?? 0).toBeGreaterThan(reach.LForearm?.x ?? 0)
    expect(figureJointShift('eat', 'woman')).toEqual({})
    expect(figureJointShift('reach', 'man')).toEqual({})
    expect(heldFruitJoint('woman')).toBe('LHand')
    expect(heldFruitJoint('man')).toBe('RHand')
    expect(walkA.LLowerLeg?.x ?? 0).not.toBeCloseTo(walkB.LLowerLeg?.x ?? 0, 2)
    expect((walkA.LLowerLeg?.x ?? 0) * (walkA.RLowerLeg?.x ?? 0)).toBeLessThan(0)
    const src = readFileSync(resolve('src/scene/models/Figure.tsx'), 'utf8')
    expect(src).toMatch(/useFrame/)
    expect(src).not.toMatch(/if \(fade < 0\.04\) return null/)
    expect(src).toMatch(/heldFruitJoint/)
    expect(src).toMatch(/getWorldPosition/)
    expect(src).not.toMatch(/1\.28/)
  })

  it('keeps wrist and elbow transforms connected and geometry within browser budgets', () => {
    for (const role of ['man', 'woman', 'bird', 'fish']) {
      const bytes = readFileSync(resolve(`public/models/genesis/${role}.glb`))
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as {
        nodes: Array<{ name: string; children?: number[] }>
        meshes: Array<{ primitives: Array<{ indices: number }> }>
        accessors: Array<{ count: number }>
        extensionsRequired?: string[]
      }
      expect(bytes.byteLength).toBeLessThan(5_000_000)
      expect(gltf.meshes.length).toBeLessThan(30)
      expect(gltf.extensionsRequired ?? []).toEqual([])
      const triangles = gltf.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, p) => n + gltf.accessors[p.indices]!.count / 3, 0), 0)
      expect(triangles).toBeLessThan(100_000)
      if (role === 'man' || role === 'woman') for (const side of ['L', 'R']) {
        const index = (name: string) => gltf.nodes.findIndex((node) => node.name === name)
        expect(gltf.nodes[index(side + 'UpperArm')]?.children).toContain(index(side + 'Forearm'))
        expect(gltf.nodes[index(side + 'Forearm')]?.children).toContain(index(side + 'Hand'))
      }
    }
  })

  it('keeps the six-angle acceptance renderer in the repository', () => {
    const renderer = readFileSync(resolve('scripts/render-figure-turntables.py'), 'utf8')
    expect(renderer).toContain('ANGLES = (0, 60, 120, 180, 240, 300)')
    expect(renderer).toContain('man')
    expect(renderer).toContain('woman')
  })
})
