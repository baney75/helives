import { describe, expect, it } from 'vitest'
import { COSMOLOGY_SOURCES } from './sources.ts'

describe('COSMOLOGY_SOURCES', () => {
  it('keeps primary science distinct from commentary', () => {
    const primary = COSMOLOGY_SOURCES.filter((s) => s.kind === 'primary')
    const commentary = COSMOLOGY_SOURCES.filter((s) => s.kind === 'commentary')
    expect(primary.length).toBeGreaterThanOrEqual(4)
    expect(commentary).toHaveLength(1)
    expect(commentary[0]?.href).toContain('ncregister.com')
  })

  it('uses https official hosts', () => {
    for (const source of COSMOLOGY_SOURCES) {
      expect(source.href.startsWith('https://')).toBe(true)
    }
  })
})
