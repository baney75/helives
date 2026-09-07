import type { SiteRoute } from '../canon/types.ts'

export type PageId = 'home' | 'faith' | 'scriptures' | 'genesis' | 'afterword' | 'not-found'

export function titleFor(page: PageId): string {
  switch (page) {
    case 'home':
      return 'He Lives'
    case 'faith':
      return 'Faith — He Lives'
    case 'scriptures':
      return 'The Scriptures — He Lives'
    case 'genesis':
      return 'Genesis — He Lives'
    case 'afterword':
      return 'Faith and the universe — He Lives'
    case 'not-found':
      return 'Not found — He Lives'
  }
}

/** Map a route to a page. New live books add a branch here; unread canon stays 404. */
export function pageFor(route: SiteRoute): PageId {
  switch (route.kind) {
    case 'home':
      return 'home'
    case 'faith':
      return 'faith'
    case 'scriptures':
      return 'scriptures'
    case 'book':
      return route.slug === 'genesis' ? 'genesis' : 'not-found'
    case 'afterword':
      return route.slug === 'genesis' ? 'afterword' : 'not-found'
    case 'chapter':
      return 'not-found'
    default:
      return 'not-found'
  }
}
