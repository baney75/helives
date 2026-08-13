export type AppMode = {
  cinematic: boolean
  pause: boolean
  progress: number | null
}

export function readAppMode(search: string): AppMode {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  return {
    cinematic: params.has('cinematic') || mode === 'cinematic',
    pause: params.has('pause'),
    progress: parseProgress(params.get('progress')),
  }
}

export function parseProgress(raw: string | null): number | null {
  if (raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}
