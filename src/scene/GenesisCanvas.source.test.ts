import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const canvas = readFileSync(resolve('src/scene/GenesisCanvas.tsx'), 'utf8')
const page = readFileSync(resolve('src/pages/GenesisPage.tsx'), 'utf8')
const pkg = readFileSync(resolve('package.json'), 'utf8')

describe('device-aware Genesis canvas', () => {
  it('uses drei performance tools already in the tree', () => {
    expect(canvas).toMatch(/PerformanceMonitor/)
    expect(canvas).toMatch(/AdaptiveEvents/)
    expect(canvas).toMatch(/AdaptiveDpr/)
    expect(canvas).toMatch(/Preload/)
    expect(canvas).toMatch(/demoteQuality/)
    expect(page).toMatch(/effectsAllowed/)
    expect(page).toMatch(/onQualityFallback/)
    expect(page).toMatch(/audioHold/)
    expect(page).toMatch(/narration\.hold/)
  })

  it('guards WebGL context loss and does not keep the drawing buffer', () => {
    expect(canvas).toMatch(/guardWebGLContext/)
    expect(canvas).toMatch(/webglcontextlost|onLost/)
    expect(canvas).toMatch(/preserveDrawingBuffer: false/)
    expect(canvas).toMatch(/class SceneGate/)
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
