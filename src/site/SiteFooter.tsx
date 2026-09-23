export function SiteFooter() {
  return (
    <footer className="foot">
      <p>He Lives</p>
      <p>Scripture quoted from the King James Version, public domain in the United States.</p>
      <nav aria-label="Footer navigation">
        <a href="/scriptures">The Scriptures</a>
        {' · '}
        <a href="/genesis">Genesis</a>
        {' · '}
        <a href="/faith">Faith</a>
        {' · '}
        <a href="/genesis/afterword">Afterword</a>
        {' · '}
        <a href="https://github.com/baney75/helives">Source on GitHub</a>
      </nav>
    </footer>
  )
}
