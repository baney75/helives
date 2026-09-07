import { SCENES, type Scene, type SceneId } from './scenes.ts'

const PASSAGES: Readonly<Partial<Record<SceneId, string>>> = {
  beginning: 'Genesis 1:1-2', day1: 'Genesis 1:3-4', day2: 'Genesis 1:6-8',
  day3: 'Genesis 1:9-13', day4: 'Genesis 1:14-19', day5: 'Genesis 1:20-23',
  day6: 'Genesis 1:24-31', day7: 'Genesis 2:1-3', garden: 'Genesis 2:8-17', fall: 'Genesis 3:1-23',
}

export function fullContextHref(scene: Scene): string | null {
  if (scene.kind !== 'scripture') return null
  const passage = PASSAGES[scene.id]
  if (!passage) return null
  const params = new URLSearchParams({ search: passage, version: 'KJV' })
  return `https://www.biblegateway.com/passage/?${params.toString()}`
}

export function assertFullContextLinks(scenes: readonly Scene[] = SCENES): void {
  for (const scene of scenes) {
    if (scene.kind !== 'scripture') continue
    const href = fullContextHref(scene)
    if (!href) throw new Error(`Missing full-context link for ${scene.id}`)
    const url = new URL(href)
    if (url.protocol !== 'https:' || url.hostname !== 'www.biblegateway.com' ||
      url.pathname !== '/passage/' || url.searchParams.get('version') !== 'KJV') {
      throw new Error(`Unsafe KJV full-context link for ${scene.id}`)
    }
  }
}
