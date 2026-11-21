import { esc, html, number, plain, raw, readingTime } from './html.mjs'
import { icon } from './icons.mjs'
import { page } from './layout.mjs'
import { COLLECTION, COLLECTIONS } from './load.mjs'
import { bookSlug, notesHtml, pageLabel, pageUrl, renderSections, sectionUrl, workUrl } from './render.mjs'

const OT_DIVISIONS = [
  ['The Law', 1, 5], ['History', 6, 17], ['Poetry and Wisdom', 18, 22], ['Major Prophets', 23, 27], ['Minor Prophets', 28, 39],
]
const NT_DIVISIONS = [['Gospels', 40, 43], ['History', 44, 44], ["Paul's Letters", 45, 57], ['General Letters', 58, 65], ['Prophecy', 66, 66]]

const HOME = { title: 'Library', href: '/' }
export const colHref = (id) => `/${COLLECTION[id].route}/`
const colCrumb = (id) => ({ title: COLLECTION[id].short, href: colHref(id) })

// ---------- shared pieces ----------

function ytCard(v, { title = true } = {}) {
  return html`<button class="yt" type="button" data-yt="${v.id}" aria-label="Play video: ${v.title}">
<img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">
<span class="play">${raw(icon('play', 14))} Play</span></button>${title ? html`<a class="vid-title" href="${v.url}" rel="noopener">${v.title}</a>` : ''}`
}

function figure(img, { big = false } = {}) {
  return html`<figure class="figure"><a href="/${img.kind === 'map' ? 'maps' : 'art'}/#${img.id}"><img src="${img.file}" alt="${img.alt}" width="${img.width}" height="${img.height}" loading="lazy" decoding="async"></a>
<figcaption>${img.title}${img.artist ? html`, ${img.artist}` : ''}${img.year ? html` (${img.year})` : ''}${big ? html`. <a href="${img.source_page}" rel="noopener">Source</a>` : ''}</figcaption></figure>`
}

// Related media for a set of tags, most specific tag first.
function related(ctx, tags) {
  const pick = (index) => {
    const seen = new Set()
    const out = []
    for (const t of tags) for (const it of index.get(t) || []) if (!seen.has(it.id ?? it.url)) { seen.add(it.id ?? it.url); out.push(it) }
    return out
  }
  return { images: pick(ctx.tags.images), maps: pick(ctx.tags.maps), videos: pick(ctx.tags.videos), articles: pick(ctx.tags.articles) }
}

function rail(ctx, tags, { downloads = [] } = {}) {
  const r = related(ctx, tags)
  const parts = []
  if (r.videos.length) parts.push(html`<h2>Watch</h2>${r.videos.slice(0, 2).map((v) => ytCard(v))}`)
  if (r.images.length) parts.push(html`<h2>Art</h2>${r.images.slice(0, 3).map((i) => figure(i))}`)
  if (r.maps.length) parts.push(html`<h2>Maps</h2>${r.maps.slice(0, 2).map((i) => figure(i))}`)
  if (r.articles.length) parts.push(html`<h2>Read more</h2><ul>${r.articles.slice(0, 4).map((a) => html`<li><a href="${a.url}" rel="noopener">${a.title}</a> <span class="muted">${a.publisher}</span></li>`)}</ul>`)
  if (downloads.length) parts.push(html`<h2>Download and print</h2><ul>${downloads.map((d) => html`<li><a href="${d.href}"${d.dl ? raw(' download') : ''}>${d.label}</a></li>`)}</ul>`)
  return html`<aside class="rail" aria-label="Related">${parts}</aside>`
}

function toolsRow({ prev, next, printHref, listen }) {
  // Desktop row under the title, and the phone dock at the bottom. Same controls, same order.
  const listenBtn = listen
    ? html`<button class="tool" type="button" data-listen="${listen.playlist}" aria-pressed="false">${raw(icon('play'))}<span class="lbl">Listen</span></button>`
    : ''
  const desk = html`<div class="desk-tools no-print">${listenBtn}<button class="tool" type="button" data-print="${printHref || ''}">${raw(icon('print'))}<span class="lbl">Print</span></button></div>`
  const dock = html`<nav class="dock no-print" aria-label="Page controls">
${prev ? html`<a class="tool" href="${prev.href}" rel="prev">${raw(icon('prev'))}<span class="lbl">Back</span></a>` : html`<span class="tool" aria-disabled="true">${raw(icon('prev'))}<span class="lbl">Back</span></span>`}
${listen ? html`<button class="tool" type="button" data-listen="${listen.playlist}" aria-pressed="false">${raw(icon('play'))}<span class="lbl">Listen</span></button>` : ''}
<button class="tool" type="button" data-open="settings">${raw(icon('type'))}<span class="lbl">Reading</span></button>
<button class="tool" type="button" data-open="sounds">${raw(icon('sound'))}<span class="lbl">Sound</span></button>
${next ? html`<a class="tool" href="${next.href}" rel="next">${raw(icon('next'))}<span class="lbl">Next</span></a>` : html`<span class="tool" aria-disabled="true">${raw(icon('next'))}<span class="lbl">Next</span></span>`}
</nav>`
  return { desk, dock }
}

function pager(prev, next) {
  return html`<nav class="pager no-print" aria-label="Previous and next">
${prev ? html`<a href="${prev.href}" rel="prev">${raw(icon('prev'))}<span>${prev.title}</span></a>` : ''}
${next ? html`<a class="next" href="${next.href}" rel="next"><span>${next.title}</span>${raw(icon('next'))}</a>` : ''}
</nav>`
}

function tocList(w, current) {
  const bible = w.collection === 'bible'
  let list = w.pages
  let more = false
  if (list.length > 60) {
    const i = list.indexOf(current)
    list = list.slice(Math.max(0, i - 25), i + 35)
    more = true
  }
  return html`<nav class="toc no-print" aria-label="Contents"><p class="kicker">${bible ? w.title : html`<a href="${workUrl(w)}">Contents</a>`}</p><ol>${list.map(
    (p) => html`<li><a href="${pageUrl(w, p)}"${p === current ? raw(' aria-current="page"') : ''}>${bible ? w.sections[p.from].title : pageLabel(w, p)}</a></li>`,
  )}</ol>${more ? html`<p class="meta"><a href="${workUrl(w)}">All contents</a></p>` : ''}</nav>`
}

function downloadsFor(w) {
  return [
    { href: `/dl/${w.id}.md`, label: 'Markdown (.md)', dl: true },
    { href: `/dl/${w.id}.toml`, label: 'TOML data (.toml)', dl: true },
    { href: w.collection === 'bible' ? `/bible/${bookSlug(w)}/print/` : `/read/${w.id}/print/`, label: 'Print the whole book' },
  ]
}

// Every section on the page that has audio, in reading order. A page with none gets no Listen button.
function audioFor(ctx, w, p) {
  const list = []
  for (let i = p.from; i < p.to; i++) {
    const sid = String(w.sections[i].id)
    const e = ctx.audio.get(`${w.id}/${sid}`)
    if (e) list.push({ s: sid, src: e.url, t: e.timing || '' })
  }
  return list.length ? { playlist: JSON.stringify(list) } : null
}

const authorName = (ctx, key) => ctx.authors[key]?.name || key

// ---------- home ----------

export function homePage(ctx) {
  const cols = COLLECTIONS.map((c) => {
    const works = ctx.works.filter((w) => w.collection === c.id)
    const meta = ctx.collections[c.id]
    if (!works.length && c.id !== 'encyclicals') return ''
    const words = works.reduce((a, w) => a + w.words, 0)
    let list
    if (c.id === 'bible') {
      const firsts = ['genesis', 'psalms', 'isaiah', 'matthew', 'john', 'romans']
      list = firsts.map((s) => works.find((w) => bookSlug(w) === s)).filter(Boolean).map((w) => html`<li><a href="${workUrl(w)}">${w.title}</a></li>`)
    } else if (c.id === 'encyclicals') {
      list = []
    } else {
      // Authors in this collection, by first appearance
      const seen = []
      for (const w of works) if (ctx.authors[w.author]?.name && w.author !== 'church' && !seen.includes(w.author)) seen.push(w.author)
      list = seen.length
        ? seen.slice(0, 8).map((a) => html`<li><a href="/authors/${a}/">${authorName(ctx, a)}</a></li>`)
        : works.slice(0, 8).map((w) => html`<li><a href="${workUrl(w)}">${w.short_title || w.title}</a></li>`)
    }
    const count = c.id === 'encyclicals' ? `${number(ctx.encyclicals.length)} encyclicals` : c.id === 'bible' ? `66 books · ${number(words)} words` : `${number(works.length)} works · ${number(words)} words`
    return html`<div class="shelf"><h3><a href="${colHref(c.id)}">${c.title}</a></h3>
<p>${meta?.summary || ''} <span class="count">${count}</span></p>${list.length ? html`<ul>${list}</ul>` : ''}</div>`
  })
  const total = ctx.works.reduce((a, w) => a + w.words, 0)
  const begin = [
    ['bsb-john', null, 'The Gospel of John'],
    ['bsb-psalms', null, 'The Psalms'],
    ['bsb-romans', null, 'Romans'],
  ]
    .map(([id, , label]) => {
      const w = ctx.byId.get(id)
      return w ? html`<li><a href="${workUrl(w)}">${label}</a><span class="sub">Holy Scripture</span></li>` : ''
    })
    .concat(
      ctx.featured.map((w) => html`<li><a href="${workUrl(w)}">${w.short_title || w.title}</a><span class="sub">${authorName(ctx, w.author)}</span></li>`),
    )
  const body = html`<div class="wrap">
<div class="hero"><h1>${raw('<svg class="mark" viewBox="0 0 16 16" aria-hidden="true"><rect x="7" y="2" width="2" height="12" fill="currentColor"/><rect x="3" y="5" width="10" height="2" fill="currentColor"/><rect x="7" y="5" width="2" height="2" fill="var(--dawn)"/></svg>')}He Lives</h1>
<p>A free library of Holy Scripture and the writings of the church, made to be easy to read, hear, print and keep.</p>
<form class="searchbox" action="/search/" role="search"><label class="vh" for="q">Search the library</label><input id="q" name="q" type="search" placeholder="Search a verse, a word, a father" autocomplete="off"><button class="btn" type="submit">${raw(icon('search'))}<span>Search</span></button></form>
<p class="continue" id="continue" hidden>Continue reading: <a href="/"></a></p>
<p class="meta">${number(ctx.works.length)} works · ${number(total)} words · all public domain</p>
</div>
<section aria-labelledby="lib-h"><div class="sec-head"><h2 id="lib-h">The library</h2><a href="/authors/">All authors by date</a></div>
<div class="shelves">${cols}</div></section>
<section aria-labelledby="begin-h"><div class="sec-head"><h2 id="begin-h">Begin here</h2></div><ul class="list">${begin}</ul></section>
<section aria-labelledby="ex-h"><div class="sec-head"><h2 id="ex-h">Explore</h2></div>
<ul class="list">
<li><a href="/videos/">Videos</a><span class="meta">${number(ctx.media.videos.length)} lectures and overviews</span></li>
<li><a href="/maps/">Maps</a><span class="meta">${number(ctx.media.maps.length)} maps</span></li>
<li><a href="/art/">Art</a><span class="meta">${number(ctx.media.images.length)} works of art</span></li>
<li><a href="/articles/">Articles</a><span class="meta">${number(ctx.media.articles.length)} for further reading</span></li>
<li><a href="/downloads/">Downloads</a><span class="meta">Markdown, TOML and print</span></li>
<li><a href="/accessibility/">Reading for focus and comfort</a><span class="meta">Focus bold, themes, sounds</span></li>
</ul></section>
</div>`
  return page({ path: '/', body, description: 'A free, accessible library of the Berean Standard Bible, the church fathers, Augustine, Aquinas, the creeds and the papal encyclicals, with audio, maps and art.' })
}

// ---------- Scripture ----------

export function bibleIndex(ctx) {
  const books = ctx.works.filter((w) => w.collection === 'bible')
  const col = (divs, label) =>
    html`<div><h2>${label}</h2>${divs.map(([name, a, b]) => html`<p class="division">${name}</p><ul class="books">${books
      .filter((w) => w.book_number >= a && w.book_number <= b)
      .map((w) => html`<li><a href="${workUrl(w)}">${w.title}</a></li>`)}</ul>`)}</div>`
  const total = books.reduce((a, w) => a + w.verses, 0)
  const body = html`<div class="wrap">
<p class="kicker">Holy Scripture</p><h1>The Holy Bible</h1>
<p class="lede">The Berean Standard Bible: a modern, faithful translation from the Hebrew, Aramaic and Greek, given to the public domain in 2023. ${number(books.length)} books, ${number(total)} verses.</p>
<div class="testaments" style="margin-top:var(--s6)">${col(OT_DIVISIONS, 'Old Testament')}${col(NT_DIVISIONS, 'New Testament')}</div>
<section><div class="sec-head"><h2>Keep it</h2></div><ul class="list">
<li><a href="/dl/bsb-complete.md" download>The whole Bible as Markdown</a><span class="meta">one file</span></li>
<li><a href="/dl/bsb-complete.toml" download>The whole Bible as TOML</a><span class="meta">one file</span></li>
<li><a href="/downloads/">Every book and work</a><span class="meta">Markdown, TOML, print</span></li></ul></section>
</div>`
  return page({ title: 'The Holy Bible (BSB)', path: '/bible/', trail: [HOME, { title: 'Scripture' }], body })
}

export function bookPage(ctx, w) {
  const slug = bookSlug(w)
  const r = related(ctx, [`bible:${slug}`])
  const overview = r.videos[0]
  const body = html`<div class="wrap">
<p class="kicker">${w.testament === 'OT' ? 'Old Testament' : 'New Testament'}</p><h1>${w.title}</h1>
<p class="meta">${number(w.chapters)} chapters · ${number(w.verses)} verses · about ${readingTime(w.words)} to read</p>
<div style="display:grid;gap:var(--s6);margin-top:var(--s5)" class="book-grid">
<section aria-labelledby="ch-h"><h2 id="ch-h" class="vh">Chapters</h2><ul class="chapters" data-book="${w.id}">${w.pages.map(
    (p) => html`<li><a href="${pageUrl(w, p)}" data-ch="${p.id}" aria-label="${w.sections[p.from].title}">${p.id}</a></li>`,
  )}</ul></section>
${overview ? html`<section aria-labelledby="ov-h"><div class="sec-head"><h2 id="ov-h">Overview</h2></div><div style="max-width:40rem">${ytCard(overview)}</div></section>` : ''}
${r.maps.length ? html`<section><div class="sec-head"><h2>Maps</h2><a href="/maps/">All maps</a></div><div class="gallery maps">${r.maps.map((m) => figure(m, { big: true }))}</div></section>` : ''}
${r.images.length ? html`<section><div class="sec-head"><h2>Art</h2><a href="/art/">All art</a></div><div class="gallery">${r.images.slice(0, 12).map((m) => figure(m, { big: true }))}</div></section>` : ''}
${r.videos.length > 1 ? html`<section><div class="sec-head"><h2>More to watch</h2></div><div class="videos">${r.videos.slice(1, 7).map((v) => html`<div>${ytCard(v)}</div>`)}</div></section>` : ''}
<section><div class="sec-head"><h2>Download and print</h2></div><ul class="list">${downloadsFor(w).map((d) => html`<li><a href="${d.href}"${d.dl ? raw(' download') : ''}>${d.label}</a></li>`)}</ul></section>
</div></div>`
  return page({ title: `${w.title} (BSB)`, path: workUrl(w), trail: [HOME, { title: 'Scripture', href: '/bible/' }, { title: w.title }], body, description: `Read ${w.title} in the Berean Standard Bible, with audio, maps, art and printable text.` })
}

// A reading page for one page plan entry of any work (Bible chapter or work section).
export function readerPage(ctx, w, doc, idx) {
  const p = w.pages[idx]
  const bible = w.collection === 'bible'
  const secs = doc.section.slice(p.from, p.to)
  const single = p.to - p.from === 1
  const showTitles = !bible && !single
  const { html: text, notes } = renderSections(secs, { bible, showTitles, firstLevel: secs[0]?.level || 1 })
  const prevP = w.pages[idx - 1]
  const nextP = w.pages[idx + 1]
  // Bible: continue into the next book
  const lab = (pp) => (bible ? w.sections[pp.from].title : pageLabel(w, pp))
  let prev = prevP && { href: pageUrl(w, prevP), title: lab(prevP) }
  let next = nextP && { href: pageUrl(w, nextP), title: lab(nextP) }
  if (bible) {
    const books = ctx.bibleBooks
    const bi = books.indexOf(w)
    if (!prev && bi > 0) { const b = books[bi - 1]; const lp = b.pages[b.pages.length - 1]; prev = { href: pageUrl(b, lp), title: b.sections[lp.from].title } }
    if (!next && bi < books.length - 1) { const b = books[bi + 1]; next = { href: pageUrl(b, b.pages[0]), title: b.sections[0].title } }
  }
  const heading = bible ? w.sections[p.from].title : p.whole ? w.title : single ? w.sections[p.from].title : pageLabel(w, p)
  const title = bible || p.whole ? heading : `${w.short_title || w.title}: ${pageLabel(w, p)}`
  const slug = bible ? bookSlug(w) : null
  const tags = bible
    ? [`bible:${slug}:${p.id}`, `bible:${slug}`]
    : [`work:${w.id}:${p.id}`, `work:${w.id}`, `author:${w.author}`, `collection:${w.collection}`]
  const listen = audioFor(ctx, w, p)
  const printHref = bible ? `/bible/${slug}/print/` : `/read/${w.id}/print/`
  const tools = toolsRow({ prev, next, printHref, listen })
  const author = !bible ? ctx.authors[w.author] : null
  const head = html`<header class="page-head">
<p class="kicker">${bible ? w.title : author?.name || COLLECTION[w.collection].title}</p>
<h1>${heading}</h1>
${!bible && !p.whole ? html`<p class="meta"><a href="${workUrl(w)}">${w.title}</a></p>` : ''}
${!bible && p.whole && w.translator ? html`<p class="meta">Translated by ${w.translator}</p>` : ''}
${tools.desk}
</header>`
  const trail = bible
    ? [HOME, { title: 'Scripture', href: '/bible/' }, { title: w.title, href: workUrl(w) }, { title: String(p.id) }]
    : [HOME, colCrumb(w.collection), ...(p.whole ? [] : [{ title: w.short_title || w.title, href: workUrl(w) }]), { title: p.whole ? w.short_title || w.title : pageLabel(w, p) }]
  const body = html`<div class="reader" data-work="${w.id}" data-page="${p.id}" data-title="${title}">
${w.pages.length > 1 ? tocList(w, p) : html`<div class="toc"></div>`}
<article class="text-col">${head}<div class="text" lang="en">${raw(text)}</div>${raw(notesHtml(notes))}
${!bible && p.whole ? html`<p class="meta" style="margin-top:var(--s6)">${w.edition}. <a href="/about/#${w.id}">Source and license</a>.</p>` : ''}
${pager(prev, next)}</article>
${rail(ctx, tags, { downloads: downloadsFor(w) })}
</div>${tools.dock}`
  const desc = plain(secs.flatMap((s) => s.blocks).filter((b) => b.t === 'v' || b.t === 'p').slice(0, 3).map((b) => b.text).join(' ')).slice(0, 180)
  return page({ title, path: pageUrl(w, p), trail, body, reader: true, description: desc, head: next ? html`<link rel="next" href="${next.href}">` : '' })
}

// Work contents page, used when a work spans several pages.
export function workTocPage(ctx, w) {
  const author = ctx.authors[w.author]
  // Show as many heading levels as fit in a readable list.
  let depth = 1
  for (let d = 4; d >= 1; d--) if (w.sections.filter((x) => x.level <= d).length <= 700) { depth = d; break }
  const items = w.sections
    .filter((x) => x.level <= depth)
    .map((x) => html`<li class="l${x.level}" style="padding-left:${(x.level - 1) * 16}px"><a href="${sectionUrl(w, x.id)}">${x.title}</a></li>`)
  const r = related(ctx, [`work:${w.id}`, `author:${w.author}`])
  const body = html`<div class="wrap">
<p class="kicker">${author ? html`<a href="/authors/${w.author}/">${author.name}</a>` : COLLECTION[w.collection].title}</p>
<h1>${w.title}</h1>
${w.summary ? html`<p class="lede">${w.summary}</p>` : ''}
<p class="meta">${[w.date && `Written ${w.date}`, w.language && `from the ${w.language}`, w.translator && `translated by ${w.translator}`].filter(Boolean).join(' · ')}</p>
<p class="meta">${number(w.words)} words · about ${readingTime(w.words)} to read</p>
<p style="margin-top:var(--s4)"><a class="btn" href="${pageUrl(w, w.pages[0])}" data-resume="${w.id}">${raw(icon('book'))}<span>Start reading</span></a></p>
<div style="display:grid;gap:var(--s6);margin-top:var(--s6)">
<section aria-labelledby="c-h"><div class="sec-head"><h2 id="c-h">Contents</h2></div><ol class="list">${items}</ol></section>
${r.videos.length ? html`<section><div class="sec-head"><h2>Watch</h2></div><div class="videos">${r.videos.slice(0, 4).map((v) => html`<div>${ytCard(v)}</div>`)}</div></section>` : ''}
${r.articles.length ? html`<section><div class="sec-head"><h2>Read more</h2></div><ul class="list">${r.articles.slice(0, 6).map((a) => html`<li><a href="${a.url}" rel="noopener">${a.title}</a><span class="meta">${a.publisher}</span></li>`)}</ul></section>` : ''}
<section><div class="sec-head"><h2>Download and print</h2></div><ul class="list">${downloadsFor(w).map((d) => html`<li><a href="${d.href}"${d.dl ? raw(' download') : ''}>${d.label}</a></li>`)}</ul>
<p class="meta">${w.edition}. <a href="/about/#${w.id}">Source and license</a>.</p></section>
</div></div>`
  return page({ title: `${w.title}${author ? ` · ${author.name}` : ''}`, path: workUrl(w), trail: [HOME, colCrumb(w.collection), { title: w.short_title || w.title }], body, description: w.summary || `${w.title}${author ? ` by ${author.name}` : ''}, free to read, print and download.` })
}

// Whole work on one page, for printing.
export function printPage(ctx, w, doc) {
  const bible = w.collection === 'bible'
  const { html: text, notes } = renderSections(doc.section, { bible, showTitles: true, firstLevel: 1 })
  const author = ctx.authors[w.author]
  const body = html`<div class="wrap narrow"><header class="page-head"><p class="kicker">${bible ? 'Berean Standard Bible' : author?.name || ''}</p><h1>${w.title}</h1>
<p class="meta no-print">This page holds the whole ${bible ? 'book' : 'work'} for printing. <button class="tool" type="button" data-print="">${raw(icon('print'))}<span class="lbl">Print now</span></button></p>
<p class="meta">${w.edition}. Public domain.</p></header>
<div class="text">${raw(text)}</div>${raw(notesHtml(notes))}</div>`
  const path = bible ? `/bible/${bookSlug(w)}/print/` : `/read/${w.id}/print/`
  return page({ title: `${w.title} (print)`, path, trail: [HOME, bible ? { title: 'Scripture', href: '/bible/' } : colCrumb(w.collection), { title: w.short_title || w.title, href: workUrl(w) }, { title: 'Print' }], body, noindex: true, reader: true })
}

// ---------- collections and authors ----------

export function collectionPage(ctx, colId) {
  const c = COLLECTION[colId]
  const meta = ctx.collections[colId] || {}
  const works = ctx.works.filter((w) => w.collection === colId)
  const byAuthor = new Map()
  for (const w of works) {
    if (!byAuthor.has(w.author)) byAuthor.set(w.author, [])
    byAuthor.get(w.author).push(w)
  }
  const groups = [...byAuthor.entries()].map(([a, ws]) => {
    const au = ctx.authors[a]
    return html`<section aria-labelledby="a-${a}"><div class="sec-head"><h2 id="a-${a}">${au ? html`<a href="/authors/${a}/" style="color:inherit;text-decoration:none">${au.name}</a>` : a}</h2>${au?.dates ? html`<span class="meta">${au.dates}</span>` : ''}</div>
<ul class="list">${ws.map((w) => html`<li><a href="${workUrl(w)}">${w.title}</a><span class="meta">${readingTime(w.words)}</span></li>`)}</ul></section>`
  })
  const external = ctx.external.filter((x) => (x.collection || colId) === colId && colId === 'gnostic')
  const body = html`<div class="wrap">
<p class="kicker">The library</p><h1>${c.title}</h1>
${meta.summary ? html`<p class="lede">${meta.summary}</p>` : ''}
<p class="meta">${number(works.length)} works · ${number(works.reduce((a, w) => a + w.words, 0))} words</p>
<div style="margin-top:var(--s6)">${groups}</div>
${external.length ? html`<section><div class="sec-head"><h2>Read elsewhere</h2></div><p class="muted">These texts have no public domain English translation, so they are linked rather than hosted.</p><ul class="list">${external.map((x) => html`<li><span><a href="${x.url}" rel="noopener">${x.title}</a><span class="sub">${x.summary || x.description || ''}</span></span>${raw(icon('external', 16))}</li>`)}</ul></section>` : ''}
</div>`
  return page({ title: c.title, path: colHref(colId), trail: [HOME, { title: c.short }], body, description: meta.summary })
}

export function authorsIndex(ctx) {
  const list = Object.values(ctx.authors)
    .filter((a) => a.id !== 'bible' && a.id !== 'church' && ctx.worksByAuthor.get(a.id)?.length)
    .map((a) => ({ ...a, start: parseInt(String(a.dates || '').match(/\d{2,4}/)?.[0] || '9999', 10) }))
    .sort((x, y) => x.start - y.start || x.name.localeCompare(y.name))
  const body = html`<div class="wrap"><p class="kicker">The library</p><h1>Authors</h1><p class="lede">The fathers and teachers of the church in the library, in order of their lives.</p>
<ul class="list" style="margin-top:var(--s5)">${list.map((a) => html`<li><span><a href="/authors/${a.id}/">${a.name}</a>${a.role ? html`<span class="sub">${a.role}</span>` : ''}</span><span class="meta">${a.dates || ''}</span></li>`)}</ul></div>`
  return page({ title: 'Authors', path: '/authors/', trail: [HOME, { title: 'Authors' }], body })
}

export function authorPage(ctx, a) {
  const works = ctx.worksByAuthor.get(a.id) || []
  const r = related(ctx, [`author:${a.id}`])
  const portrait = (a.portrait && ctx.mediaById.get(a.portrait)) || r.images[0]
  const body = html`<div class="wrap">
<p class="kicker">Author</p><h1>${a.name}</h1>
<p class="meta">${[a.dates, a.role].filter(Boolean).join(' · ')}</p>
<div style="display:grid;gap:var(--s6);margin-top:var(--s5)">
${portrait || a.summary ? html`<div style="display:grid;gap:var(--s5);grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));align-items:start">${portrait ? html`<div style="max-width:20rem">${figure(portrait, { big: true })}</div>` : ''}${a.summary ? html`<p class="lede" style="margin:0">${a.summary}</p>` : ''}</div>` : ''}
<section><div class="sec-head"><h2>Works</h2></div><ul class="list">${works.map((w) => html`<li><a href="${workUrl(w)}">${w.title}</a><span class="meta">${readingTime(w.words)}</span></li>`)}</ul></section>
${r.videos.length ? html`<section><div class="sec-head"><h2>Watch</h2></div><div class="videos">${r.videos.slice(0, 6).map((v) => html`<div>${ytCard(v)}</div>`)}</div></section>` : ''}
${r.articles.length ? html`<section><div class="sec-head"><h2>Read more</h2></div><ul class="list">${r.articles.map((x) => html`<li><a href="${x.url}" rel="noopener">${x.title}</a><span class="meta">${x.publisher}</span></li>`)}</ul></section>` : ''}
</div></div>`
  return page({ title: a.name, path: `/authors/${a.id}/`, trail: [HOME, { title: 'Authors', href: '/authors/' }, { title: a.name }], body, description: a.summary })
}

// ---------- media ----------

export function videosPage(ctx) {
  const vids = ctx.media.videos
  const body = html`<div class="wrap"><p class="kicker">Explore</p><h1>Videos</h1>
<p class="lede">Book overviews, lectures on the fathers, the councils and the great works. Each video plays from YouTube's privacy-enhanced player only when you press play.</p>
<form class="searchbox" role="search" style="margin-top:var(--s5)" data-nosubmit><label class="vh" for="vf">Filter videos</label><input id="vf" type="search" placeholder="Filter by title, book, topic" data-filter=".videos > div"></form>
<div class="videos" style="margin-top:var(--s5)">${vids.map((v) => html`<div data-text="${[v.title, v.channel, v.description, ...(v.tags || [])].join(' ').toLowerCase()}">${ytCard(v)}<p class="meta" style="margin-top:calc(-1 * var(--s3))">${v.channel}${v.description ? html` · ${v.description}` : ''}</p></div>`)}</div>
<p class="meta" data-empty hidden>No videos match.</p></div>`
  return page({ title: 'Videos', path: '/videos/', trail: [HOME, { title: 'Videos' }], body })
}

export function articlesPage(ctx) {
  const arts = ctx.media.articles
  const body = html`<div class="wrap narrow"><p class="kicker">Explore</p><h1>Articles</h1><p class="lede">Further reading from trustworthy sources. These open on their own sites.</p>
<form class="searchbox" role="search" style="margin-top:var(--s5)" data-nosubmit><label class="vh" for="af">Filter articles</label><input id="af" type="search" placeholder="Filter articles" data-filter=".list > li"></form>
<ul class="list" style="margin-top:var(--s4)">${arts.map((a) => html`<li data-text="${[a.title, a.publisher, a.author, a.description, ...(a.tags || [])].join(' ').toLowerCase()}"><span><a href="${a.url}" rel="noopener">${a.title}</a><span class="sub">${a.publisher}${a.author ? html` · ${a.author}` : ''}${a.description ? html`. ${a.description}` : ''}</span></span></li>`)}</ul>
<p class="meta" data-empty hidden>No articles match.</p></div>`
  return page({ title: 'Articles', path: '/articles/', trail: [HOME, { title: 'Articles' }], body })
}

export function galleryPage(ctx, kind) {
  const items = kind === 'maps' ? ctx.media.maps : ctx.media.images
  const title = kind === 'maps' ? 'Maps' : 'Art'
  const lede = kind === 'maps'
    ? 'Maps of the lands of the Bible and the early church, from public domain atlases. Select a map to open it full size.'
    : 'Public domain art: Gustave Doré’s Bible engravings and portraits of the fathers. Select one to open it full size.'
  const body = html`<div class="wrap"><p class="kicker">Explore</p><h1>${title}</h1><p class="lede">${lede}</p>
<form class="searchbox" role="search" style="margin-top:var(--s5)" data-nosubmit><label class="vh" for="gf">Filter</label><input id="gf" type="search" placeholder="Filter by title or book" data-filter=".gallery > figure"></form>
<div class="gallery${kind === 'maps' ? ' maps' : ''}" style="margin-top:var(--s5)">${items.map(
    (m) => html`<figure class="figure" id="${m.id}" data-text="${[m.title, m.artist, m.region, m.period, ...(m.tags || [])].join(' ').toLowerCase()}"><a href="${m.file}"><img src="${m.file}" alt="${m.alt}" width="${m.width}" height="${m.height}" loading="lazy" decoding="async"></a>
<figcaption>${m.title}${m.artist ? html`, ${m.artist}` : ''}${m.year ? html` (${m.year})` : ''}. ${m.credit || 'Public domain'}. <a href="${m.source_page}" rel="noopener">Source</a></figcaption></figure>`,
  )}</div><p class="meta" data-empty hidden>Nothing matches.</p></div>`
  return page({ title, path: `/${kind}/`, trail: [HOME, { title }], body })
}

export function encyclicalsPage(ctx) {
  const list = [...ctx.encyclicals].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const hosted = new Set(ctx.works.filter((w) => w.collection === 'encyclicals').map((w) => w.id))
  const meta = ctx.collections.encyclicals || {}
  const body = html`<div class="wrap narrow"><p class="kicker">The library</p><h1>Papal Encyclicals</h1>
<p class="lede">${meta.summary || 'Every encyclical letter, searchable by title, pope, year and subject.'}</p>
<form class="searchbox" role="search" style="margin-top:var(--s5)" data-nosubmit><label class="vh" for="ef">Search encyclicals</label><input id="ef" type="search" placeholder="Search by title, pope, year, subject" data-filter=".list > li"></form>
<p class="meta" style="margin-top:var(--s3)">${number(list.length)} encyclicals. Those marked “Read here” are hosted in full from public domain translations; the rest open on the Vatican’s own site.</p>
<ul class="list">${list.map((e) => {
    const local = e.full_text && hosted.has(e.full_text) ? ctx.byId.get(e.full_text) : null
    return html`<li data-text="${[e.title, e.english_title, e.pope, e.date, e.subject].join(' ').toLowerCase()}"><span>${local ? html`<a href="${workUrl(local)}">${e.title}</a>` : html`<a href="${e.url}" rel="noopener">${e.title}</a>`}<span class="sub">${e.english_title ? html`${e.english_title}. ` : ''}${e.subject && e.subject.replace(/\.$/, '').toLowerCase() !== String(e.english_title || '').toLowerCase() ? e.subject : ''}</span><span class="sub">${e.pope} · ${String(e.date).slice(0, 10)}${local ? html` · <strong>Read here</strong>` : ''}</span></span></li>`
  })}</ul><p class="meta" data-empty hidden>No encyclicals match.</p></div>`
  return page({ title: 'Papal Encyclicals', path: '/encyclicals/', trail: [HOME, { title: 'Encyclicals' }], body })
}

// ---------- utility pages ----------

export function searchPage() {
  const body = html`<div class="wrap narrow"><p class="kicker">Search</p><h1>Search the library</h1>
<form class="searchbox" role="search" style="margin-top:var(--s5)" id="search-form"><label class="vh" for="sq">Search</label><input id="sq" name="q" type="search" placeholder="A verse, a phrase, a name" autocomplete="off" autofocus><button class="btn" type="submit">${raw(icon('search'))}<span>Search</span></button></form>
<div class="filters seg" role="radiogroup" aria-label="Search in">
${[['all', 'Everything'], ['bible', 'Scripture'], ['apocrypha', 'Apocrypha and Enoch'], ['history', 'Josephus'], ['fathers', 'Fathers'], ['medieval', 'Medieval'], ['aquinas', 'Aquinas'], ['reformation', 'Reformation'], ['creeds', 'Creeds'], ['gnostic', 'Gnostic'], ['encyclicals', 'Encyclicals'], ['media', 'Videos and articles']].map(
    ([v, l], i) => html`<label><input type="radio" name="scope" value="${v}"${i === 0 ? raw(' checked') : ''}><span>${l}</span></label>`,
  )}</div>
<p class="meta" style="margin-top:var(--s3)">Tip: a reference like <a href="/search/?q=John%203:16">John 3:16</a> or <a href="/search/?q=Rom%208">Rom 8</a> goes straight to the passage. Use quotes for an exact phrase.</p>
<p id="search-status" class="meta" role="status" aria-live="polite"></p>
<ol class="results" id="results"></ol>
<noscript><p class="notice">Search needs JavaScript. Browse the <a href="/bible/">Bible</a> or <a href="/authors/">authors</a> instead.</p></noscript></div>`
  return page({ title: 'Search', path: '/search/', trail: [HOME, { title: 'Search' }], body })
}

export function aboutPage(ctx) {
  const rows = ctx.works.filter((w) => w.collection !== 'bible')
  const body = html`<div class="wrap narrow"><p class="kicker">About</p><h1>Sources and licenses</h1>
<p class="lede">Every text on He Lives is in the public domain. Each one lists the printed edition it comes from and where the digital copy was taken.</p>
<h2 style="margin-top:var(--s6)">Holy Scripture</h2>
<p>The <strong>Berean Standard Bible</strong> was dedicated to the public domain by the Berean Bible Translation Committee in 2023. Text and footnotes come from the official files at <a href="https://berean.bible/downloads.htm">berean.bible</a>; every verse is checked against the official plain-text edition when the site is built.</p>
<h2 style="margin-top:var(--s6)">The fathers, Augustine and Aquinas</h2>
<p>The Ante-Nicene Fathers (1885 to 1896) and the Nicene and Post-Nicene Fathers (1886 to 1900), edited by Philip Schaff, Alexander Roberts and James Donaldson, and the Summa Theologica in the translation of the Fathers of the English Dominican Province, all printed in the United States or before 1931. Digital text from the Christian Classics Ethereal Library.</p>
<h2 style="margin-top:var(--s6)">Gnostic texts</h2>
<p>These are historical documents the early church examined and rejected. They are here so readers can see what the fathers were answering; Irenaeus’ <em>Against Heresies</em> is the church’s classic reply.</p>
<h2 style="margin-top:var(--s6)">Encyclicals</h2>
<p>The Vatican’s English texts of the encyclicals are copyrighted by the Libreria Editrice Vaticana, so most entries link to the Vatican’s site. Encyclicals hosted here come from English translations printed before 1931.</p>
<h2 style="margin-top:var(--s6)">Art, maps and video</h2>
<p>Art and maps are public domain works from Wikimedia Commons, each credited with a link to its source page. Videos are embedded from YouTube and belong to their makers; they load only when you press play.</p>
<h2 style="margin-top:var(--s6)">Audio</h2>
<p>Audiobooks are read by a voice model running on our own computer. Every recording is checked against the text by a speech recognizer before it is published.</p>
<h2 style="margin-top:var(--s6)">Every work</h2>
<ul class="list">${rows.map((w) => html`<li id="${w.id}"><span><a href="${workUrl(w)}">${w.title}</a><span class="sub">${w.edition}${w.translator ? html`, tr. ${w.translator}` : ''}. ${w.license_basis}. <a href="${w.source_url}" rel="noopener">Digital source</a></span></span></li>`)}</ul>
</div>`
  return page({ title: 'Sources and licenses', path: '/about/', trail: [HOME, { title: 'About' }], body })
}

export function accessibilityPage() {
  const body = html`<div class="wrap narrow"><p class="kicker">Reading for focus and comfort</p><h1>Made to be easy to read</h1>
<p class="lede">He Lives was built for readers who find long pages hard: people with ADHD, OCD, dyslexia, visual snow, light sensitivity or tired eyes. Open <strong>Reading</strong> at the top of any page to change how text looks. Your choices stay on your device.</p>
<h2 style="margin-top:var(--s6)">Focus bold</h2><p>The start of each word is set a little heavier, so your eye has a place to land and moves along the line with less effort. It is on by default. Choose Light, Strong or Off in Reading settings.</p>
<h2 style="margin-top:var(--s6)">Themes</h2><p><strong>Night</strong> is parchment on near-black. <strong>Dusk</strong> lowers the contrast and avoids pure black and pure white, which many people with visual snow or light sensitivity find calmer. <strong>Paper</strong> and <strong>Sepia</strong> are warm light themes. <strong>High contrast</strong> is for low vision. Nothing on the site flashes or moves on its own.</p>
<h2 style="margin-top:var(--s6)">Fonts and spacing</h2><p>Choose Serif, Atkinson Hyperlegible (designed by the Braille Institute for low vision readers) or OpenDyslexic. Text size, line spacing, letter spacing, word spacing and line length all adjust.</p>
<h2 style="margin-top:var(--s6)">Reading ruler</h2><p>A soft band follows the line you are reading, or everything else dims. It follows your pointer, or tap a line on a phone.</p>
<h2 style="margin-top:var(--s6)">One verse per line</h2><p>The Bible can show each verse on its own line, so the place you stopped is always easy to find. Verse numbers and footnotes can be hidden.</p>
<h2 style="margin-top:var(--s6)">Background sound</h2><p>Brown, pink or white noise, rain, a stream, a fireplace or wind, made live in your browser, with a sleep timer.</p>
<h2 style="margin-top:var(--s6)">Listen</h2><p>Where an audiobook is ready, press Listen. The verse being read is highlighted, so you can follow along.</p>
<h2 style="margin-top:var(--s6)">Keep your place</h2><p>The site remembers the last page you read in each book and offers to continue from the home page. Chapters you have opened are shaded.</p>
<h2 style="margin-top:var(--s6)">Keyboard</h2><p>Left and right arrow keys move to the previous and next chapter. <kbd>/</kbd> opens search. <kbd>R</kbd> opens Reading settings.</p>
</div>`
  return page({ title: 'Accessibility', path: '/accessibility/', trail: [HOME, { title: 'Accessibility' }], body })
}

const mb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// One row per collection: a zip of every work as Markdown and as TOML (split into parts when large).
function bundleList(bundles = []) {
  if (!bundles.length) return ''
  const rows = COLLECTIONS.map((c) => {
    const mine = bundles.filter((b) => b.collection === c.id)
    if (!mine.length) return ''
    const links = mine.flatMap((b) => b.parts.map((p, i) => html`<a href="${p.href}" download>${b.parts.length > 1 ? `.${b.ext} part ${i + 1}` : `.${b.ext}`}</a> (${mb(p.bytes)})`))
    return html`<li><span>${c.title}</span><span class="meta">${links.map((l, i) => (i ? html` · ${l}` : l))}</span></li>`
  })
  return html`<section><div class="sec-head"><h2>Whole collections</h2><span class="meta">zip files</span></div><ul class="list">${rows}</ul></section>`
}

export function downloadsPage(ctx) {
  const groups = COLLECTIONS.map((c) => {
    const ws = ctx.works.filter((w) => w.collection === c.id)
    if (!ws.length) return ''
    return html`<section><div class="sec-head"><h2>${c.title}</h2>${c.id === 'bible' ? html`<span class="meta"><a href="/dl/bsb-complete.md" download>Whole Bible .md</a> · <a href="/dl/bsb-complete.toml" download>.toml</a></span>` : ''}</div>
<ul class="list">${ws.map((w) => html`<li><span>${w.title}${w.collection !== 'bible' && ctx.authors[w.author] ? html`<span class="sub">${ctx.authors[w.author].name}</span>` : ''}</span><span class="meta"><a href="/dl/${w.id}.md" download>.md</a> · <a href="/dl/${w.id}.toml" download>.toml</a> · <a href="${w.collection === 'bible' ? `/bible/${bookSlug(w)}/print/` : `/read/${w.id}/print/`}">print</a></span></li>`)}</ul></section>`
  })
  const body = html`<div class="wrap"><p class="kicker">Keep it</p><h1>Downloads</h1>
<p class="lede">Everything here is public domain: copy it, print it, share it. Markdown opens in any text editor or notes app. TOML is structured data for programs. The print pages hold a whole work, ready for paper or PDF (choose “Save as PDF” in the print dialog).</p>
<p class="meta">The whole library is also on <a href="https://github.com/baney75/helives/tree/main/library">GitHub</a>, with every file and the scripts that build it. The <a href="https://github.com/baney75/helives/releases/latest">latest release</a> has the entire library in two zip files.</p>
${bundleList(ctx.bundles)}
${groups}</div>`
  return page({ title: 'Downloads', path: '/downloads/', trail: [HOME, { title: 'Downloads' }], body })
}

export function notFoundPage() {
  const body = html`<div class="wrap narrow"><p class="kicker">Not found</p><h1>That page is not here</h1><p class="lede">Try <a href="/search/">searching</a> or go back to the <a href="/">library</a>.</p></div>`
  return page({ title: 'Not found', path: '/404', body, noindex: true })
}

export { esc }
