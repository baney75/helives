// /audio/*: audiobook files from R2, with byte ranges so players can seek.
// Only keys under audio/ are served; the site links only files listed in audio/manifest.json.

const TYPES: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', json: 'application/json; charset=utf-8', vtt: 'text/vtt; charset=utf-8' }

export function audioKey(pathname: string): string | null {
  const m = pathname.match(/^\/audio\/([a-z0-9][a-z0-9/_.-]*\.(m4a|mp3|json|vtt))$/)
  if (!m || m[1]!.includes('..') || m[1]!.includes('//')) return null
  return `audio/${m[1]}`
}

type R2Range = { offset?: number; length?: number; suffix?: number }

/** The bytes R2 returned for a ranged get: an offset range (bytes=a-b, bytes=a-) or a suffix (bytes=-n). */
export function byteSpan(r: R2Range | undefined, size: number): { start: number; end: number } | null {
  if (!r || size <= 0) return null
  if (typeof r.suffix === 'number') {
    const n = Math.min(r.suffix, size)
    return n > 0 ? { start: size - n, end: size - 1 } : null
  }
  if (typeof r.offset === 'number') {
    const length = Math.min(r.length ?? size - r.offset, size - r.offset)
    return length > 0 ? { start: r.offset, end: r.offset + length - 1 } : null
  }
  return null
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
  // No body means a precondition failed: If-None-Match or If-Modified-Since is a 304, If-Match or
  // If-Unmodified-Since is a 412.
  if (!('body' in obj)) {
    const strict = request.headers.has('if-match') || request.headers.has('if-unmodified-since')
    return new Response(null, { status: strict ? 412 : 304, headers })
  }
  const span = range ? byteSpan(obj.range as R2Range | undefined, obj.size) : null
  if (span) {
    headers.set('content-range', `bytes ${span.start}-${span.end}/${obj.size}`)
    headers.set('content-length', String(span.end - span.start + 1))
    return new Response(request.method === 'HEAD' ? null : obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(obj.size))
  return new Response(request.method === 'HEAD' ? null : obj.body, { status: 200, headers })
}

/** Static assets answer every request in full, and Safari plays media only from byte ranges: cut the range here. */
export async function withRange(request: Request, res: Response): Promise<Response> {
  const m = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
  const headers = new Headers(res.headers)
  headers.set('accept-ranges', 'bytes')
  if (res.status !== 200 || !m || (!m[1] && !m[2])) return new Response(res.body, { status: res.status, headers })
  const body = await res.arrayBuffer()
  const span = byteSpan(m[1] ? { offset: Number(m[1]), length: m[2] ? Number(m[2]) - Number(m[1]) + 1 : undefined } : { suffix: Number(m[2]) }, body.byteLength)
  if (!span) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${body.byteLength}` } })
  headers.set('content-range', `bytes ${span.start}-${span.end}/${body.byteLength}`)
  headers.set('content-length', String(span.end - span.start + 1))
  return new Response(request.method === 'HEAD' ? null : body.slice(span.start, span.end + 1), { status: 206, headers })
}
