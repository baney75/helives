// Background sound made live with the Web Audio API. Nothing is downloaded.
// Each sound is a long noise buffer shaped by filters and slow, gentle movement; no sudden loud events.
let ctx = null
let master = null
let nodes = []
let kind = 'off'
let stopTimer = 0

const SECONDS = 12

function buffer(type) {
  const n = ctx.sampleRate * SECONDS
  const b = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      if (type === 'white') d[i] = w * 0.25
      else if (type === 'pink') {
        // Paul Kellet's refined pink filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.06
        b6 = w * 0.115926
      } else {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 2.6
      }
    }
    // crossfade the ends so the loop has no click
    const f = Math.floor(ctx.sampleRate * 0.5)
    for (let i = 0; i < f; i++) {
      const k = i / f
      d[i] = d[i] * k + d[n - f + i] * (1 - k)
    }
  }
  return b
}

function src(type) {
  const s = ctx.createBufferSource()
  s.buffer = buffer(type)
  s.loop = true
  s.loopEnd = SECONDS - 0.5
  s.start()
  nodes.push(s)
  return s
}
function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  nodes.push(f)
  return f
}
function gain(v) {
  const g = ctx.createGain()
  g.gain.value = v
  nodes.push(g)
  return g
}
// Slow movement on a parameter: an oscillator well under 1 Hz.
function lfo(param, rate, depth) {
  const o = ctx.createOscillator()
  o.frequency.value = rate
  const g = gain(depth)
  o.connect(g).connect(param)
  o.start()
  nodes.push(o)
}

const RECIPES = {
  white: () => src('white').connect(filter('lowpass', 9000)).connect(gain(0.8)),
  pink: () => src('pink').connect(gain(1)),
  brown: () => src('brown').connect(gain(0.9)),
  rain: () => {
    const g = gain(0.9)
    src('white').connect(filter('highpass', 900)).connect(filter('lowpass', 6500)).connect(gain(0.55)).connect(g)
    src('pink').connect(filter('lowpass', 500)).connect(gain(0.5)).connect(g)
    lfo(g.gain, 0.07, 0.08)
    return g
  },
  stream: () => {
    const bp = filter('bandpass', 700, 0.6)
    lfo(bp.frequency, 0.11, 260)
    const g = gain(1.1)
    src('brown').connect(bp).connect(g)
    src('pink').connect(filter('bandpass', 2200, 0.8)).connect(gain(0.18)).connect(g)
    lfo(g.gain, 0.05, 0.12)
    return g
  },
  fire: () => {
    const g = gain(1)
    src('brown').connect(filter('lowpass', 320)).connect(gain(1.1)).connect(g)
    // soft crackle: pink noise through a narrow high band whose level flickers
    const crackle = gain(0.0)
    src('pink').connect(filter('bandpass', 3200, 3)).connect(crackle).connect(g)
    lfo(crackle.gain, 1.7, 0.22)
    lfo(crackle.gain, 0.43, 0.15)
    return g
  },
  wind: () => {
    const bp = filter('bandpass', 420, 1.2)
    lfo(bp.frequency, 0.06, 220)
    const g = gain(1.3)
    src('pink').connect(bp).connect(g)
    lfo(g.gain, 0.09, 0.35)
    return g
  },
}

function teardown() {
  for (const n of nodes) {
    try { if (n.stop) n.stop() } catch {}
    try { n.disconnect() } catch {}
  }
  nodes = []
}

export function isPlaying() {
  return kind !== 'off' && ctx && ctx.state === 'running'
}

export function play(next, volume, until) {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  const now = ctx.currentTime
  const vol = Math.max(0, Math.min(1, volume)) * 0.6
  clearTimeout(stopTimer)
  if (next === 'off' || !RECIPES[next]) {
    master.gain.setTargetAtTime(0, now, 0.4)
    setTimeout(teardown, 1800)
    kind = 'off'
    return
  }
  if (next !== kind) {
    teardown()
    master.gain.setValueAtTime(0, now)
    RECIPES[next]().connect(master)
    kind = next
  }
  // fade in, never jump
  master.gain.setTargetAtTime(vol, now, 0.8)
  if (until) {
    const ms = until - Date.now()
    if (ms <= 0) return play('off', 0, 0)
    // gentle 30 second fade at the end of the timer
    stopTimer = setTimeout(() => {
      master.gain.setTargetAtTime(0, ctx.currentTime, 10)
      setTimeout(() => { teardown(); kind = 'off'; window.dispatchEvent(new Event('hl:sound-ended')) }, 30000)
    }, Math.max(0, ms - 30000))
  }
}
