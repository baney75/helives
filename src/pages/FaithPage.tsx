import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function FaithPage() {
  return (
    <div className="site">
      <SiteNav current="faith" />
      <main id="main-content" className="doc faith-doc">
        <header className="faith-heading">
          <div><p className="hero-kicker">He Lives</p><h1>Jesus Christ<br />is Lord.</h1><p className="faith-lead">He was crucified. He is risen. He will come again.</p></div>
          <img src="/art/scripture/john.svg" alt="" width="1600" height="1000" decoding="async" />
        </header>
        <p>
          The God who made the world has not abandoned it. Jesus Christ, the Son of God,
          became man for our salvation. He bore our sins on the cross and rose from the
          dead. Our hope rests in Him.
        </p>
        <blockquote className="faith-scripture">
          <p>For I delivered unto you first of all that which I also received, how that Christ died for our sins according to the scriptures;
            And that he was buried, and that he rose again the third day according to the scriptures:</p>
          <cite><a href="https://www.biblegateway.com/passage/?search=1+Corinthians+15%3A3-4&version=KJV" target="_blank" rel="noopener noreferrer">1 Corinthians 15:3–4 · KJV</a></cite>
        </blockquote>
        <p>
          He Lives confesses the Christian faith expressed in the Nicene Creed:
          one God, Father, Son, and Holy Spirit. This site is an invitation to hear
          His Word, turn to Christ, and follow Him.
        </p>
        <h2>Receive the grace of God</h2>
        <blockquote className="faith-scripture">
          <p>For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:
            Not of works, lest any man should boast.</p>
          <cite><a href="https://www.biblegateway.com/passage/?search=Ephesians+2%3A8-10&version=KJV" target="_blank" rel="noopener noreferrer">Ephesians 2:8–9 · KJV</a></cite>
        </blockquote>
        <p>
          Come to Christ with your sins, your questions, and your need for mercy.
          Repent and believe the Gospel. Pray honestly. Read what He has said.
        </p>
        <h2>Open the Scriptures</h2>
        <p>
          Begin with the Gospel of John. Read a chapter slowly. Attend to what Jesus
          says and does, to His death and resurrection, and to His call to believe.
          Return to the words themselves.
        </p>
        <p><a className="faith-reading-link" href="https://www.biblegateway.com/passage/?search=John%201&version=KJV" target="_blank" rel="noopener noreferrer">Read John 1<span className="sr-only"> on Bible Gateway, opens in a new tab</span></a></p>
        <h2>Worship with His people</h2>
        <p>
          Find a faithful local church where Scripture is taught and Jesus Christ is
          worshipped. Hear the Word preached. Pray with other Christians. Seek wise
          counsel, serve your neighbor, and learn to follow Him in daily life.
        </p>
        <nav className="faith-path" aria-label="Continue reading">
          <a href="/genesis">Begin Genesis 1–3 <span aria-hidden="true">→</span></a>
          <a href="/scriptures">Open the Scriptures</a>
        </nav>
      </main>
      <SiteFooter />
    </div>
  )
}
