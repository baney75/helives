// Turns work sections into reading HTML, with build-time focus bold and per-page footnotes.
import { esc, inline } from './html.mjs'

export const bookSlug = (w) => w.id.replace(/^bsb-/, '')
export function workUrl(w) {
  return w.collection === 'bible' ? `/bible/${bookSlug(w)}/` : `/read/${w.id}/`
}
export function pageUrl(w, p) {
  if (w.collection === 'bible') return `/bible/${bookSlug(w)}/${p.id}/`
  return p.whole ? `/read/${w.id}/` : `/read/${w.id}/${p.id}/`
}
// URL of the page that holds a given section id.
export function sectionUrl(w, sectionId) {
  const idx = w.sections.findIndex((s) => s.id === sectionId)
  const p = w.pages.find((pg) => idx >= pg.from && idx < pg.to) || w.pages[0]
  const u = pageUrl(w, p)
  return idx === p.from ? u : `${u}#s-${sectionId}`
}

// Render one or more sections. opts.bible: verse layout. Returns { html, notes }.
// A short label for what a page holds: "Chapters I to XX", "Question 5", or the one section's title.
const NUMBERED = /^(Chapter|Book|Article|Question|Letter|Epistle|Homily|Sermon|Part|Section|Lecture|Tractate|Treatise|Psalm|Discourse|Oration)\s+([IVXLCDM]+|\d+)\b/i
const FRONT = /^(Introductory Note|Introductory Notice|Introduction|Preface|Prolegomena|Prologue|Elucidations?|Translator's Preface|Argument)\b/i
export function shortTitle(t) {
  const f = String(t).match(FRONT)
  if (f) return f[1][0].toUpperCase() + f[1].slice(1)
  const s = String(t).split(/\.\s*[—-]|:\s|—/)[0].trim()
  return s.length > 64 ? s.slice(0, 62).replace(/\s+\S*$/, '') + '…' : s
}
export function pageLabel(w, p) {
  if (p.whole) return w.short_title || w.title
  const secs = w.sections.slice(p.from, p.to)
  const top = Math.min(...secs.map((s) => s.level))
  const tops = secs.filter((s) => s.level === top)
  // a leading heading with deeper children: name the page by that heading
  if (tops.length === 1) return shortTitle(tops[0].title)
  const a = tops[0].title.match(NUMBERED)
  const b = tops[tops.length - 1].title.match(NUMBERED)
  if (a && b && a[1].toLowerCase() === b[1].toLowerCase()) {
    const word = a[1][0].toUpperCase() + a[1].slice(1).toLowerCase()
    return `${word}s ${a[2]} to ${b[2]}`
  }
  return `${shortTitle(tops[0].title)} to ${shortTitle(tops[tops.length - 1].title)}`
}

// A section with no text of its own (a Book or Part heading) carries its title as its only block so the
// data stays valid. The title is already shown and read, so that block is skipped. Returns its index or -1.
export function titleEcho(s) {
  const i = s.blocks.findIndex((b) => b.t !== 'note')
  const b = s.blocks[i]
  return b && b.t === 'h' && String(b.text).trim() === String(s.title).trim() ? i : -1
}

export function renderSections(sections, { bible = false, showTitles = true, fx = true, firstLevel = 1 } = {}) {
  const out = []
  const notes = []
  for (const s of sections) {
    const sid = String(s.id)
    const noteHref = (id) => `n-${sid}-${id}`
    if (showTitles) {
      const lvl = Math.min(4, Math.max(2, (s.level || 1) - firstLevel + 2))
      out.push(`<h${lvl} class="sect-title" id="s-${esc(sid)}">${esc(s.title)}</h${lvl}>`)
    }
    let openP = false
    const closeP = () => {
      if (openP) out.push('</p>')
      openP = false
    }
    const echo = showTitles ? titleEcho(s) : -1
    for (const [i, b] of s.blocks.entries()) {
      if (i === echo) continue
      const bid = `${esc(sid)}:${i}` // matches the audio timing anchors b<i> of section sid
      switch (b.t) {
        case 'v': {
          const body = b.cont
            ? `<span class="v" data-s="${esc(sid)}" data-v="${b.n}">${inline(b.text, { fx, noteHref })}</span>`
            : `<span class="v" id="${bible ? `v${b.n}` : `${esc(sid)}-v${b.n}`}" data-s="${esc(sid)}" data-v="${b.n}"><span class="vn" aria-hidden="true">${b.n}</span><span class="vh">Verse ${b.n}. </span>${inline(b.text, { fx, noteHref })}</span>`
          if (b.indent) {
            closeP()
            out.push(`<p class="q i${b.indent}">${body}</p>`)
          } else {
            if (b.p || !openP) {
              closeP()
              out.push('<p class="vp">')
              openP = true
            } else out.push(' ')
            out.push(body)
          }
          break
        }
        case 'h': {
          closeP()
          const lv = b.level || 2
          out.push(`<p class="h l${lv}" data-b="${bid}" role="heading" aria-level="${Math.min(6, lv + 1)}">${inline(b.text, { fx: false, noteHref })}</p>`)
          break
        }
        case 'p':
          closeP()
          out.push(`<p data-b="${bid}">${inline(b.text, { fx, noteHref })}</p>`)
          break
        case 'q':
          closeP()
          out.push(`<p class="q i${b.indent || 1}" data-b="${bid}">${inline(b.text, { fx, noteHref })}</p>`)
          break
        case 'bq':
          closeP()
          out.push(`<blockquote data-b="${bid}"><p>${inline(b.text, { fx, noteHref })}</p></blockquote>`)
          break
        case 'ref':
          closeP()
          out.push(`<p class="xref">${inline(b.text, { fx: false, noteHref })}</p>`)
          break
        case 'note':
          notes.push({ href: noteHref(b.id), id: b.id, label: bible ? `${s.title}` : s.title, text: inline(b.text, { fx: false }) })
          break
      }
    }
    closeP()
  }
  return { html: out.join(''), notes }
}

export function notesHtml(notes) {
  if (!notes.length) return ''
  return `<aside class="notes" aria-labelledby="notes-h"><h2 id="notes-h">Notes</h2><ol>${notes
    .map((n) => `<li id="${esc(n.href)}">${n.text} <a href="#r-${esc(n.href)}" aria-label="Back to the text">↩</a></li>`)
    .join('')}</ol></aside>`
}
