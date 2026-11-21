import { esc, html, raw } from './html.mjs'
import { brandMark, icon } from './icons.mjs'

export const SITE = 'https://helives.dev'
export const ASSET_VERSION = { v: '1' } // set by build.mjs to a content hash

const THEMES = [
  ['auto', 'Match device'],
  ['night', 'Night'],
  ['dusk', 'Dusk (soft)'],
  ['paper', 'Paper'],
  ['sepia', 'Sepia'],
  ['contrast', 'High contrast'],
]
const FONTS = [
  ['serif', 'Serif'],
  ['sans', 'Hyperlegible'],
  ['dyslexic', 'OpenDyslexic'],
]

function seg(name, options, legend) {
  return html`<fieldset class="field"><legend>${legend}</legend><div class="seg">${options.map(
    ([v, label]) => html`<label><input type="radio" name="${name}" value="${v}"><span>${label}</span></label>`,
  )}</div></fieldset>`
}

function settingsSheet() {
  return html`<dialog class="sheet" id="settings" aria-labelledby="settings-h">
<div class="sheet-head"><h2 id="settings-h">Reading settings</h2><button class="tool" data-close aria-label="Close settings">${raw(icon('close'))}</button></div>
<div class="sheet-body">
${seg('fx', [['on', 'On'], ['light', 'Light'], ['strong', 'Strong'], ['off', 'Off']], 'Focus bold (bolds the start of each word)')}
<p class="sample"><b>Gr</b>eat <b>a</b>rt <b>Th</b>ou, <b>O</b> <b>Lo</b>rd, <b>a</b>nd <b>gre</b>atly <b>t</b>o <b>b</b>e <b>pra</b>ised.</p>
${seg('theme', THEMES, 'Theme')}
${seg('font', FONTS, 'Font')}
<div class="field"><div class="row"><label for="fs">Text size</label><output id="fs-out" class="meta"></output></div><input type="range" id="fs" min="15" max="30" step="1"></div>
<div class="field"><div class="row"><label for="lh">Line spacing</label><output id="lh-out" class="meta"></output></div><input type="range" id="lh" min="1.4" max="2.4" step="0.1"></div>
<div class="field"><div class="row"><label for="ls">Letter spacing</label><output id="ls-out" class="meta"></output></div><input type="range" id="ls" min="0" max="0.12" step="0.02"></div>
<div class="field"><div class="row"><label for="ws">Word spacing</label><output id="ws-out" class="meta"></output></div><input type="range" id="ws" min="0" max="0.4" step="0.08"></div>
<div class="field"><div class="row"><label for="measure">Line length</label><output id="measure-out" class="meta"></output></div><input type="range" id="measure" min="26" max="48" step="2"></div>
${seg('vline', [['off', 'Paragraphs'], ['on', 'One verse per line']], 'Bible layout')}
${seg('vnum', [['on', 'Show'], ['off', 'Hide']], 'Verse numbers')}
${seg('notes', [['on', 'Show'], ['off', 'Hide']], 'Footnotes')}
${seg('ruler', [['off', 'Off'], ['on', 'Highlight band'], ['dim', 'Dim the rest']], 'Reading ruler (follows your pointer or tap)')}
<p class="meta">Settings stay on this device. Nothing is sent anywhere.</p>
<button class="btn quiet" type="button" data-reset>Reset to defaults</button>
</div></dialog>`
}

function soundsSheet() {
  const sounds = [
    ['off', 'Off'], ['brown', 'Brown noise'], ['pink', 'Pink noise'], ['white', 'White noise'],
    ['rain', 'Rain'], ['stream', 'Stream'], ['fire', 'Fireplace'], ['wind', 'Wind'],
  ]
  return html`<dialog class="sheet" id="sounds" aria-labelledby="sounds-h">
<div class="sheet-head"><h2 id="sounds-h">Background sound</h2><button class="tool" data-close aria-label="Close sounds">${raw(icon('close'))}</button></div>
<div class="sheet-body">
${seg('sound', sounds, 'Sound')}
<div class="field"><div class="row"><label for="vol">Volume</label><output id="vol-out" class="meta"></output></div><input type="range" id="vol" min="0" max="1" step="0.05"></div>
${seg('timer', [['0', 'No timer'], ['15', '15 min'], ['30', '30 min'], ['60', '60 min']], 'Stop after')}
<p class="meta">Sounds are made live in your browser; nothing is downloaded. They keep playing as you move between pages only while this tab stays open.</p>
</div></dialog>`
}

export function crumbs(trail) {
  if (!trail?.length) return ''
  const parts = trail.map((c, i) =>
    i === trail.length - 1
      ? html`<span aria-current="page">${c.title}</span>`
      : html`<a href="${c.href}">${c.title}</a><span class="sep" aria-hidden="true">/</span>`,
  )
  return html`<nav class="crumbs" aria-label="Breadcrumb">${parts}</nav>`
}

export function page({ title, description, path, trail = [], body, reader = false, head = '', bodyClass = '', noindex = false }) {
  const v = ASSET_VERSION.v
  const full = title ? `${title} · He Lives` : 'He Lives · A library of Scripture and the church'
  const url = SITE + path
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || 'A free, accessible library of the Berean Standard Bible, the church fathers, Augustine, Aquinas, the creeds and more.')}">
<link rel="canonical" href="${esc(url)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description || 'A free library of Scripture and the church.')}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:type" content="website">
<meta name="theme-color" content="#07060a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="mask-icon" href="/mask-icon.svg" color="#e8b86d">
<link rel="search" type="application/opensearchdescription+xml" title="He Lives" href="/opensearch.xml">
<link rel="stylesheet" href="/assets/site.css?v=${v}">
<script src="/assets/prefs.js?v=${v}"></script>
<script src="/assets/app.js?v=${v}" defer></script>
${head}
</head>
<body class="${esc(bodyClass)}">
<a class="skip" href="#main">Skip to text</a>
<header class="top"><div class="top-in">
<a class="brand" href="/" aria-label="He Lives, library home">${raw(brandMark(22))}<span>He Lives</span></a>
${crumbs(trail)}
<a class="tool" href="/search/" aria-label="Search">${raw(icon('search'))}<span class="lbl">Search</span></a>
<button class="tool" type="button" data-open="sounds" aria-label="Background sound">${raw(icon('sound'))}<span class="lbl">Sound</span></button>
<button class="tool" type="button" data-open="settings" aria-label="Reading settings">${raw(icon('type'))}<span class="lbl">Reading</span></button>
</div></header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="foot"><div class="foot-in">
<span>He Lives · Every text here is in the public domain.</span>
<a href="/about/">Sources and licenses</a>
<a href="/accessibility/">Accessibility</a>
<a href="/downloads/">Downloads</a>
<a href="https://github.com/baney75/helives">Source on GitHub</a>
</div></footer>
${reader ? '<div class="ruler" aria-hidden="true"></div>' : ''}
${settingsSheet()}
${soundsSheet()}
</body>
</html>
`
}
