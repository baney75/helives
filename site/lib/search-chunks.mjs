// Splits the search load into files D1 accepts. One remote import of the whole 150 MB file resets the
// database (D1_RESET_DO), so the load runs as chunks of about 8 MB, the first holding the DROP and CREATE.

export const CHUNK_BYTES = 8_000_000
// Control characters (a stray NUL from a footnote marker) made D1 drop statements without an error.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/

export function assertClean(rows) {
  rows.forEach((r, i) => {
    const m = r.match(CONTROL)
    if (m) throw new Error(`search row ${i} has control character ${JSON.stringify(m[0])}: ${r.slice(0, 80)}`)
  })
}

// head: setup statements; stmts: INSERTs; tail: statements to run last. Returns the chunk texts in order.
export function chunkStatements(head, stmts, tail, max = CHUNK_BYTES) {
  const chunks = [head.join('\n') + '\n']
  let cur = []
  let size = 0
  for (const s of stmts) {
    if (size + s.length > max && cur.length) {
      chunks.push(cur.join('\n') + '\n')
      cur = []
      size = 0
    }
    cur.push(s)
    size += s.length + 1
  }
  if (cur.length) chunks.push(cur.join('\n') + '\n')
  if (tail.length) chunks.push(tail.join('\n') + '\n')
  return chunks
}
