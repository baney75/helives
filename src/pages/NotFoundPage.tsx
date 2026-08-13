import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function NotFoundPage() {
  return (
    <div className="site">
      <SiteNav />
      <main className="doc">
        <h1>Not found</h1>
        <p>
          That page is not here. Genesis is the book that is live. The rest of the canon, in time.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
