import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function FaithPage() {
  return (
    <div className="site">
      <SiteNav current="faith" />
      <main className="doc">
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
          This release is Genesis 1–3 through the Fall, with a closing invitation to church and to live for
          Jesus Christ, then an afterword on modern cosmology. The Scriptures page names the whole Protestant
          canon. Only Genesis is built. The other books are forthcoming, not pretend pages.
        </p>
        <p>
          This site is not a church, not a sacrament, and not a claim that God endorsed the software. Go to
          church. Hear the Word. Live for Jesus Christ.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
