import { describe, expect, it } from 'vitest'
import { CSP, isBlockedPath, isMissingStaticAsset, withSecurityHeaders } from './headers.ts'

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
    expect(isBlockedPath('/scriptures')).toBe(false)
    expect(isBlockedPath('/genesis/afterword')).toBe(false)
    expect(isBlockedPath('/audio/day1.mp3')).toBe(false)
  })
})

describe('isMissingStaticAsset', () => {
  it('rejects SPA HTML served as an mp3', () => {
    expect(isMissingStaticAsset('/audio/day6.mp3', 'text/html')).toBe(true)
    expect(isMissingStaticAsset('/audio/day1.mp3', 'audio/mpeg')).toBe(false)
    expect(isMissingStaticAsset('/genesis', 'text/html')).toBe(false)
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

it('prevents injected HTML scripts while preserving existing cache semantics', () => {
  const html = withSecurityHeaders(new Response('html', { headers: { 'content-type': 'text/html', 'cache-control': 'private, max-age=0' } }))
  expect(html.headers.get('cache-control')).toBe('private, max-age=0, no-transform')
  expect(html.headers.get('content-security-policy')).toBe(CSP)
  const twice = withSecurityHeaders(html)
  expect(twice.headers.get('cache-control')).toBe('private, max-age=0, no-transform')
  const audio = withSecurityHeaders(new Response('audio', { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=3600' } }))
  expect(audio.headers.get('cache-control')).toBe('public, max-age=3600')
})
