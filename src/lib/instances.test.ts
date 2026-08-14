import { describe, expect, it } from 'vitest'
import { InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from 'three'
import { writeInstanceMatrices, writeOrientedInstances } from './instances.ts'

describe('writeInstanceMatrices', () => {
  it('fills every instance from packed positions', () => {
    const count = 3
    const mesh = new InstancedMesh(new SphereGeometry(1, 4, 4), new MeshBasicMaterial(), count)
    const positions = new Float32Array([1, 0, 0, 0, 2, 0, 0, 0, 3])
    writeInstanceMatrices(mesh, positions, count, () => 1)
    const matrix = new Matrix4()
    mesh.getMatrixAt(0, matrix)
    expect(matrix.elements[12]).toBeCloseTo(1)
    mesh.getMatrixAt(1, matrix)
    expect(matrix.elements[13]).toBeCloseTo(2)
    mesh.getMatrixAt(2, matrix)
    expect(matrix.elements[14]).toBeCloseTo(3)
    mesh.dispose()
  })
})

describe('writeOrientedInstances', () => {
  it('writes non-uniform scale and yaw into the instance matrix', () => {
    const mesh = new InstancedMesh(new SphereGeometry(1, 4, 4), new MeshBasicMaterial(), 1)
    writeOrientedInstances(mesh, new Float32Array([2, 0, 0]), 1, () => ({
      scale: [1, 2, 1],
      rotation: [0, Math.PI / 2, 0],
    }))
    const matrix = new Matrix4()
    mesh.getMatrixAt(0, matrix)
    expect(matrix.elements[12]).toBeCloseTo(2)
    expect(matrix.elements[5]).toBeCloseTo(2)
    mesh.dispose()
  })
})
