import type { SiteRoute } from '../canon/types.ts'

export type PageId = 'home' | 'faith' | 'genesis' | 'afterword' | 'not-found'

/** Map a route to a page. New live books add a branch here; unread canon stays 404. */
export function pageFor(route: SiteRoute): PageId {
  switch (route.kind) {
    case 'home':
      return 'home'
    case 'faith':
      return 'faith'
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
