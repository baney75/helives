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
