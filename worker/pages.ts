import { normalizePath, parsePath } from '../src/canon/catalog.ts'
import { pageFor } from '../src/site/router.ts'

export const ORIGIN = 'https://helives.dev'

/** Canonical URL for a client route, or null when the SPA would render its not-found page. */
export function canonicalFor(pathname: string): string | null {
  if (pageFor(parsePath(pathname)) === 'not-found') return null
  const path = normalizePath(pathname)
  return path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`
}

const CANONICAL_TAG = /<link rel="canonical" href="[^"]*" \/>/
const OG_URL_TAG = /<meta property="og:url" content="[^"]*" \/>/

/**
 * The asset layer answers every unknown path with index.html and a 200. Give routes the SPA does
 * not know a real 404, and give known routes their own canonical and og:url.
 */
export async function shapeSpaHtml(request: Request, response: Response): Promise<Response> {
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) {
    return response
  }
  const url = new URL(request.url)
  const canonical = canonicalFor(url.pathname)
  const headers = new Headers(response.headers)
  // The body differs per route, so index.html's validators would describe the wrong bytes.
  headers.delete('content-length')
  headers.delete('etag')
  headers.delete('last-modified')
  if (request.method === 'HEAD') {
    return new Response(null, { status: canonical ? 200 : 404, headers })
  }
  const html = await response.text()
  if (!canonical) {
    return new Response(html.replace(CANONICAL_TAG, ''), { status: 404, headers })
  }
  const body = html
    .replace(CANONICAL_TAG, `<link rel="canonical" href="${canonical}" />`)
    .replace(OG_URL_TAG, `<meta property="og:url" content="${canonical}" />`)
  return new Response(body, { status: 200, headers })
}

/**
 * Client routes have no file extension. Drop conditional headers on them so the asset layer can
 * never answer an unknown route with a 304 built from index.html's validators.
 */
export function withoutConditionalsForRoutes(request: Request): Request {
  const last = new URL(request.url).pathname.split('/').pop() ?? ''
  if (last.includes('.')) return request
  if (!request.headers.has('if-none-match') && !request.headers.has('if-modified-since')) return request
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  return new Request(request, { headers })
}
