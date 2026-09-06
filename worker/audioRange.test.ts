import { expect, it } from 'vitest'
import { withAudioRange } from './audioRange.ts'
const asset = () => new Response('0123456789', { headers: { 'content-type': 'audio/mpeg', etag: 'v1' } })
it('serves exact closed, open and suffix byte ranges', async () => {
  for (const [range, content, expected] of [['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=8-', '89', 'bytes 8-9/10'], ['bytes=-3', '789', 'bytes 7-9/10']] as const) {
    const response = await withAudioRange(new Request('https://helives.dev/audio/fall.mp3', { headers: { range } }), asset())
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(expected)
    expect(await response.text()).toBe(content)
  }
})
it('rejects unsatisfiable ranges and respects If-Range', async () => {
  const request = new Request('https://helives.dev/audio/fall.mp3', { headers: { range: 'bytes=20-' } })
  expect((await withAudioRange(request, asset())).status).toBe(416)
  const stale = new Request(request, { headers: { range: 'bytes=2-5', 'if-range': 'old' } })
  const response = await withAudioRange(stale, asset())
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('0123456789')
})
