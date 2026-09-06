import { withAudioRange } from './audioRange.ts'
import { isBlockedPath, isMissingStaticAsset, withSecurityHeaders } from './headers.ts'

export interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withSecurityHeaders(new Response('Method not allowed', { status: 405 }))
    }
    const url = new URL(request.url)
    if (isBlockedPath(url.pathname)) {
      return withSecurityHeaders(new Response('Not found', { status: 404 }))
    }
    const asset = await env.ASSETS.fetch(request)
    if (isMissingStaticAsset(url.pathname, asset.headers.get('content-type'))) {
      return withSecurityHeaders(new Response('Not found', { status: 404 }))
    }
    return withSecurityHeaders(await withAudioRange(request, asset))
  },
}
