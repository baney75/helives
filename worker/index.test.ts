import { describe, expect, it } from 'vitest'
import { audioKey } from './audio.ts'
import { CSP, isBlockedPath, withSecurityHeaders } from './headers.ts'
import worker from './index.ts'
import { toFtsQuery } from './search.ts'

describe('isBlockedPath', () => {
  it('blocks secret and scanner bait', () => {
    expect(isBlockedPath('/.env')).toBe(true)
    expect(isBlockedPath('/.git/config')).toBe(true)
    expect(isBlockedPath('/wp-admin')).toBe(true)
    expect(isBlockedPath('/foo/../.env')).toBe(true)
  })
  it('allows the library', () => {
    for (const p of ['/', '/bible/john/3/', '/read/augustine-confessions/', '/search/', '/audio/bsb-john/3.m4a']) expect(isBlockedPath(p)).toBe(false)
  })
})

describe('security headers', () => {
  it('sets CSP and framing defenses', () => {
    const out = withSecurityHeaders(new Response('ok'))
    expect(out.headers.get('Content-Security-Policy')).toBe(CSP)
    expect(out.headers.get('X-Frame-Options')).toBe('DENY')
    expect(out.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(out.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
  })
  it('allows only what the library needs from outside', () => {
    expect(CSP).toMatch(/script-src 'self' https:\/\/static\.cloudflareinsights\.com;/)
    expect(CSP).toContain('frame-src https://www.youtube-nocookie.com;')
    expect(CSP).toContain('img-src \'self\' data: blob: https://i.ytimg.com;')
    expect(CSP).toContain("form-action 'self'")
    expect(CSP).toContain("object-src 'none'")
    expect(CSP).not.toContain('unsafe-eval')
    expect(CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(CSP).not.toContain('youtube.com ') // only the no-cookie domain
  })
})

describe('toFtsQuery', () => {
  it('quotes every term so reader input cannot become FTS5 syntax', () => {
    expect(toFtsQuery('grace')).toBe('"grace"*')
    expect(toFtsQuery('love your enemies')).toBe('"love your enemies" OR ("love" AND "your" AND "enemies"*)')
    expect(toFtsQuery('"in the beginning" word')).toBe('"in the beginning" AND "word"*')
    expect(toFtsQuery('NEAR(a b) OR col:x -y ^z')).toBe('"near a b or col x y z" OR ("near" AND "a" AND "b" AND "or" AND "col" AND "x" AND "y" AND "z")')
    expect(toFtsQuery('  ')).toBeNull()
    expect(toFtsQuery('"""')).toBeNull()
  })
  it('keeps short last words exact and caps the length', () => {
    expect(toFtsQuery('is')).toBe('"is"')
    expect(toFtsQuery('a '.repeat(500))!.split(' AND ').length).toBeLessThanOrEqual(12)
    expect(toFtsQuery('a '.repeat(500))).not.toContain(' OR ')
  })
})

describe('audioKey', () => {
  it('maps only audio file paths', () => {
    expect(audioKey('/audio/bsb-john/3.m4a')).toBe('audio/bsb-john/3.m4a')
    expect(audioKey('/audio/bsb-john/3.json')).toBe('audio/bsb-john/3.json')
    expect(audioKey('/audio/../secret.m4a')).toBeNull()
    expect(audioKey('/audio/x.exe')).toBeNull()
    expect(audioKey('/audio/a//b.m4a')).toBeNull()
  })
})

describe('worker routing', () => {
  const assets = { fetch: async () => new Response('page', { headers: { 'content-type': 'text/html' } }) } as unknown as Fetcher
  it('redirects www to the apex', async () => {
    const r = await worker.fetch(new Request('https://www.helives.dev/bible/'), { ASSETS: assets })
    expect(r.status).toBe(301)
    expect(r.headers.get('location')).toBe('https://helives.dev/bible/')
  })
  it('refuses writes', async () => {
    const r = await worker.fetch(new Request('https://helives.dev/', { method: 'POST' }), { ASSETS: assets })
    expect(r.status).toBe(405)
  })
  it('says search is offline when D1 is not bound', async () => {
    const r = await worker.fetch(new Request('https://helives.dev/api/search?q=grace'), { ASSETS: assets })
    expect(r.status).toBe(503)
  })
  it('404s audio when R2 is not bound, never serving a page as audio', async () => {
    const r = await worker.fetch(new Request('https://helives.dev/audio/bsb-john/3.m4a'), { ASSETS: assets })
    expect(r.status).toBe(404)
  })
  it('serves pages with security headers', async () => {
    const r = await worker.fetch(new Request('https://helives.dev/bible/'), { ASSETS: assets })
    expect(await r.text()).toBe('page')
    expect(r.headers.get('Content-Security-Policy')).toBe(CSP)
  })
})
