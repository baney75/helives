import { describe, expect, it } from 'vitest'
import { CSP, isBlockedPath, withSecurityHeaders } from './headers.ts'

describe('isBlockedPath', () => {
  it('blocks secret and scanner bait', () => {
    expect(isBlockedPath('/.env')).toBe(true)
    expect(isBlockedPath('/.git/config')).toBe(true)
    expect(isBlockedPath('/wp-admin')).toBe(true)
    expect(isBlockedPath('/foo/../.env')).toBe(true)
  })

  it('allows the public site', () => {
    expect(isBlockedPath('/')).toBe(false)
    expect(isBlockedPath('/genesis')).toBe(false)
    expect(isBlockedPath('/faith')).toBe(false)
    expect(isBlockedPath('/genesis/afterword')).toBe(false)
    expect(isBlockedPath('/audio/day1.mp3')).toBe(false)
  })
})

describe('withSecurityHeaders', () => {
  it('sets CSP and framing defenses', () => {
    const out = withSecurityHeaders(new Response('ok'))
    expect(out.headers.get('Content-Security-Policy')).toBe(CSP)
    expect(out.headers.get('X-Frame-Options')).toBe('DENY')
    expect(out.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(out.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(out.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
    expect(CSP).toContain("object-src 'none'")
    expect(CSP).toContain("form-action 'none'")
  })
})
