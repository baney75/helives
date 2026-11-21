// /api/search: full-text search over the library in D1 (SQLite FTS5).
// The table is built by site/search-index.mjs: doc(title, body, url, place, scope, rank_boost).

export const SCOPES: Record<string, string[]> = {
  all: [],
  bible: ['bible'],
  apocrypha: ['apocrypha', 'pseudepigrapha'],
  history: ['jewish'],
  fathers: ['apostolic', 'ante-nicene', 'nicene'],
  medieval: ['medieval'],
  aquinas: ['aquinas'],
  reformation: ['reformation'],
  creeds: ['creeds'],
  gnostic: ['gnostic'],
  encyclicals: ['encyclicals'],
  media: ['media'],
}

export const LIMIT = 50

/**
 * Turn what a reader types into a safe FTS5 query. Every term is quoted, so no FTS5 syntax a reader
 * types can change the query's meaning or raise an error. "Quoted phrases" stay phrases. The last bare
 * word also matches as a prefix, so "resurrec" finds "resurrection".
 */
export function toFtsQuery(input: string): string | null {
  const q = input.normalize('NFKC').slice(0, 200)
  const parts: string[] = []
  const phrase = /"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = phrase.exec(q))) {
    const words = tokens(m[1] ?? '')
    if (words.length) parts.push(`"${words.join(' ')}"`)
  }
  const rest = tokens(q.replace(phrase, ' '))
  rest.forEach((w, i) => parts.push(i === rest.length - 1 && w.length >= 3 ? `"${w}"*` : `"${w}"`))
  if (!parts.length) return null
  const all = parts.slice(0, 12).join(' AND ')
  // Several bare words: rows holding them as an exact phrase also match the phrase, so they rank first.
  if (rest.length >= 2 && rest.length === parts.length && rest.length <= 12) return `"${rest.join(' ')}" OR (${all})`
  return all
}

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).map((w) => w.replace(/’/g, "'").replace(/"/g, ''))
}

interface Row {
  title: string
  url: string
  place: string
  snip: string
}

export async function search(db: D1Database, url: URL): Promise<Response> {
  const q = url.searchParams.get('q') ?? ''
  const scope = url.searchParams.get('scope') ?? 'all'
  const fts = toFtsQuery(q)
  const scopes = SCOPES[scope] ?? []
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' }
  if (!fts) return new Response(JSON.stringify({ results: [], limit: LIMIT }), { headers })
  const where = scopes.length ? `AND scope IN (${scopes.map(() => '?').join(',')})` : ''
  const sql = `SELECT title, url, place, snippet(doc, 1, char(2), char(3), '…', 28) AS snip
    FROM doc WHERE doc MATCH ? ${where}
    ORDER BY bm25(doc, 4.0, 1.0) * boost LIMIT ${LIMIT}`
  try {
    const { results } = await db.prepare(sql).bind(fts, ...scopes).all<Row>()
    const out = results.map((r) => ({ title: r.title, url: r.url, where: r.place, snip: r.snip }))
    return new Response(JSON.stringify({ results: out, limit: LIMIT }), { headers })
  } catch {
    return new Response(JSON.stringify({ error: 'search failed', results: [], limit: LIMIT }), { status: 500, headers: { ...headers, 'cache-control': 'no-store' } })
  }
}
