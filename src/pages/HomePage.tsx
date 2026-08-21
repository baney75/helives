import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'
import { HourLamp } from '../word/HourLamp.tsx'

export function HomePage() {
  return (
    <div className="site lamp-home">
      <SiteNav current="home" />
      <main className="hero word-hero">
        <HourLamp />
      </main>
      <SiteFooter />
    </div>
  )
}
