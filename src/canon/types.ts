/** Grow this union when a book ships. Do not pre-list unread canon. */
export type BookSlug = 'genesis'

export type BookKind = 'interactive' | 'reading'

export type BookStatus = 'live' | 'forthcoming'

export type BookRecord = {
  slug: BookSlug
  title: string
  testament: 'old' | 'new'
  kind: BookKind
  status: BookStatus
  href: string
  summary: string
  hasAfterword: boolean
}

export type SiteRoute =
  | { kind: 'home' }
  | { kind: 'faith' }
  | { kind: 'book'; slug: BookSlug }
  | { kind: 'chapter'; slug: BookSlug; chapter: number }
  | { kind: 'afterword'; slug: BookSlug }
  | { kind: 'not-found' }
