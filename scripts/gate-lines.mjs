// The gate's parts and lines as JSON, for audio/gate_voice.py.
import { PARTS } from '../site/assets/gate.js'
import { GATE_SECTIONS } from '../site/lib/gate-audio.mjs'
console.log(JSON.stringify(PARTS.map((p, i) => ({ section: GATE_SECTIONS[i], lines: p.lines }))))
