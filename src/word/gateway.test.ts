import { describe, expect, it } from 'vitest'
import { bibleGatewayHref } from './gateway.ts'
import { POOL } from './pool.ts'

describe('bibleGatewayHref', () => {
  it('forces the KJV and encodes a ranged Pauline ref', () => {
    const href = bibleGatewayHref('1 Corinthians 15:3-4')
    const url = new URL(href)
    expect(url.origin + url.pathname).toBe('https://www.biblegateway.com/passage/')
    expect(url.searchParams.get('version')).toBe('KJV')
    expect(url.searchParams.get('search')).toBe('1 Corinthians 15:3-4')
  })

  it('builds a live href for every pool row', () => {
    for (const passage of POOL) {
      const href = bibleGatewayHref(passage.gatewayQuery)
      expect(href).toContain('version=KJV')
      expect(href).toContain(encodeURIComponent(passage.gatewayQuery).replace(/%20/g, '+'))
    }
  })
})
