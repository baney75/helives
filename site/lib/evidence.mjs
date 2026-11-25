// The evidence for Christ: a hub and one page per part, from data/evidence/*.toml.
import { html, inline, number, raw } from './html.mjs'
import { page } from './layout.mjs'
import { figure, pager } from './pages.mjs'
import { sectionUrl } from './render.mjs'

const HOME = { title: 'Library', href: '/' }
const HUB = { title: 'The evidence for Christ', href: '/evidence/' }
export const partUrl = (p) => `/evidence/${p.id}/`

const GRADE_TEXT = { settled: 'Settled', strong: 'Strong', argued: 'Argued', set_aside: 'Not used as evidence' }
const GRADE_MEANING = {
  settled: 'Historians who believe and historians who do not agree on the facts. What the facts mean is still yours to weigh.',
  strong: 'Most who study the question accept it. Some raise a real objection.',
  argued: 'Serious scholars divide. It may add weight, and the case does not depend on it alone.',
  set_aside: 'Often quoted, and too doubtful to build on. It is listed so you know why it is missing.',
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const count = (p) => `${number(p.exhibits.length)} exhibits`

// Prose passes through the same word fixation as the texts, so the reader's own settings reach it.
const prose = (t) => raw(inline(t))

const verse = (v) => html`<blockquote class="ev-verse"><p>${v.text}</p><footer><a href="${v.href}">${v.ref}</a></footer></blockquote>`

function quote(ctx, q) {
  // A partial build (--only) may not hold the work, so the quote then stands without a link.
  const w = q.work && ctx.byId.get(q.work)
  const href = w ? sectionUrl(w, q.sec) : q.href
  return html`<blockquote class="ev-quote"><p>“${prose(q.text)}”</p><footer>${href ? html`<a href="${href}"${w ? '' : html` rel="noopener"`}>${q.by}</a>` : q.by}</footer></blockquote>`
}

function exhibit(ctx, p, e) {
  const labels = p.labels || {}
  return html`<article class="exhibit" id="${e.id}">
<h2>${e.title}</h2>
<p class="meta">${e.when}</p>
${e.grade ? html`<p class="ev-grade">Strength: <a href="/evidence/#grades">${GRADE_TEXT[e.grade]}</a></p>` : ''}
${e.image ? figure(ctx.mediaById.get(e.image), { capped: true }) : ''}<p class="prose">${prose(e.summary)}</p>
${e.quote ? quote(ctx, e.quote) : ''}
<dl>
<dt>${labels.shows || 'What it shows'}</dt><dd class="prose">${prose(e.shows)}</dd>
<dt>${labels.objection || 'Strongest objection'}</dt><dd class="prose">${prose(e.objection)}</dd>
<dt>Sources</dt><dd class="prose"><ul>${e.sources.map(([t, u]) => html`<li><a href="${u}"${u.startsWith('/') ? '' : html` rel="noopener"`}>${t}</a></li>`)}</ul></dd>
</dl></article>`
}

export function evidenceHub(ctx) {
  const ev = ctx.evidence
  const hero = ctx.mediaById.get(ev.image)
  const end = ctx.mediaById.get(ev.close.image)
  const body = html`<div class="wrap evidence">
<img class="ev-hero" src="${hero.file}" alt="${hero.alt}" width="${hero.width}" height="${hero.height}" decoding="async">
<p class="meta">${hero.title}, ${hero.artist} (${hero.year})</p>
<h1>${ev.title}</h1><p class="lede prose">${prose(ev.lede)}</p>
${verse(ev.verse)}
${ev.short ? html`<section class="ev-short" aria-labelledby="short-h"><h2 id="short-h">${ev.short.title}</h2><ol class="prose">${ev.short.items.map(([t, u]) => html`<li><a href="${u}"><span>${prose(t)}</span></a></li>`)}</ol></section>` : ''}
<ol class="ev-parts">${ev.parts.map((p, i) => html`<li class="ev-row"><span class="n" aria-hidden="true">${ROMAN[i]}</span>
<div><h2><a href="${partUrl(p)}">${p.title}</a></h2><p class="prose">${prose(p.short)}</p><p class="meta">${count(p)}</p></div>
<img src="${ctx.mediaById.get(p.image).file}" alt="" width="${ctx.mediaById.get(p.image).width}" height="${ctx.mediaById.get(p.image).height}" loading="lazy" decoding="async"></li>`)}</ol>
<section id="grades" aria-labelledby="grades-h"><div class="sec-head"><h2 id="grades-h">How to read the grades</h2></div>
<dl class="grades">${Object.entries(GRADE_MEANING).map(([k, v]) => html`<dt>${GRADE_TEXT[k]}</dt><dd class="prose">${prose(v)}</dd>`)}</dl>
<p class="prose">${prose(ev.grades_note)}</p></section>
<section class="ev-close" aria-labelledby="close-h">${figure(end)}<div><h2 id="close-h">${ev.close.title}</h2><p class="prose">${prose(ev.close.text)}</p>${ev.close.verses.map(verse)}</div></section>
</div>`
  return page({ title: ev.title, path: '/evidence/', trail: [HOME, { title: ev.title }], body, description: ev.description })
}

export function evidencePart(ctx, i) {
  const { parts } = ctx.evidence
  const p = parts[i]
  const link = (q) => q && { title: q.title, href: partUrl(q) }
  const body = html`<div class="wrap narrow evidence">
<p class="kicker">Part ${number(i + 1)} of ${number(parts.length)}</p><h1>${p.title}</h1>
<p class="lede prose">${prose(p.intro)}</p>
${figure(ctx.mediaById.get(p.image), { big: true, eager: true, capped: true })}
<nav class="notice" aria-label="On this page"><ul>${p.exhibits.map((e) => html`<li><a href="#${e.id}">${e.title}</a></li>`)}</ul>${p.ungraded ? '' : html`<p><a href="/evidence/#grades">How to read the grades</a></p>`}</nav>
${verse(p.verse)}
${p.exhibits.map((e) => exhibit(ctx, p, e))}
${pager(link(parts[i - 1]) || HUB, link(parts[i + 1]) || HUB)}
</div>`
  return page({ title: p.title, path: partUrl(p), trail: [HOME, HUB, { title: p.title }], body, description: p.short })
}
