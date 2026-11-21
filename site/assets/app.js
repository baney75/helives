// He Lives library: dialogs, reading settings, ruler, place-keeping, video, audio, keys, filters.
// Works without it: every page is readable and navigable as plain HTML.
;(function () {
  'use strict'
  var HL = window.HL || { prefs: {}, defaults: {}, apply: function () { return {} } }
  var V = (document.currentScript && document.currentScript.src.split('?v=')[1]) || '1'
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
  }

  // ---------- dialogs ----------
  function openSheet(id) {
    var d = document.getElementById(id)
    if (!d || d.open) return
    if (id === 'settings') syncSettings()
    if (id === 'sounds') syncSounds()
    d.showModal()
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open]')
    if (t) { e.preventDefault(); openSheet(t.getAttribute('data-open')); return }
    var c = e.target.closest('[data-close]')
    if (c) { c.closest('dialog').close(); return }
    if (e.target.tagName === 'DIALOG') e.target.close() // backdrop click
  })

  // ---------- reading settings ----------
  var RANGE = { fs: function (v) { return v + 'px' }, lh: function (v) { return Number(v).toFixed(1) }, ls: function (v) { return Number(v).toFixed(2) + 'em' }, ws: function (v) { return Number(v).toFixed(2) + 'em' }, measure: function (v) { return Math.round(v * 2.2) + ' letters' } }
  function save() { store.set('hl:prefs', HL.prefs); HL.current = HL.apply(HL.prefs) }
  function syncSettings() {
    var cur = HL.current
    ;['fx', 'theme', 'font', 'vline', 'vnum', 'notes', 'ruler'].forEach(function (k) {
      $$('#settings input[name="' + k + '"]').forEach(function (i) { i.checked = i.value === String(cur[k]) })
    })
    Object.keys(RANGE).forEach(function (k) {
      var i = document.getElementById(k)
      if (!i) return
      i.value = cur[k]
      var o = document.getElementById(k + '-out')
      if (o) o.textContent = RANGE[k](cur[k])
    })
  }
  document.addEventListener('change', function (e) {
    var t = e.target
    if (!t.closest('#settings')) return
    if (t.type === 'radio') { HL.prefs[t.name] = t.value; save() }
  })
  document.addEventListener('input', function (e) {
    var t = e.target
    if (t.closest('#settings') && RANGE[t.id]) {
      HL.prefs[t.id] = Number(t.value); save()
      var o = document.getElementById(t.id + '-out')
      if (o) o.textContent = RANGE[t.id](t.value)
    }
  })
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-reset]')) { HL.prefs = {}; save(); syncSettings() }
  })

  // ---------- reading ruler ----------
  var ruler = $('.ruler')
  if (ruler) {
    var place = function (y) { ruler.style.top = y - ruler.offsetHeight / 2 + 'px' }
    document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') place(e.clientY) }, { passive: true })
    document.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' && e.target.closest('.text')) place(e.clientY) }, { passive: true })
    place(window.innerHeight / 3)
  }

  // ---------- place keeping ----------
  var reader = $('.reader')
  if (reader) {
    var work = reader.getAttribute('data-work')
    var pg = reader.getAttribute('data-page')
    store.set('hl:last', { href: location.pathname, title: reader.getAttribute('data-title') })
    store.set('hl:at:' + work, location.pathname)
    var seen = store.get('hl:read:' + work, [])
    if (seen.indexOf(pg) < 0) { seen.push(pg); store.set('hl:read:' + work, seen) }
  }
  var cont = $('#continue')
  var last = store.get('hl:last', null)
  if (cont && last && last.href) {
    var a = $('a', cont)
    a.href = last.href
    a.textContent = last.title
    cont.hidden = false
  }
  $$('.chapters[data-book]').forEach(function (ul) {
    var seen = store.get('hl:read:' + ul.getAttribute('data-book'), [])
    $$('a[data-ch]', ul).forEach(function (a) { if (seen.indexOf(a.getAttribute('data-ch')) >= 0) { a.classList.add('read'); a.setAttribute('aria-label', a.getAttribute('aria-label') + ', read') } })
  })
  $$('[data-resume]').forEach(function (a) {
    var at = store.get('hl:at:' + a.getAttribute('data-resume'), null)
    if (at) { a.href = at; var l = $('span', a); if (l) l.textContent = 'Continue reading' }
  })

  // ---------- video: load YouTube only on press ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button.yt[data-yt]')
    if (!b) return
    var f = document.createElement('iframe')
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.getAttribute('data-yt')) + '?autoplay=1&rel=0'
    f.title = b.getAttribute('aria-label').replace(/^Play video: /, '')
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    f.allowFullscreen = true
    f.referrerPolicy = 'strict-origin-when-cross-origin'
    var wrap = document.createElement('div')
    wrap.className = 'yt'
    wrap.appendChild(f)
    b.replaceWith(wrap)
  })

  // ---------- print ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-print]')
    if (!b) return
    var href = b.getAttribute('data-print')
    if (href && href !== location.pathname) location.href = href + '?print=1'
    else window.print()
  })
  if (/[?&]print=1/.test(location.search)) {
    var go = function () { setTimeout(function () { window.print() }, 150) }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go)
    else window.addEventListener('load', go)
  }

  // ---------- filters on list pages ----------
  $$('form[data-nosubmit]').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault() }) })
  $$('input[data-filter]').forEach(function (inp) {
    var items = $$(inp.getAttribute('data-filter'))
    var empty = $('[data-empty]')
    var run = function () {
      var terms = inp.value.toLowerCase().split(/\s+/).filter(Boolean)
      var shown = 0
      items.forEach(function (el) {
        var text = el.getAttribute('data-text') || el.textContent.toLowerCase()
        var ok = terms.every(function (t) { return text.indexOf(t) >= 0 })
        el.hidden = !ok
        if (ok) shown++
      })
      if (empty) empty.hidden = shown > 0
    }
    inp.addEventListener('input', run)
    var q = new URLSearchParams(location.search).get('filter')
    if (q) { inp.value = q; run() }
  })

  // ---------- keyboard ----------
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return
    var tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || $('dialog[open]')) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      var l = $(e.key === 'ArrowLeft' ? 'link[rel=prev], a[rel=prev]' : 'link[rel=next], a[rel=next]')
      if (l) location.href = l.href
    } else if (e.key === '/') {
      e.preventDefault()
      var s = $('#sq') || $('#q')
      if (s) s.focus()
      else location.href = '/search/'
    } else if (e.key === 'r' || e.key === 'R') {
      openSheet('settings')
    }
  })

  // ---------- background sound (generated live, loaded on demand) ----------
  var sounds = null
  function withSounds(cb) {
    if (sounds) return cb(sounds)
    import('/assets/sounds.js?v=' + V).then(function (m) { sounds = m; cb(m) })
  }
  var sp = store.get('hl:sound', { kind: 'off', vol: 0.5, until: 0 })
  function syncSounds() {
    $$('#sounds input[name="sound"]').forEach(function (i) { i.checked = i.value === sp.kind })
    var v = document.getElementById('vol')
    if (v) { v.value = sp.vol; document.getElementById('vol-out').textContent = Math.round(sp.vol * 100) + '%' }
    var left = sp.until ? Math.max(0, Math.round((sp.until - Date.now()) / 60000)) : 0
    $$('#sounds input[name="timer"]').forEach(function (i) { i.checked = left ? Number(i.value) >= left && Number(i.value) - left < 15 : i.value === '0' })
    $$('[data-open="sounds"]').forEach(function (b) { b.setAttribute('aria-pressed', sp.kind !== 'off' ? 'true' : 'false') })
  }
  function applySound() {
    store.set('hl:sound', sp)
    syncSounds()
    withSounds(function (m) { m.play(sp.kind, sp.vol, sp.until) })
  }
  document.addEventListener('change', function (e) {
    var t = e.target
    if (!t.closest('#sounds')) return
    if (t.name === 'sound') { sp.kind = t.value; applySound() }
    if (t.name === 'timer') { var n = Number(t.value); sp.until = n ? Date.now() + n * 60000 : 0; applySound() }
  })
  document.addEventListener('input', function (e) {
    if (e.target.id === 'vol') { sp.vol = Number(e.target.value); applySound() }
  })
  syncSounds()
  // A sound left on keeps going on the next page after the first touch or key (browsers need a gesture).
  if (sp.kind !== 'off' && (!sp.until || sp.until > Date.now())) {
    var resume = function () {
      document.removeEventListener('pointerdown', resume, true)
      document.removeEventListener('keydown', resume, true)
      if (sounds && sounds.isPlaying()) return
      withSounds(function (m) { m.play(sp.kind, sp.vol, sp.until) })
    }
    document.addEventListener('pointerdown', resume, true)
    document.addEventListener('keydown', resume, true)
  } else if (sp.kind !== 'off') {
    sp.kind = 'off'; store.set('hl:sound', sp); syncSounds()
  }
  window.addEventListener('hl:sound-ended', function () { sp.kind = 'off'; sp.until = 0; store.set('hl:sound', sp); syncSounds() })

  // ---------- listen: audiobook with the verse or paragraph followed ----------
  // data-listen holds the page's playlist: [{s: section id, src: .m4a, t: timing .json}], in reading order.
  // A timing file is {items: [{id: "v16" | "b4" | "title", start: seconds}]} (audio/assemble.py).
  var audio = null
  var list = []
  var cur = -1
  var timing = null
  var lit = null
  function anchorEl(sid, id) {
    if (id === 'title') return $('#s-' + CSS.escape(sid)) || $('main h1')
    // a page may hold several chapters of a work (Tobit 1 to 14): find the verse within its own section
    if (id.charAt(0) === 'v') return $('.text .v[data-s="' + CSS.escape(sid) + '"][data-v="' + CSS.escape(id.slice(1)) + '"]') || $('.text .v[data-v="' + CSS.escape(id.slice(1)) + '"]')
    return $('.text [data-b="' + CSS.escape(sid + ':' + id.slice(1)) + '"]')
  }
  function light(el) {
    if (el === lit) return
    if (lit) lit.classList.remove('reading')
    lit = el
    if (!el) return
    el.classList.add('reading')
    var r = el.getBoundingClientRect()
    if (r.top < 80 || r.bottom > window.innerHeight - 100) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  function setListening(on) {
    $$('[data-listen]').forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false')
      var l = $('.lbl', b)
      if (l) l.textContent = on ? 'Pause' : 'Listen'
    })
  }
  function load(i) {
    cur = i
    timing = null
    var item = list[i]
    audio.src = item.src
    if (item.t) fetch(item.t).then(function (r) { return r.ok ? r.json() : null }).then(function (j) {
      if (cur === i && j && j.items) timing = j.items.slice().sort(function (x, y) { return x.start - y.start })
    }).catch(function () {})
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-listen]')
    if (!b) return
    if (!audio) {
      try { list = JSON.parse(b.getAttribute('data-listen')) || [] } catch { list = [] }
      if (!list.length) return
      audio = new Audio()
      audio.preload = 'auto'
      audio.addEventListener('timeupdate', function () {
        if (!timing) return
        var now = audio.currentTime
        var hit = null
        for (var k = 0; k < timing.length && timing[k].start <= now; k++) hit = timing[k]
        light(hit ? anchorEl(list[cur].s, hit.id) : null)
      })
      audio.addEventListener('ended', function () {
        light(null)
        if (cur + 1 < list.length) { load(cur + 1); audio.play(); return }
        setListening(false)
        var next = $('a[rel=next]')
        if (next && store.get('hl:autonext', true)) location.href = next.href + '#listen'
      })
      audio.addEventListener('pause', function () { if (!audio.ended) setListening(false) })
      audio.addEventListener('play', function () { setListening(true) })
      load(0)
    }
    if (audio.paused) audio.play()
    else audio.pause()
  })
  // Continuing a listening session from the previous chapter.
  if (location.hash === '#listen') {
    var lb = $('[data-listen]')
    history.replaceState(null, '', location.pathname)
    if (lb) {
      lb.focus()
      var startOnGesture = function () { document.removeEventListener('pointerdown', startOnGesture, true); if (!audio || audio.paused) lb.click() }
      // Most browsers allow play() right after a navigation that began with a gesture; if not, the next tap starts it.
      lb.click()
      setTimeout(function () { if (!audio || audio.paused) document.addEventListener('pointerdown', startOnGesture, true) }, 500)
    }
  }

  // ---------- the daily gate ----------
  if (document.documentElement.getAttribute('data-gate') === 'due') {
    window.HLGateShown = true
    import('/assets/gate.js?v=' + V).then(function (m) { m.show() }).catch(function () { document.documentElement.removeAttribute('data-gate') })
  }

  // ---------- search page ----------
  if ($('#search-form')) import('/assets/search.js?v=' + V)
})()
