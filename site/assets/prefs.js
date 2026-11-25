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
})()
