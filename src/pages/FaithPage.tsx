import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function FaithPage() {
  return (
    <div className="site">
      <SiteNav current="faith" />
      <main id="main-content" className="doc faith-doc">
        <h1>Faith</h1>
        <p className="faith-lead">Jesus Christ is Lord.</p>
        <p>
          He Lives is rooted in the Christian faith expressed in the Nicene Creed:
          one God, Father, Son, and Holy Spirit.
        </p>
        <p>
          Jesus Christ, the Son of God, became man for our salvation. He was crucified,
          rose from the dead, and will come again to judge the living and the dead.
        </p>
        <h2>Begin with Scripture</h2>
        <p>
          Read a Gospel. Take your time with the words of Jesus, His life, His death,
          and His resurrection. The Gospel of John is a good place to begin.
        </p>
        <p><a className="faith-reading-link" href="https://www.biblegateway.com/passage/?search=John%201&version=KJV" target="_blank" rel="noopener noreferrer">Read John 1<span className="sr-only"> on Bible Gateway, opens in a new tab</span></a></p>
        <h2>Find a local church</h2>
        <p>
          Find a church where Scripture is taught and Christ is worshipped. Pray with
          other Christians, ask questions, and learn to follow Him in daily life.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
