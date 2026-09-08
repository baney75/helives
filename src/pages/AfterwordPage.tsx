import { COSMOLOGY_SOURCES } from '../genesis/sources.ts'
import { SiteFooter } from '../site/SiteFooter.tsx'
import { SiteNav } from '../site/SiteNav.tsx'

export function AfterwordPage() {
  const primary = COSMOLOGY_SOURCES.filter((source) => source.kind === 'primary')
  const commentary = COSMOLOGY_SOURCES.filter((source) => source.kind === 'commentary')

  return (
    <div className="site wide afterword">
      <SiteNav current="afterword" />
      <main id="main-content">
        <section className="doubt-hero" aria-labelledby="doubt-title">
          <div className="doubt-aperture" aria-hidden="true" />
          <p className="hero-kicker">After Genesis</p>
          <h1 id="doubt-title">Faith and the universe</h1>
          <p className="doubt-lead">
            Genesis begins with God as Creator. Cosmology studies how the universe has developed.
            This afterword sets those claims beside a small body of primary-source evidence.
          </p>
          <nav className="doubt-paths" aria-label="Ways to continue">
            <a href="/genesis?scene=beginning"><span>01</span> Read Genesis</a>
            <a href="#measure"><span>02</span> Read the evidence</a>
            <a href="/faith"><span>03</span> The Christian faith</a>
          </nav>
        </section>

        <section className="doubt-essay" id="measure">
          <div>
            <p className="hero-kicker">Scripture and measurement</p>
            <h2>What the sky can tell us</h2>
          </div>
          <div className="doubt-copy">
            <p>
              Genesis opens with a claim about God: “In the beginning God created the heaven and the earth.”
              It speaks of creation, human life, and our relation to God. Christians have long disagreed,
              in good faith, about how the days of creation should be understood.
            </p>
            <p>
              Cosmology begins elsewhere: with what instruments can observe. The universe is expanding.
              The cosmic microwave background is the oldest light we can observe. ESA’s Planck mission
              mapped that signal and helped test the standard cosmological model, which puts the universe’s
              age at about 13.8 billion years.
            </p>
            <p>
              These findings trace physical history. They do not answer every theological or philosophical
              question a reader brings to Genesis. The sources below explain the science; the opening chapters
              of Genesis are linked above.
            </p>
          </div>
        </section>

        <section className="source-ledger" aria-labelledby="source-title">
          <p className="hero-kicker">Further reading</p>
          <h2 id="source-title">Sources and further reading</h2>
          <div className="source-columns">
            <SourceList title="Science sources" sources={primary} />
            <SourceList title="Commentary" sources={commentary} />
          </div>
        </section>

        <div className="doubt-return">
          <a href="/genesis?scene=beginning">Return to Genesis</a>
          <a href="/scriptures">Open the Scriptures</a>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function SourceList({ title, sources }: { title: string; sources: typeof COSMOLOGY_SOURCES }) {
  return (
    <section>
      <h3>{title}</h3>
      <ul className="sources">
        {sources.map((source) => (
          <li key={source.id}>
            <a href={source.href} rel="noopener noreferrer">
              {source.title}
            </a>
            <span>{source.note}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
