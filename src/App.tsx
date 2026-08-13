import { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react'
import { parsePath } from './canon/catalog.ts'
import { AfterwordPage } from './pages/AfterwordPage.tsx'
import { FaithPage } from './pages/FaithPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { pageFor } from './site/router.ts'
import { Calibrating } from './ui/Calibrating.tsx'

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

  return (
    <div onClick={(event) => handleSiteClick(event, setHref)}>
      {page === 'home' ? <HomePage /> : null}
      {page === 'faith' ? <FaithPage /> : null}
      {page === 'genesis' ? (
        <Suspense fallback={<Calibrating />}>
          <GenesisPage />
        </Suspense>
      ) : null}
      {page === 'afterword' ? <AfterwordPage /> : null}
      {page === 'not-found' ? <NotFoundPage /> : null}
    </div>
  )
}

function handleSiteClick(event: MouseEvent<HTMLDivElement>, setHref: (href: string) => void): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest('a')
  if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  if (anchor.target && anchor.target !== '_self') return
  const next = new URL(anchor.href, window.location.origin)
  if (next.origin !== window.location.origin) return
  event.preventDefault()
  const href = `${next.pathname}${next.search}`
  window.history.pushState({}, '', href)
  setHref(href)
}
