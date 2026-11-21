// Applies saved reading settings before first paint. Kept tiny and blocking on purpose.
;(function () {
  var D = { fx: 'on', theme: 'auto', font: 'serif', fs: 19, lh: 1.7, ls: 0, ws: 0, measure: 38, vline: 'off', vnum: 'on', notes: 'on', ruler: 'off' }
  var p = {}
  try { p = JSON.parse(localStorage.getItem('hl:prefs') || '{}') || {} } catch {}
  var root = document.documentElement
  function apply(prefs) {
    var s = {}
    for (var k in D) s[k] = prefs[k] !== undefined ? prefs[k] : D[k]
    if (s.theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', s.theme)
    ;['fx', 'font', 'vline', 'vnum', 'notes', 'ruler'].forEach(function (k) { root.setAttribute('data-' + k, s[k]) })
    var st = root.style
    st.setProperty('--fs', s.fs + 'px')
    st.setProperty('--lh', String(s.lh))
    st.setProperty('--ls', s.ls + 'em')
    st.setProperty('--ws', s.ws + 'em')
    st.setProperty('--measure', s.measure + 'rem')
    return s
  }
  window.HL = { defaults: D, prefs: p, apply: apply, current: apply(p) }
  // The daily gate (assets/gate.js). Due once per calendar day on this device; crawlers pass.
  // If the gate script never loads, the page shows anyway after 5 s so no one is locked out.
  try {
    var d = new Date()
    var day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)
    var seen = null
    try { seen = localStorage.getItem('hl:gate') } catch {}
    if (!seen) { var m = document.cookie.match(/(?:^|; )hl_gate=([^;]+)/); seen = m && m[1] }
    var bot = /bot|crawl|spider|slurp|bingpreview|lighthouse/i.test(navigator.userAgent)
    if (seen !== day && !bot && location.search.indexOf('print=1') < 0) {
      root.setAttribute('data-gate', 'due')
      setTimeout(function () { if (!window.HLGateShown) root.removeAttribute('data-gate') }, 5000)
    }
  } catch {}
})()
