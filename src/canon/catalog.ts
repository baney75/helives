import type { BookRecord, BookSlug, SiteRoute } from './types.ts'

/**
 * Phase one ships Genesis only. Later books join this list as live records.
 * Do not add greyed-out stubs for the unread canon.
 */
export const BOOKS: readonly BookRecord[] = [
  {
    slug: 'genesis',
    title: 'Genesis',
    testament: 'old',
    kind: 'interactive',
    status: 'live',
    href: '/genesis',
    summary: 'Creation through the Fall. Then a quiet look at what physics can measure.',
    hasAfterword: true,
  },
] as const

export const LIVE_BOOKS = BOOKS.filter((book) => book.status === 'live')

export function getBook(slug: string): BookRecord | undefined {
  return BOOKS.find((book) => book.slug === slug)
}

export function isBookSlug(value: string): value is BookSlug {
  return BOOKS.some((book) => book.slug === value)
}

export function parsePath(pathname: string): SiteRoute {
  const path = normalizePath(pathname)
  if (path === '/') return { kind: 'home' }
  if (path === '/faith') return { kind: 'faith' }
  const parts = path.slice(1).split('/')
  const slug = parts[0]
  if (!slug || !isBookSlug(slug)) return { kind: 'not-found' }
  const book = getBook(slug)
  if (!book || book.status !== 'live') return { kind: 'not-found' }
  return parseBookRest(book, parts.slice(1))
}

export function bookHref(slug: BookSlug): string {
  return `/${slug}`
}

export function chapterHref(slug: BookSlug, chapter: number): string {
  return `/${slug}/${chapter}`
}

export function afterwordHref(slug: BookSlug): string {
  return `/${slug}/afterword`
}

/** Reading books use /:book/:chapter later. Interactive Genesis stays a single tour. */
export function parseBookRest(book: BookRecord, rest: readonly string[]): SiteRoute {
  if (rest.length === 0) return { kind: 'book', slug: book.slug }
  const [first, ...more] = rest
  if (!first || more.length > 0) return { kind: 'not-found' }
  if (first === 'afterword' && book.hasAfterword) {
    return { kind: 'afterword', slug: book.slug }
  }
  if (book.kind === 'reading') {
    const chapter = parseChapter(first)
    if (chapter !== null) return { kind: 'chapter', slug: book.slug, chapter }
  }
  return { kind: 'not-found' }
}

export function parseChapter(raw: string): number | null {
  if (!/^[1-9]\d{0,2}$/.test(raw)) return null
  return Number(raw)
}

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
