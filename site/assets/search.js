import { refAction } from './ref.js'
// Search page. A Bible reference goes straight to the passage; anything else asks /api/search.
const form = document.getElementById('search-form')
const input = document.getElementById('sq')
const status = document.getElementById('search-status')
const list = document.getElementById('results')
let books = null

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function loadBooks() {
  if (!books) books = await fetch('/assets/books.json').then((r) => r.json())
  return books
}

function mark(snip) {
  // the API marks hits with \u0002 ... \u0003 so the text can be escaped safely here
  return esc(snip).split(String.fromCharCode(2)).join('<mark>').split(String.fromCharCode(3)).join('</mark>')
}

async function run(push) {
  const q = input.value.trim()
  const scope = (document.querySelector('input[name="scope"]:checked') || {}).value || 'all'
  if (push) history.replaceState(null, '', q ? `/search/?q=${encodeURIComponent(q)}${scope !== 'all' ? `&scope=${scope}` : ''}` : '/search/')
  list.innerHTML = ''
  let bookLink = null
  if (!q) { status.textContent = ''; return }
  if (scope === 'all' || scope === 'bible') {
    const act = refAction(q, await loadBooks())
    if (act.go) { status.textContent = 'Opening the passage…'; location.href = act.go; return }
    bookLink = act.book || null
  }
  status.textContent = 'Searching…'
  let data
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope}`)
    if (!r.ok) throw new Error(String(r.status))
    data = await r.json()
  } catch {
    status.textContent = 'Search is not available right now. Please try again in a moment.'
    return
  }
  const n = data.results.length
  status.textContent = n ? `${n === data.limit ? `First ${n}` : n} result${n === 1 ? '' : 's'} for “${q}”` : `Nothing found for “${q}”. Try fewer or different words.`
  const book = bookLink ? `<li><a class="ref" href="${esc(bookLink)}">Open the book of ${esc(q)}</a><span class="meta"> · Bible</span></li>` : ''
  list.innerHTML = book + data.results
    .map((r) => `<li><a class="ref" href="${esc(r.url)}">${esc(r.title)}</a>${r.where ? `<span class="meta"> · ${esc(r.where)}</span>` : ''}<p class="snip">${mark(r.snip)}</p></li>`)
    .join('')
}

form.addEventListener('submit', (e) => { e.preventDefault(); run(true) })
document.querySelectorAll('input[name="scope"]').forEach((i) => i.addEventListener('change', () => run(true)))
const params = new URLSearchParams(location.search)
if (params.get('scope')) {
  const r = document.querySelector(`input[name="scope"][value="${CSS.escape(params.get('scope'))}"]`)
  if (r) r.checked = true
}
if (params.get('q')) { input.value = params.get('q'); run(false) }
