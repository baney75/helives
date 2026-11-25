// The gate: once a day, before the library opens, the Lord's Prayer, the Apostles' Creed and a prayer for
// illumination are set out ready to be read. Nothing is locked: Enter and Escape open the library at once.
// prefs.js marks the page data-gate="due"; this module shows the gate and clears the mark.
// Texts: Book of Common Prayer (1928, public domain); Scripture: Berean Standard Bible (public domain).
// The prayers are read aloud only in Donovan's own voice (public/gate-voice/, listed by the build in
// /assets/gate-audio.json). Until those recordings exist there is no Listen button, and no synthetic
// or device voice is ever used here.

const V = new URL(import.meta.url).searchParams.get('v') || '1'

export const PARTS = [
  {
    title: 'The Lord’s Prayer',
    source: 'Matthew 6:9 to 13, as prayed in the Book of Common Prayer',
    lines: [
      'Our Father, who art in heaven, hallowed be thy Name.',
      'Thy kingdom come. Thy will be done, on earth as it is in heaven.',
      'Give us this day our daily bread.',
      'And forgive us our trespasses, as we forgive those who trespass against us.',
      'And lead us not into temptation, but deliver us from evil.',
      'For thine is the kingdom, and the power, and the glory, for ever and ever. Amen.',
    ],
  },
  {
    title: 'The Apostles’ Creed',
    source: 'Book of Common Prayer (1928)',
    lines: [
      'I believe in God the Father Almighty, Maker of heaven and earth:',
      'And in Jesus Christ his only Son our Lord:',
      'Who was conceived by the Holy Ghost, Born of the Virgin Mary:',
      'Suffered under Pontius Pilate, Was crucified, dead, and buried:',
      'He descended into hell; The third day he rose again from the dead:',
      'He ascended into heaven, And sitteth on the right hand of God the Father Almighty:',
      'From thence he shall come to judge the quick and the dead.',
      'I believe in the Holy Ghost: The holy Catholic Church; The Communion of Saints:',
      'The Forgiveness of sins: The Resurrection of the body: And the Life everlasting. Amen.',
    ],
  },
  {
    title: 'A prayer for illumination',
    source: 'Psalm 119:18; the Collect for the Second Sunday in Advent, Book of Common Prayer',
    lines: [
      'Open my eyes that I may see wondrous things from Your law.',
      'Blessed Lord, who hast caused all holy Scriptures to be written for our learning:',
      'Grant that we may in such wise hear them, read, mark, learn, and inwardly digest them,',
      'that by patience and comfort of thy holy Word, we may embrace, and ever hold fast,',
      'the blessed hope of everlasting life, which thou hast given us in our Saviour Jesus Christ.',
      'Come, Holy Spirit. Guide me into all truth, and make me a doer of the word. Amen.',
    ],
  },
]

const WARNING = [
  ['Above all, you must understand that no prophecy of Scripture comes from one’s own interpretation. For no such prophecy was ever brought forth by the will of man, but men spoke from God as they were carried along by the Holy Spirit.', '2 Peter 1:20 to 21'],
  ['However, when the Spirit of truth comes, He will guide you into all truth.', 'John 16:13'],
  ['Be doers of the word, and not hearers only. Otherwise, you are deceiving yourselves.', 'James 1:22'],
]

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function pass() {
  try { localStorage.setItem('hl:gate', today()) } catch {}
  document.cookie = `hl_gate=${today()}; max-age=172800; path=/; SameSite=Lax`
}

export function show() {
  window.HLGateShown = true // prefs.js reveals the page after 5 s only if the gate never showed
  const d = document.createElement('dialog')
  d.id = 'gate'
  d.className = 'gate'
  d.setAttribute('aria-labelledby', 'gate-h')
  d.innerHTML = `<div class="gate-scroll" tabindex="0" role="region" aria-labelledby="gate-h"><div class="gate-in">
<p class="kicker">Before you enter</p>
<h1 id="gate-h">Pray, then read</h1>
<p class="gate-lede">These pages hold the Word of God and the witness of His church. Do not read them by your own light. Scripture is not a private possession to be bent to what you already think. Ask the Holy Spirit to open your eyes, and resolve now to obey what He shows you.</p>
${PARTS.map((p, i) => `<section class="gate-part"><h2>${esc(p.title)}</h2><p class="meta">${esc(p.source)}</p><div class="gate-lines">${p.lines.map((l, j) => `<p data-line="${i}-${j}">${esc(l)}</p>`).join('')}</div></section>`).join('')}
<div class="gate-scripture">${WARNING.map(([t, r]) => `<blockquote><p>${esc(t)}</p><cite>${esc(r)}</cite></blockquote>`).join('')}</div>
</div></div>
<div class="gate-end"><div class="gate-bar"><button class="btn" type="button" data-gate-read hidden>Listen</button><button class="btn" type="button" data-gate-enter>Amen. Enter the library</button></div></div>`
  document.body.appendChild(d)
  d.showModal()
  const prayers = d.querySelector('.gate-scroll')
  prayers.classList.add('first') // no focus ring around the prayers until the reader has moved away once
  prayers.addEventListener('blur', () => prayers.classList.remove('first'), { once: true })
  prayers.focus() // so it opens at the top and the keyboard scrolls them
  document.documentElement.removeAttribute('data-gate') // the page behind stays inert under the modal

  const readBtn = d.querySelector('[data-gate-read]')

  // The recordings: [{section, src, timing}] in reading order, each with its timing items
  // ({id: "b<j>", start}) loaded up front. Any missing file means no recording is offered.
  let recordings = null
  fetch(`/assets/gate-audio.json?v=${V}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || !Array.isArray(j.parts) || j.parts.length !== PARTS.length) return null
      return Promise.all(j.parts.map((p) => fetch(p.timing).then((r) => (r.ok ? r.json() : Promise.reject(new Error(p.timing))))
        .then((t) => ({ src: p.src, items: (t.items || []).slice().sort((x, y) => x.start - y.start) }))))
    })
    .then((list) => {
      if (!list) return
      recordings = list
      readBtn.hidden = false
    })
    .catch(() => { recordings = null })
  let lit = null
  const light = (el) => {
    if (lit) lit.classList.remove('reading')
    lit = el
    if (!el) return
    el.classList.add('reading')
    el.scrollIntoView({ block: 'center' })
  }
  // One <audio> element, part by part, lighting [data-line="i-j"] from the timing item b<j> of part i,
  // the same way the library's Listen lights data-b.
  let audio = null
  let part = -1
  let playing = false
  const lineFor = (i, id) => (/^b\d+$/.test(id) ? d.querySelector(`[data-line="${i}-${id.slice(1)}"]`) : null)
  const stop = () => {
    playing = false
    if (audio) audio.pause()
    light(null)
    readBtn.textContent = 'Listen'
  }
  // A recording that will not load or play: withdraw the button; the prayers are still there to read.
  const fail = () => {
    if (!playing) return
    stop()
    readBtn.hidden = true
  }
  const playPart = (i) => {
    if (i >= recordings.length) return stop()
    part = i
    light(null)
    audio.src = recordings[i].src
    const p = audio.play()
    if (p && p.catch) p.catch((e) => { if (e && e.name !== 'AbortError') fail() })
  }
  const ensureAudio = () => {
    if (audio) return
    audio = document.createElement('audio')
    audio.preload = 'auto'
    audio.hidden = true
    d.appendChild(audio)
    audio.addEventListener('timeupdate', () => {
      if (!playing) return
      let hit = null
      for (const it of recordings[part].items) { if (it.start <= audio.currentTime) hit = it; else break }
      const el = hit ? lineFor(part, hit.id) : null
      if (el !== lit) light(el)
    })
    audio.addEventListener('ended', () => { if (playing) playPart(part + 1) })
    audio.addEventListener('error', fail)
  }
  readBtn.addEventListener('click', () => {
    if (playing) return stop()
    playing = true
    readBtn.textContent = 'Stop'
    ensureAudio()
    playPart(0)
  })
  d.querySelector('[data-gate-enter]').addEventListener('click', () => {
    pass()
    d.close()
  })
  d.addEventListener('cancel', pass) // Escape enters too
  d.addEventListener('close', () => {
    if (playing) stop()
    d.remove()
    const main = document.getElementById('main')
    if (main) main.focus({ preventScroll: true })
  })
}
