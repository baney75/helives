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
          <p className="hero-kicker">An honest question</p>
          <h1 id="doubt-title">Got doubt?</h1>
          <p className="doubt-lead">
            You do not have to pretend certainty. Name the question clearly, read Scripture carefully, and
            examine the evidence. Speak with Christians who will listen before they answer.
          </p>
          <nav className="doubt-paths" aria-label="Ways to continue">
            <a href="/genesis?scene=beginning"><span>01</span> Read Genesis</a>
            <a href="#measure"><span>02</span> Examine evidence</a>
            <a href="/faith"><span>03</span> What Christians confess</a>
          </nav>
        </section>

        <section className="doubt-essay" id="measure">
          <div>
            <p className="hero-kicker">Scripture and measurement</p>
            <h2>Read the text. Examine the evidence.</h2>
          </div>
          <div className="doubt-copy">
            <p>
              Genesis opens with a claim about God: “In the beginning God created the heaven and the earth.”
              Science studies measurable features of the physical world. These are different kinds of inquiry,
              and both deserve careful reading.
            </p>
            <p>
              Georges Lemaître, a Belgian priest and physicist, argued for an expanding universe from an early
              dense state. Penzias and Wilson later detected the cosmic microwave background. ESA’s Planck
              mission mapped that ancient light in fine detail. The standard ΛCDM model places the universe’s
              age near 13.8 billion years.
            </p>
            <p>
              These measurements describe the physical history we can observe. They do not settle the
              theological questions Genesis asks about God, creation, human beings, sin, and responsibility.
            </p>
          </div>
        </section>

        <section className="source-ledger" aria-labelledby="source-title">
          <p className="hero-kicker">Read beyond this page</p>
          <h2 id="source-title">Sources and further reading</h2>
          <div className="source-columns">
            <SourceList title="Primary pages" sources={primary} />
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
