/** Serve bounded narration byte ranges so browsers can seek before downloading a full clip. */
export async function withAudioRange(request: Request, response: Response): Promise<Response> {
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('audio/mpeg')) return response
  const headers = new Headers(response.headers)
  headers.set('Accept-Ranges', 'bytes')
  const range = request.headers.get('range')
  const validator = request.headers.get('if-range')
  const matchesValidator = !validator || validator === headers.get('etag') || validator === headers.get('last-modified')
  const match = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (request.method !== 'GET' || !match || !matchesValidator || (!match[1] && !match[2])) {
    return new Response(response.body, { status: response.status, headers })
  }
  const bytes = await response.arrayBuffer()
  const size = bytes.byteLength
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
    headers.set('Content-Range', `bytes */${size}`)
    headers.set('Content-Length', '0')
    return new Response(null, { status: 416, headers })
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  return new Response(bytes.slice(start, end + 1), { status: 206, headers })
}
