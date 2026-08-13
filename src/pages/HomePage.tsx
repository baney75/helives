import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function HomePage() {
  return (
    <div className="site">
      <SiteNav />
      <main className="hero">
        <p className="hero-kicker">He Lives</p>
        <h1>He Lives</h1>
        <p className="hero-verse">because I live, ye shall live also.</p>
        <p className="hero-cite">John 14:19 · King James Version</p>
        <p className="hero-lead">
          Scripture first. Genesis is the first work: creation through the Fall, then a quiet look at what
          instruments can measure. The rest of the canon, in time.
        </p>
        <p className="hero-actions">
          <a className="btn" href="/genesis">
            Enter Genesis
          </a>
          <a className="btn quiet" href="/faith">
            Faith
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
