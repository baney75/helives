// The daily gate's recordings (site/assets/gate.js). audio/gate.toml is rendered by the library
// narrator as work "gate", one section per part. The gate plays them only when all three are in
// audio/manifest.json; with any missing, the build writes nothing and the gate uses device speech.
export const GATE_WORK = 'gate'
export const GATE_SECTIONS = ['lords-prayer', 'apostles-creed', 'illumination']

// audio: the Map from loadAudio() ("<work>/<section>" -> manifest item with absolute url and timing).
export function gateAudio(audio) {
  const parts = []
  for (const section of GATE_SECTIONS) {
    const e = audio && audio.get(`${GATE_WORK}/${section}`)
    if (!e || !e.url || !e.timing) return null
    parts.push({ section, src: e.url, timing: e.timing })
  }
  return { parts }
}
