// Builds the static library into dist/. Usage: node site/build.mjs [--only bible|<work-id>]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { collectionBundles } from './lib/bundles.mjs'
import { evidenceHub, evidencePart, partUrl } from './lib/evidence.mjs'
import { ASSET_VERSION, SITE } from './lib/layout.mjs'
import { COLLECTIONS, ROOT, loadLibrary, readToml, tagIndex } from './lib/load.mjs'
import * as P from './lib/pages.mjs'
import { bookSlug, pageUrl, workUrl } from './lib/render.mjs'

const DIST = join(ROOT, 'dist')
const ASSETS = join(ROOT, 'site', 'assets')
// Files in public/ that belonged to the old Genesis app and are not shipped.
const PUBLIC_SKIP = new Set(['audio', 'models', 'stills', 'sitemap.xml'])
const FEATURED = ['augustine-confessions', 'athanasius-on-the-incarnation', 'summa-theologica', 'first-clement', 'didache', 'irenaeus-against-heresies']

const t0 = Date.now()
let pages = 0
const urls = []

function out(path, body) {
  const file = path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body)
  if (path.endsWith('/')) {
    pages++
    if (!body.includes('name="robots" content="noindex"')) urls.push(path)
  }
}

function assetVersion() {
  const h = createHash('sha256')
  for (const f of readdirSync(ASSETS).sort()) h.update(readFileSync(join(ASSETS, f)))
  return h.digest('hex').slice(0, 10)
}

function copyFonts() {
  const dst = join(DIST, 'fonts')
  mkdirSync(dst, { recursive: true })
  const fs = join(ROOT, 'node_modules', '@fontsource')
  const map = [
    ['opendyslexic/files/opendyslexic-latin-400-normal.woff2', 'opendyslexic-latin-400.woff2'],
    ['opendyslexic/files/opendyslexic-latin-700-normal.woff2', 'opendyslexic-latin-700.woff2'],
  ]
  const ssv = join(ROOT, 'node_modules', '@fontsource-variable', 'source-serif-4', 'files')
  for (const f of ['source-serif-4-latin-wght-normal.woff2', 'source-serif-4-latin-wght-italic.woff2']) copyFileSync(join(ssv, f), join(dst, f))
  const atv = join(ROOT, 'node_modules', '@fontsource-variable', 'atkinson-hyperlegible-next', 'files')
  for (const f of ['atkinson-hyperlegible-next-latin-wght-normal.woff2', 'atkinson-hyperlegible-next-latin-wght-italic.woff2']) copyFileSync(join(atv, f), join(dst, f))
  for (const [src, name] of map) copyFileSync(join(fs, src), join(dst, name))
  for (const lic of ['opendyslexic']) {
    const l = join(fs, lic, 'LICENSE')
    if (existsSync(l)) copyFileSync(l, join(dst, `OFL-${lic}.txt`))
  }
}

function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
  rmSync(DIST, { recursive: true, force: true })
  mkdirSync(DIST, { recursive: true })
  ASSET_VERSION.v = assetVersion()

  // static files
  for (const name of readdirSync(join(ROOT, 'public'))) {
    if (PUBLIC_SKIP.has(name)) continue
    cpSync(join(ROOT, 'public', name), join(DIST, name), { recursive: true })
  }
  cpSync(ASSETS, join(DIST, 'assets'), { recursive: true })
  copyFonts()
  if (existsSync(join(ROOT, 'media', 'files'))) cpSync(join(ROOT, 'media', 'files'), join(DIST, 'media'), { recursive: true })

  const lib = loadLibrary()
  const ctx = {
    ...lib,
    byId: new Map(lib.works.map((w) => [w.id, w])),
    bibleBooks: lib.works.filter((w) => w.collection === 'bible').sort((a, b) => a.book_number - b.book_number),
    worksByAuthor: new Map(),
    mediaById: new Map([...lib.media.images, ...lib.media.maps].map((m) => [m.id, m])),
    tags: {
      images: tagIndex(lib.media.images.map((m) => ({ ...m, kind: m.kind || 'art' }))),
      maps: tagIndex(lib.media.maps.map((m) => ({ ...m, kind: 'map' }))),
      videos: tagIndex(lib.media.videos),
      articles: tagIndex(lib.media.articles),
    },
  }
  ctx.media.maps = ctx.media.maps.map((m) => ({ ...m, kind: 'map' }))
  ctx.media.images = ctx.media.images.map((m) => ({ ...m, kind: m.kind || 'art' }))
  ctx.featured = FEATURED.map((id) => ctx.byId.get(id)).filter(Boolean)
  for (const w of lib.works) {
    if (!ctx.worksByAuthor.has(w.author)) ctx.worksByAuthor.set(w.author, [])
    ctx.worksByAuthor.get(w.author).push(w)
  }

  // works
  const dl = join(DIST, 'dl')
  mkdirSync(dl, { recursive: true })
  for (const w of lib.works) {
    if (only && only !== w.id && !(only === 'bible' && w.collection === 'bible')) continue
    const doc = readToml(w.path)
    w.pages.forEach((_, i) => out(pageUrl(w, w.pages[i]), P.readerPage(ctx, w, doc, i)))
    if (w.collection === 'bible') out(workUrl(w), P.bookPage(ctx, w))
    else if (w.pages.length > 1) out(workUrl(w), P.workTocPage(ctx, w))
    out(w.collection === 'bible' ? `/bible/${bookSlug(w)}/print/` : `/read/${w.id}/print/`, P.printPage(ctx, w, doc))
    copyFileSync(w.path, join(dl, `${w.id}.toml`))
    const md = w.path.replace(/\.toml$/, '.md')
    if (!existsSync(md)) execFileSync('python3', [join(ROOT, 'pipeline', 'render_md.py'), w.path], { stdio: 'ignore' })
    copyFileSync(md, join(dl, `${w.id}.md`))
  }
  // whole Bible in one file each
  const books = ctx.bibleBooks
  if (books.length) {
    writeFileSync(join(dl, 'bsb-complete.md'), books.map((b) => readFileSync(b.path.replace(/\.toml$/, '.md'), 'utf8')).join('\n\n'))
    writeFileSync(join(dl, 'bsb-complete.toml'), books.map((b) => `# ${b.title}\n` + readFileSync(b.path, 'utf8').replace(/^\[work\]/m, '[[work]]').replace(/^\[\[section\]\]/gm, '[[work.section]]')).join('\n'))
  }

  // whole collections as zips (full builds only; they take about a minute)
  if (!only) ctx.bundles = collectionBundles(DIST)

  // index pages
  out('/', P.homePage(ctx))
  out('/bible/', P.bibleIndex(ctx))
  for (const c of COLLECTIONS) {
    if (c.id === 'bible') continue
    if (c.id === 'encyclicals') out('/encyclicals/', P.encyclicalsPage(ctx))
    else if (lib.works.some((w) => w.collection === c.id)) out(P.colHref(c.id), P.collectionPage(ctx, c.id))
  }
  out('/authors/', P.authorsIndex(ctx))
  for (const a of Object.values(lib.authors)) if (ctx.worksByAuthor.get(a.id)?.length && a.id !== 'bible') out(`/authors/${a.id}/`, P.authorPage(ctx, a))
  out('/videos/', P.videosPage(ctx))
  out('/articles/', P.articlesPage(ctx))
  if (ctx.evidence) {
    out('/evidence/', evidenceHub(ctx))
    ctx.evidence.parts.forEach((p, i) => out(partUrl(p), evidencePart(ctx, i)))
  }
  if (ctx.miracles) out('/miracles/', P.miraclesPage(ctx))
  out('/maps/', P.galleryPage(ctx, 'maps'))
  out('/art/', P.galleryPage(ctx, 'art'))
  out('/search/', P.searchPage(ctx))
  out('/about/', P.aboutPage(ctx))
  out('/accessibility/', P.accessibilityPage(ctx))
  out('/downloads/', P.downloadsPage(ctx))
  out('/404.html', P.notFoundPage())

  // search data for the client: book names and abbreviations for reference parsing
  out('/assets/books.json', JSON.stringify(books.map((b) => ({ s: bookSlug(b), t: b.title, a: b.short_title, c: b.chapters }))))
  out('/opensearch.xml', `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><ShortName>He Lives</ShortName><Description>Search Scripture and the church fathers</Description><InputEncoding>UTF-8</InputEncoding><Image width="32" height="32" type="image/png">${SITE}/favicon-32.png</Image><Url type="text/html" template="${SITE}/search/?q={searchTerms}"/></OpenSearchDescription>
`)
  out('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`)
  out('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)

  console.log(`build: ${pages} pages, ${lib.works.length} works, ${((Date.now() - t0) / 1000).toFixed(1)}s, assets v=${ASSET_VERSION.v}`)
}

main()
