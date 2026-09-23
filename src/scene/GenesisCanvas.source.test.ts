import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const canvas = readFileSync(resolve('src/scene/GenesisCanvas.tsx'), 'utf8')
const page = readFileSync(resolve('src/pages/GenesisPage.tsx'), 'utf8')
const pkg = readFileSync(resolve('package.json'), 'utf8')

describe('retained 3D authoring source and active 2D route', () => {
  it('retains performance guards in the legacy renderer', () => {
    expect(canvas).toMatch(/PerformanceMonitor/)
    expect(canvas).toMatch(/AdaptiveEvents/)
    expect(canvas).toMatch(/AdaptiveDpr/)
    expect(canvas).toMatch(/Preload/)
    expect(canvas).toMatch(/demoteQuality/)
  })

  it('loads the illustrated route without importing WebGL or GPU detection', () => {
    expect(page).toMatch(/import\('\.\.\/scene\/GenesisIllustration\.tsx'\)/)
    expect(page).not.toMatch(/GenesisCanvas|react-three|useAutoQuality|detect-gpu/)
    expect(page).toMatch(/audioHold/)
    expect(page).toMatch(/narration\.hold/)
  })

  it('guards WebGL context loss and does not keep the drawing buffer', () => {
    expect(canvas).toMatch(/guardWebGLContext/)
    expect(canvas).toMatch(/webglcontextlost|onLost/)
    expect(canvas).toMatch(/preserveDrawingBuffer: false/)
    expect(canvas).toMatch(/class CanvasErrorBoundary/)
    expect(canvas).toMatch(/Retry 3D scene/)
    expect(canvas).not.toMatch(/preserveDrawingBuffer: true/)
  })

  it('does not add scroll, debug, or icon-font libraries', () => {
    expect(pkg).not.toMatch(/@react-spring\/three/)
    expect(pkg).not.toMatch(/lenis/)
    expect(pkg).not.toMatch(/leva/)
    expect(pkg).not.toMatch(/@splinetool/)
    expect(pkg).not.toMatch(/lucide-react/)
    expect(canvas).not.toMatch(/lucide/i)
  })
})
