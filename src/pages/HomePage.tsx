import { BrandMark } from '../site/BrandMark.tsx'
import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function HomePage() {
  return (
    <div className="site">
      <SiteNav current="home" />
      <main className="hero">
        <p className="hero-mark">
          <BrandMark size={48} framed />
        </p>
        <h1>He Lives</h1>
        <p className="hero-verse">because I live, ye shall live also.</p>
        <p className="hero-cite">John 14:19 · King James Version</p>
        <p className="hero-lead">
          The whole Bible, cover to cover. Genesis is live: creation through the Fall, then a quiet look at
          what instruments can measure. The law, the genealogies, and the prophets are Scripture. They wait
          their turn. They are not skipped.
        </p>
        <p className="hero-actions">
          <a className="btn" href="/genesis">
            Enter Genesis
          </a>
          <a className="btn quiet" href="/scriptures">
            The Scriptures
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
