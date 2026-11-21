// Loads build/search-chunks/*.sql into the D1 search table in order, then checks the row count.
// Usage: node scripts/load-search.mjs [--local]   (run node site/search-index.mjs first)
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DB = 'helives-library'
const where = process.argv.includes('--local') ? '--local' : '--remote'
const dir = join(ROOT, 'build', 'search-chunks')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const want = Number(readFileSync(join(ROOT, 'build', 'search.count'), 'utf8'))

const wrangler = (...args) =>
  spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', DB, where, '--yes', ...args], { cwd: ROOT, encoding: 'utf8' })

for (const f of files) {
  // A chunk is retried only when D1 refused it; a retry after a partial write would show in the count below.
  let r
  for (let t = 1; t <= 3; t++) {
    r = wrangler('--file', join(dir, f))
    if (r.status === 0) break
  }
  if (r.status !== 0) {
    console.error(`load-search: ${f} failed\n${r.stderr || r.stdout}`)
    process.exit(1)
  }
  console.log(`load-search: ${f} ok`)
}
const r = wrangler('--command', 'SELECT count(*) AS n FROM doc', '--json')
const got = JSON.parse(r.stdout)?.[0]?.results?.[0]?.n
if (got !== want) {
  console.error(`load-search: D1 holds ${got} rows, the index has ${want}. Rerun the load from 000.sql.`)
  process.exit(1)
}
console.log(`load-search: ${got} rows, matches the index`)
