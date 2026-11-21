// Stroke icons as SVG paths in currentColor. Decorative: hidden from assistive technology,
// every control that uses one also has a visible or aria label.
const P = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  type: '<path d="M4 19 9.5 5h1L16 19"/><path d="M6.2 14h7.6"/><path d="M17 19v-6.5a2.5 2.5 0 0 1 5 0V19"/><path d="M22 15.5h-5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  sound: '<path d="M3 10v4"/><path d="M7 7v10"/><path d="M11 4v16"/><path d="M15 8v8"/><path d="M19 11v2"/>',
  prev: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  article: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v6H4V6h6"/>',
}
export function icon(name, size = 20) {
  const body = P[name]
  if (!body) throw new Error(`unknown icon ${name}`)
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
}

export function brandMark(size = 22) {
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="7" y="2" width="2" height="12" fill="currentColor"/><rect x="3" y="5" width="10" height="2" fill="currentColor"/><rect x="7" y="5" width="2" height="2" fill="var(--dawn)"/></svg>`
}
