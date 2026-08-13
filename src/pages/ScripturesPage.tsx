import { NEW_TESTAMENT, OLD_TESTAMENT, type CanonBook, type CanonDivision } from '../canon/scriptures.ts'
import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function ScripturesPage() {
  return (
    <div className="site wide">
      <SiteNav current="scriptures" />
      <main className="doc canon">
        <p className="hero-kicker">The whole canon</p>
        <h1>The Scriptures</h1>
        <p>
          Cover to cover. Genesis is the book that is live. Every other book is named here because it is
          Scripture: the law, the genealogies, the minor prophets. None of it is filler. None of it is skipped.
        </p>
        <p>King James titles. Forthcoming means not built yet, not optional.</p>
        <h2 className="canon-testament">Old Testament</h2>
        {OLD_TESTAMENT.map((division) => (
          <CanonSection key={division.id} division={division} />
        ))}
        <h2 className="canon-testament">New Testament</h2>
        {NEW_TESTAMENT.map((division) => (
          <CanonSection key={division.id} division={division} />
        ))}
      </main>
      <SiteFooter />
    </div>
  )
}

function CanonSection({ division }: { division: CanonDivision }) {
  return (
    <section className="canon-division" aria-labelledby={`div-${division.id}`}>
      <h3 id={`div-${division.id}`}>{division.label}</h3>
      <ol className="canon-books">
        {division.books.map((book) => (
          <CanonRow key={book.id} book={book} />
        ))}
      </ol>
    </section>
  )
}

function CanonRow({ book }: { book: CanonBook }) {
  const href = book.status === 'live' ? book.href : null
  return (
    <li className={href ? 'canon-book is-live' : 'canon-book'}>
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
