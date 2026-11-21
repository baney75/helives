// Bible reference parsing, shared by the search page and the tests.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// What the search page does with a query: go straight to a passage ("John 3:16", "ps 23"), or search,
// offering the book as a link when the query is a bare book name ("John" may mean John Chrysostom).
export function refAction(q, bks) {
  const url = parseRef(q, bks)
  if (!url) return { search: true }
  return /\d\s*$/.test(q.trim()) ? { go: url } : { search: true, book: url }
}

// "John 3:16", "jn 3", "1 cor 13:4-7", "Psalm 23", "song 2" -> a URL, or null.
export function parseRef(q, bks) {
  const m = q.trim().match(/^([1-3]?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*\d+)?)?\s*$/i)
  if (!m) {
    const only = norm(q)
    const b = only.length >= 3 && bks.find((x) => norm(x.t) === only)
    return b ? `/bible/${b.s}/` : null
  }
  const name = norm(m[1])
  if (name.length < 2) return null
  const aliases = { ps: 'psalms', psalm: 'psalms', pss: 'psalms', song: 'songofsolomon', sos: 'songofsolomon', canticles: 'songofsolomon', jn: 'john', mk: 'mark', mt: 'matthew', lk: 'luke', jdg: 'judges', phil: 'philippians', phm: 'philemon', jas: 'james', rev: 'revelation', revelations: 'revelation' }
  const want = aliases[name] || name
  const b = bks.find((x) => norm(x.t) === want) || bks.find((x) => norm(x.a || '') === want) || bks.find((x) => norm(x.t).startsWith(want))
  if (!b) return null
  const ch = Number(m[2])
  if (ch < 1 || ch > b.c) return null
  return `/bible/${b.s}/${ch}/${m[3] ? `#v${Number(m[3])}` : ''}`
}
