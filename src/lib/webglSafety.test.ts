import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { disposeGeometry, disposeManualObject, disposeMaterial, guardWebGLContext } from './webglSafety.ts'

describe('guardWebGLContext', () => {
  it('prevents the default lost-context abort so the canvas can restore', () => {
    const canvas = new EventTarget() as EventTarget & HTMLCanvasElement
    const onLost = vi.fn()
    const onRestored = vi.fn()
    const release = guardWebGLContext(canvas, onLost, onRestored)
    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(onLost).toHaveBeenCalledTimes(1)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(onRestored).toHaveBeenCalledTimes(1)
    release()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(onLost).toHaveBeenCalledTimes(1)
  })
})

describe('dispose helpers', () => {
  it('disposes a manual mesh tree without throwing', () => {
    const geometry = new SphereGeometry(1, 6, 4)
    const material = new MeshBasicMaterial()
    const mesh = new Mesh(geometry, material)
    disposeManualObject(mesh, true)
    expect(geometry.hasAttribute('position')).toBe(true)
    const extra = new BufferGeometry()
    extra.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
    disposeGeometry(extra)
    disposeGeometry(null)
    disposeMaterial(null)
    disposeMaterial([new MeshBasicMaterial(), new MeshBasicMaterial()])
  })
})
