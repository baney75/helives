// HTML helpers shared by every page: escaping, inline markup, fixation bold.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c])

// Tagged template: interpolations are escaped unless wrapped with raw().
class Raw { constructor(v) { this.v = v } toString() { return this.v } }
export const raw = (v) => new Raw(String(v ?? ''))
export function html(strings, ...vals) {
  let out = strings[0]
  vals.forEach((v, i) => {
    if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.v : esc(x))).join('')
    else if (v instanceof Raw) out += v.v
    else if (v === false || v === null || v === undefined) out += ''
    else out += esc(v)
    out += strings[i + 1]
  })
  return raw(out)
}

// Fixation bold: the first part of each word is wrapped in <b>, so the eye lands on word starts.
// Done at build time so there is no flash; the reader setting only changes the <b> weight in CSS.
const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu
export function fixLen(word) {
  const n = Array.from(word).length
  if (n <= 3) return 1
  if (n <= 5) return 2
  return Math.ceil(n * 0.4)
}
export function fixate(escapedText) {
  // Input is already HTML-escaped plain text (no tags). Entities like &amp; contain letters, so skip them.
  return escapedText.replace(/(&[#a-z0-9]+;)|([\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)/gu, (m, ent, word) => {
    if (ent) return ent
    const chars = Array.from(word)
    const k = fixLen(word)
    return `<b>${chars.slice(0, k).join('')}</b>${chars.slice(k).join('')}`
  })
}

// Inline markup allowed by library/SCHEMA.md: *italic*, **bold**, [^id] footnote markers.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\^[A-Za-z0-9_.-]+\])/g
export function inline(text, { fx = true, noteHref = null } = {}) {
  const parts = String(text).split(TOKEN)
  return parts
    .map((part) => {
      if (!part) return ''
      if (part.startsWith('[^')) {
        const id = part.slice(2, -1)
        if (!noteHref) return ''
        const href = noteHref(id)
        return `<sup class="fn"><a href="#${esc(href)}" id="r-${esc(href)}" aria-label="Note ${esc(id)}">${esc(id)}</a></sup>`
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return `<strong>${fx ? fixate(esc(part.slice(2, -2))) : esc(part.slice(2, -2))}</strong>`
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return `<em>${fx ? fixate(esc(part.slice(1, -1))) : esc(part.slice(1, -1))}</em>`
      }
      return fx ? fixate(esc(part)) : esc(part)
    })
    .join('')
}

// Plain text for search, speech, meta descriptions: markup and markers removed.
export function plain(text) {
  return String(text).replace(/\[\^[^\]]+\]/g, '').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\s+/g, ' ').trim()
}

export const WORD_RE = WORD
export function wordCount(text) {
  return (plain(text).match(WORD) || []).length
}

export function number(n) {
  return Number(n).toLocaleString('en-US')
}

// Reading time at a relaxed 200 words per minute.
export function readingTime(words) {
  const m = Math.max(1, Math.round(words / 200))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}
