import { SCENES, type SceneId } from '../genesis/scenes.ts'

export type AppMode = {
  cinematic: boolean
  pause: boolean
  progress: number | null
}

export function readAppMode(search: string): AppMode {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const progress = parseProgress(params.get('progress'))
  const scene = SCENES.find((item) => item.id === params.get('scene'))
  return {
    cinematic: params.has('cinematic') || mode === 'cinematic',
    pause: params.has('pause'),
    progress: progress ?? scene?.start ?? null,
  }
}

/** Builds a stable scene link while retaining quality and cinematic settings. */
export function sceneUrl(search: string, scene: SceneId, paused: boolean): string {
  const params = new URLSearchParams(search)
  params.set('scene', scene)
  params.delete('progress')
  if (paused) params.set('pause', '1')
  else params.delete('pause')
  const query = params.toString()
  return `/genesis${query ? `?${query}` : ''}`
}

export function parseProgress(raw: string | null): number | null {
  if (raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}
