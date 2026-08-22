import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'
import { HourLamp } from '../word/HourLamp.tsx'

type HomePageProps = {
  now?: Date
}

export function HomePage({ now }: HomePageProps) {
  return (
    <div className="site lamp-home">
      <SiteNav current="home" />
      <main className="hero word-hero">
        <HourLamp now={now} />
      </main>
      <SiteFooter />
    </div>
  )
}
