import { describe, expect, it } from 'vitest'
import { assertFullContextLinks, fullContextHref } from './fullContext.ts'
import { SCENES } from './scenes.ts'

describe('Genesis full-context links', () => {
  it('maps every Scripture scene to a safe Bible Gateway KJV passage', () => {
    expect(() => assertFullContextLinks()).not.toThrow()
    for (const scene of SCENES.filter((item) => item.kind === 'scripture')) {
      const url = new URL(fullContextHref(scene)!)
      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe('www.biblegateway.com')
      expect(url.searchParams.get('version')).toBe('KJV')
      expect(url.searchParams.get('search')).toMatch(/^Genesis /)
    }
  })

  it('does not give exhortation or science copy a Scripture link', () => {
    for (const scene of SCENES.filter((item) => item.kind !== 'scripture')) {
      expect(fullContextHref(scene)).toBeNull()
    }
  })
})
