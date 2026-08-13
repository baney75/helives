import { describe, expect, it } from 'vitest'
import { InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from 'three'
import { writeInstanceMatrices } from './instances.ts'

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
