import { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react'
import { parsePath } from './canon/catalog.ts'
import { AfterwordPage } from './pages/AfterwordPage.tsx'
import { FaithPage } from './pages/FaithPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ScripturesPage } from './pages/ScripturesPage.tsx'
import { pageFor, titleFor } from './site/router.ts'
import { Calibrating } from './ui/Calibrating.tsx'
import { MusicProvider } from './music/MusicProvider.tsx'

const GenesisPage = lazy(async () => {
  const mod = await import('./pages/GenesisPage.tsx')
  return { default: mod.GenesisPage }
})

export function App() {
  const [href, setHref] = useState(() => window.location.pathname + window.location.search)

  useEffect(() => {
    const onPop = () => setHref(window.location.pathname + window.location.search)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const url = new URL(href, window.location.origin)
  const page = pageFor(parsePath(url.pathname))

  useEffect(() => {
    document.title = titleFor(page)
    const main = document.querySelector<HTMLElement>('main')
    if (main) {
      main.tabIndex = -1
      main.focus({ preventScroll: true })
    }
  }, [page])

  return (
    <MusicProvider quiet={page === 'genesis'}>
    <div onClick={(event) => handleSiteClick(event, setHref)}>
      {page === 'home' ? <HomePage /> : null}
      {page === 'faith' ? <FaithPage /> : null}
      {page === 'scriptures' ? <ScripturesPage /> : null}
      {page === 'genesis' ? (
        <Suspense fallback={<Calibrating />}>
          <GenesisPage />
        </Suspense>
      ) : null}
      {page === 'afterword' ? <AfterwordPage /> : null}
      {page === 'not-found' ? <NotFoundPage /> : null}
    </div>
    </MusicProvider>
  )
}

function handleSiteClick(event: MouseEvent<HTMLDivElement>, setHref: (href: string) => void): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest('a')
  if (!(anchor instanceof HTMLAnchorElement)) return
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  if (anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
  const next = new URL(anchor.href, window.location.origin)
  if (next.origin !== window.location.origin) return
  // Keep native fragment navigation, including skip links and essay sections.
  if (next.hash) return
  event.preventDefault()
  const href = `${next.pathname}${next.search}`
  window.history.pushState({}, '', href)
  setHref(href)
  window.scrollTo(0, 0)
}
