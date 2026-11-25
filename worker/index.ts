import { serveAudio } from './audio.ts'
import { isBlockedPath, withSecurityHeaders } from './headers.ts'
import { search } from './search.ts'

export interface Env {
  ASSETS: Fetcher
  DB?: D1Database
  AUDIO?: R2Bucket
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withSecurityHeaders(new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } }))
    }
    const url = new URL(request.url)
    if (isBlockedPath(url.pathname)) {
      return withSecurityHeaders(new Response('Not found', { status: 404 }))
    }
    if (url.hostname === 'www.helives.dev') {
      url.hostname = 'helives.dev'
      return withSecurityHeaders(Response.redirect(url.toString(), 301))
    }
    if (url.pathname === '/api/search') {
      if (!env.DB) return withSecurityHeaders(new Response(JSON.stringify({ error: 'search offline', results: [] }), { status: 503, headers: { 'content-type': 'application/json' } }))
      return withSecurityHeaders(await search(env.DB, url))
    }
    if (url.pathname.startsWith('/audio/')) {
      return withSecurityHeaders(await serveAudio(request, env.AUDIO, url.pathname))
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}
