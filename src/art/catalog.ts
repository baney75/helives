import records from './catalog.json'
import library from './library.json'
import passages from './passage-art.json'
export type Artwork = {
  id: string
  bookId: string
  bookTitle: string
  title: string
  file: string
  family: string
  palette: string
  weather: string
  horizon: number
  ref?: string
}

/** One representative artwork per canonical book; retain this small list for the Scriptures index. */
export const ARTWORKS: readonly Artwork[] = records.map(art => ({ ...art, bookId: art.id }))
/** The browseable collection: ten scenes for each of the Protestant canon's 66 books. */
export const LIBRARY: readonly Artwork[] = ARTWORKS.flatMap(book => library.filter(art => art.bookId === book.id))
export const PASSAGE_ARTWORKS: readonly Artwork[] = passages.map(art => ({ ...art, bookId: bookIdForReference(art.ref) }))

function bookIdForReference(reference: string) {
  const name = reference.replace(/\s+\d+:.*$/, '').toLowerCase().replaceAll(' ', '-')
  return name === 'psalm' ? 'psalms' : name
}

export function scenesForBook(bookId: string): readonly Artwork[] {
  return LIBRARY.filter(art => art.bookId === bookId)
}

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  }
  return result >>> 0
}

const PASSAGES_PER_ROTATION = 48

/**
 * The first view uses its exact-reference illustration when available. Later reading visits
 * deterministically range over that book's ten-scene collection without fetching every SVG.
 */
export function artworkForPassage(reference: string, sequence = 0, epoch = 0): Artwork {
  const bookId = bookIdForReference(reference)
  const scenes = scenesForBook(bookId)
  const exact = scenes.find(art => art.ref === reference) ?? PASSAGE_ARTWORKS.find(art => art.ref === reference)
  if (sequence === 0) return exact ?? scenes.find(art => art.id === bookId) ?? ARTWORKS.find(art => art.id === bookId) ?? ARTWORKS[0]!
  if (scenes.length) {
    // A passage returns every 48 readings. A coprime stride reaches every one of its ten
    // scenes across ten visits instead of repeating only the even or odd positions.
    const visit = Math.floor(sequence / PASSAGES_PER_ROTATION)
    const exactIndex = scenes.findIndex(art => art.id === exact?.id)
    const start = exactIndex >= 0 ? exactIndex : hash(`${reference}:${epoch}`) % scenes.length
    const stride = [1, 3, 7, 9][hash(`${reference}:${epoch}`) % 4]!
    return scenes[(start + Math.max(visit, 0) * stride) % scenes.length]!
  }
  return exact ?? ARTWORKS.find(art => art.id === bookId) ?? ARTWORKS[0]!
}
export function artworkUrl(art: Artwork) { return `${import.meta.env.BASE_URL}art/scripture/${art.file}` }
