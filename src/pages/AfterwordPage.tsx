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
            Genesis begins with God as the creator of heaven and earth. Modern cosmology studies
            how the universe has developed. Here are the opening text and a few sources to read alongside it.
          </p>
          <nav className="doubt-paths" aria-label="Ways to continue">
            <a href="/genesis?scene=beginning"><span>01</span> Read Genesis</a>
            <a href="#measure"><span>02</span> Examine evidence</a>
            <a href="/faith"><span>03</span> The Christian faith</a>
          </nav>
        </section>

        <section className="doubt-essay" id="measure">
          <div>
            <p className="hero-kicker">Scripture and measurement</p>
            <h2>Creation and cosmic history</h2>
          </div>
          <div className="doubt-copy">
            <p>
              Genesis opens with a claim about God: “In the beginning God created the heaven and the earth.”
              Its opening chapters tell of creation, human life, and our relationship with God.
              Christians have long discussed how to understand the days of creation.
            </p>
            <p>
              The scientific account draws on observations of the expanding universe and the cosmic microwave
              background, the oldest light we can observe. Measurements from ESA’s Planck mission support
              an age of about 13.8 billion years within the standard cosmological model.
            </p>
            <p>
              Those findings help describe the universe’s physical history. Questions about why there is a
              universe, who God is, and how we should live also involve philosophy and theology.
              The sources below explain the science; the opening chapters of Genesis are linked above.
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
