// /audio/*: audiobook files from R2, with byte ranges so players can seek.
// Only keys under audio/ are served; the site links only files listed in audio/manifest.json.

const TYPES: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', json: 'application/json; charset=utf-8', vtt: 'text/vtt; charset=utf-8' }

export function audioKey(pathname: string): string | null {
  const m = pathname.match(/^\/audio\/([a-z0-9][a-z0-9/_.-]*\.(m4a|mp3|json|vtt))$/)
  if (!m || m[1]!.includes('..') || m[1]!.includes('//')) return null
  return `audio/${m[1]}`
}

export async function serveAudio(request: Request, bucket: R2Bucket | undefined, pathname: string): Promise<Response> {
  const key = audioKey(pathname)
  if (!key || !bucket) return new Response('Not found', { status: 404 })
  const range = request.headers.get('range')
  const obj = await bucket.get(key, { range: range ? request.headers : undefined, onlyIf: request.headers })
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'public, max-age=86400')
  const ext = key.split('.').pop() ?? ''
  if (!headers.get('content-type')) headers.set('content-type', TYPES[ext] ?? 'application/octet-stream')
  if (!('body' in obj)) return new Response(null, { status: 304, headers })
  const r = obj.range as { offset?: number; length?: number } | undefined
  if (range && r && typeof r.offset === 'number') {
    const length = r.length ?? obj.size - r.offset
    headers.set('content-range', `bytes ${r.offset}-${r.offset + length - 1}/${obj.size}`)
    headers.set('content-length', String(length))
    return new Response(request.method === 'HEAD' ? null : obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(obj.size))
  return new Response(request.method === 'HEAD' ? null : obj.body, { status: 200, headers })
}
