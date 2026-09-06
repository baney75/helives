import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function FaithPage() {
  return (
    <div className="site">
      <SiteNav current="faith" />
      <main id="main-content" className="doc">
        <p className="hero-kicker">Confession</p>
        <h1>Faith</h1>
        <p>
          He Lives holds the Nicene faith of the undivided church: one God, Father Almighty; one Lord Jesus
          Christ, the only-begotten Son, true God from true God, who for us men and for our salvation came
          down from heaven, was crucified, rose again, and will come to judge; and the Holy Ghost, the Lord
          and Giver of life. This is historic orthodoxy, not a new brand.
        </p>
        <p>
          The Bible quoted on this site is the King James Version, public domain in the United States. Later
          copyrighted translations are not used. Words that are not Scripture are marked as such.
        </p>
        <p>
          The home lamp shows one King James passage each hour. Genesis 1–3 remains a meditation. The
          Scriptures page names the whole Protestant canon. Unbuilt books are forthcoming, not pretend pages.
        </p>
        <p>
          He Lives is a reading project. It is not a church, a sacrament, or a claim that God endorsed this
          software. If you want to follow Christ, begin with one of the Gospels and find a faithful local church
          where Scripture is taught and honest questions receive patient attention.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
