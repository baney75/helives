import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalFor, shapeSpaHtml, withoutConditionalsForRoutes } from '../../worker/pages.ts'

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const SITEMAP = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')

function spa(): Response {
  return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html', etag: '"x"' } })
}

describe('canonicalFor', () => {
  it('names every live route', () => {
    expect(canonicalFor('/')).toBe('https://helives.dev/')
    expect(canonicalFor('/genesis/')).toBe('https://helives.dev/genesis')
    expect(canonicalFor('/genesis/afterword')).toBe('https://helives.dev/genesis/afterword')
    expect(canonicalFor('/faith')).toBe('https://helives.dev/faith')
    expect(canonicalFor('/scriptures')).toBe('https://helives.dev/scriptures')
  })

  it('rejects routes the SPA renders as not found', () => {
    expect(canonicalFor('/exodus')).toBeNull()
    expect(canonicalFor('/genesis/1')).toBeNull()
    expect(canonicalFor('/nope/at/all')).toBeNull()
  })

  it('matches the sitemap exactly', () => {
    const locs = [...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs.length).toBeGreaterThan(0)
    for (const loc of locs) expect(canonicalFor(new URL(loc!).pathname)).toBe(loc)
  })
})

describe('shapeSpaHtml', () => {
  it('serves unknown paths with a real 404 and no canonical', async () => {
    const out = await shapeSpaHtml(new Request('https://helives.dev/missing'), spa())
    expect(out.status).toBe(404)
    const html = await out.text()
    expect(html).toContain('<div id="root">')
    expect(html).not.toContain('rel="canonical"')
  })

  it('gives known routes their own canonical and og:url', async () => {
    const out = await shapeSpaHtml(new Request('https://helives.dev/faith/'), spa())
    expect(out.status).toBe(200)
    expect(out.headers.get('etag')).toBeNull()
    const html = await out.text()
    expect(html).toContain('<link rel="canonical" href="https://helives.dev/faith" />')
    expect(html).toContain('<meta property="og:url" content="https://helives.dev/faith" />')
    expect(html).toContain('application/ld+json')
  })

  it('keeps the home canonical', async () => {
    const html = await (await shapeSpaHtml(new Request('https://helives.dev/'), spa())).text()
    expect(html).toContain('<link rel="canonical" href="https://helives.dev/" />')
  })

  it('answers HEAD with the same status and no body', async () => {
    const out = await shapeSpaHtml(new Request('https://helives.dev/missing', { method: 'HEAD' }), spa())
    expect(out.status).toBe(404)
    expect(out.body).toBeNull()
    expect(out.headers.get('etag')).toBeNull()
  })

  it('leaves non-HTML assets alone', async () => {
    const png = new Response('png', { status: 200, headers: { 'content-type': 'image/png' } })
    expect(await shapeSpaHtml(new Request('https://helives.dev/og.png'), png)).toBe(png)
  })
})

describe('withoutConditionalsForRoutes', () => {
  const conditional = { 'if-none-match': '"x"', 'if-modified-since': 'Thu, 01 Jan 2026 00:00:00 GMT' }

  it('strips validators from route requests so unknown routes cannot get a 304', () => {
    for (const path of ['/missing', '/genesis/2', '/faith', '/']) {
      const out = withoutConditionalsForRoutes(new Request(`https://helives.dev${path}`, { headers: conditional }))
      expect(out.headers.get('if-none-match')).toBeNull()
      expect(out.headers.get('if-modified-since')).toBeNull()
    }
  })

  it('keeps validators on real files', () => {
    const request = new Request('https://helives.dev/og.png', { headers: conditional })
    expect(withoutConditionalsForRoutes(request)).toBe(request)
  })
})
