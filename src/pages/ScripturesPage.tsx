import { useRef, useState } from 'react'
import { ARTWORKS, artworkUrl, type Artwork } from '../art/catalog.ts'
import { ArtViewer } from '../art/ArtViewer.tsx'
import { NEW_TESTAMENT, OLD_TESTAMENT, type CanonBook, type CanonDivision } from '../canon/scriptures.ts'
import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function ScripturesPage() {
  const [selectedArt, setSelectedArt] = useState<Artwork | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const openArt = (art: Artwork) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedArt(art)
  }
  const closeArt = () => {
    setSelectedArt(null)
    requestAnimationFrame(() => opener.current?.focus())
  }
  return (
    <div className="site wide">
      <SiteNav current="scriptures" />
      <main id="main-content" className="doc canon">
        <p className="hero-kicker">The whole canon</p>
        <h1>The Scriptures</h1>
        <p className="canon-intro">
          The whole Protestant canon, from Genesis to Revelation. Begin with Genesis 1–3,
          a narrated visual meditation. The remaining books are forthcoming.
        </p>
        <a className="btn" href="/genesis">Enter Genesis</a>
        <nav className="canon-jump" aria-label="Testaments">
          <a href="#old-testament">Old Testament</a>
          <a href="#new-testament">New Testament</a>
        </nav>
        <p className="canon-art-intro">660 illustrations, ten for each book. Open any artwork to explore the collection.</p>
        <h2 id="old-testament" className="canon-testament">Old Testament</h2>
        {OLD_TESTAMENT.map((division) => (
          <CanonSection key={division.id} division={division} onView={openArt} />
        ))}
        <h2 id="new-testament" className="canon-testament">New Testament</h2>
        {NEW_TESTAMENT.map((division) => (
          <CanonSection key={division.id} division={division} onView={openArt} />
        ))}
      </main>
      {selectedArt && <ArtViewer artwork={selectedArt} onClose={closeArt} />}
      <SiteFooter />
    </div>
  )
}

function CanonSection({ division, onView }: { division: CanonDivision; onView: (art: Artwork) => void }) {
  return (
    <section className="canon-division" aria-labelledby={`div-${division.id}`}>
      <h3 id={`div-${division.id}`}>{division.label}</h3>
      <ol className="canon-books">
        {division.books.map((book) => (
          <CanonRow key={book.id} book={book} onView={onView} />
        ))}
      </ol>
    </section>
  )
}

function CanonRow({ book, onView }: { book: CanonBook; onView: (art: Artwork) => void }) {
  const artwork = ARTWORKS.find(art => art.id === book.id)!
  const href = book.status === 'live' ? book.href : null
  return (
    <li className={href ? 'canon-book is-live' : 'canon-book'}>
      <button type="button" className="canon-art-preview" onClick={() => onView(artwork)} aria-label={`View artwork for ${book.title}`}><img src={artworkUrl(artwork)} width="160" height="100" alt="" loading="lazy" decoding="async" /><span>View artwork</span></button>
      {href ? (
        <a className="canon-book-title" href={href}>
          {book.title}
        </a>
      ) : (
        <span className="canon-book-title">{book.title}</span>
      )}
      <span className="canon-status">{book.status}</span>
      {book.note ? <p className="canon-note">{book.note}</p> : null}
    </li>
  )
}
