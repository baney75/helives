import { COSMOLOGY_SOURCES } from '../genesis/sources.ts'
import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function AfterwordPage() {
  const primary = COSMOLOGY_SOURCES.filter((source) => source.kind === 'primary')
  const commentary = COSMOLOGY_SOURCES.filter((source) => source.kind === 'commentary')

  return (
    <div className="site">
      <SiteNav current="afterword" />
      <main className="doc">
        <p className="hero-kicker">After Genesis</p>
        <h1>Got doubt?</h1>
        <p>
          Genesis remains first here. “In the beginning God created the heaven and the earth.” What follows is
          not a replacement for that sentence, and not a dunk on scientists. It is a look at what physics can
          currently describe.
        </p>
        <p>
          In 1927 Georges Lemaître, a Belgian priest and physicist, argued that the universe expands from an
          early dense state. NASA’s public pages still name him when they explain the Big Bang in plain words.
          Hubble then showed that distant galaxies recede. That is history of measurement, not a slogan that
          “the Church invented the Big Bang.”
        </p>
        <p>
          In 1964–65 Arno Penzias and Robert Wilson found leftover microwave noise with a Bell Labs horn in
          New Jersey. It was the cosmic microwave background: heat from when the universe first became
          transparent, now about 2.7 K. They received the Nobel Prize in Physics in 1978. ESA’s Planck later
          mapped that glow in fine detail. Under the standard ΛCDM model, the age is near 13.8 billion years.
          NASA states that figure in its education pages. Much remains unknown: inflation’s cause, dark matter,
          dark energy.
        </p>
        <p>
          A Christian may read those pages without treating Genesis as a lab notebook, and without treating
          the lab as a god. Measurement is a gift. It does not dethrone the Word.
        </p>
        <h2>Primary pages</h2>
        <ul className="sources">
          {primary.map((source) => (
            <li key={source.id}>
              <a href={source.href} rel="noopener noreferrer">
                {source.title}
              </a>
              <span> — {source.note}</span>
            </li>
          ))}
        </ul>
        <h2>Commentary, not a paper</h2>
        <ul className="sources">
          {commentary.map((source) => (
            <li key={source.id}>
              <a href={source.href} rel="noopener noreferrer">
                {source.title}
              </a>
              <span> — {source.note}</span>
            </li>
          ))}
        </ul>
        <p>
          <a href="/genesis">Return to Genesis</a>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
