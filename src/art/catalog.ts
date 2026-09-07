import records from './catalog.json'
export const ARTWORKS = records
export type Artwork = typeof ARTWORKS[number]
export function artworkForPassage(reference: string): Artwork {
  const name = reference.replace(/\s+\d+:.*$/, '').toLowerCase().replaceAll(' ', '-')
  const id = name === 'psalm' ? 'psalms' : name
  return ARTWORKS.find(art => art.id === id) ?? ARTWORKS[0]!
}
export function artworkUrl(art: Artwork) { return `${import.meta.env.BASE_URL}art/scripture/${art.file}` }
