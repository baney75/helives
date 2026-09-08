import { useEffect, useRef, useState } from 'react'
import { ARTWORKS, LIBRARY, scenesForBook, type Artwork } from './catalog.ts'
import { ArtBackdrop } from './ArtBackdrop.tsx'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'

export function ArtViewer({ artwork, onClose }: { artwork: Artwork; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closingForUnmount = useRef(false)
  const [selected, setSelected] = useState(artwork)
  const reduced = usePrefersReducedMotion()
  const visible = useDocumentVisible()
  const [paused, setPaused] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [idle, setIdle] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsed = useRef(0)
  const index = LIBRARY.findIndex(art => art.id === selected.id)
  const bookScenes = scenesForBook(selected.bookId)
  const sceneIndex = bookScenes.findIndex(art => art.id === selected.id)
  const choose = (art: Artwork) => { elapsed.current = 0; setSelected(art); setFailed(null) }
  const move = (direction: number) => choose(LIBRARY[(index + direction + LIBRARY.length) % LIBRARY.length]!)
  const reveal = () => {
    setIdle(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (playing) idleTimer.current = setTimeout(() => setIdle(true), 6000)
  }
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { closingForUnmount.current = true; element?.close() }
  }, [])
  useEffect(() => {
    setIdle(false)
    if (playing) idleTimer.current = setTimeout(() => setIdle(true), 6000)
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [playing])
  useEffect(() => {
    if (!playing || paused || !visible || failed || loaded !== selected.id) return
    let previous = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      elapsed.current += Math.max(0, now - previous)
      previous = now
      if (elapsed.current >= 60000) {
        elapsed.current = 0
        setSelected(current => LIBRARY[(LIBRARY.findIndex(art => art.id === current.id) + 1) % LIBRARY.length]!)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [playing, paused, visible, failed, loaded, selected.id])
  return <dialog className={`art-viewer${playing ? ' is-playing' : ''}${idle ? ' is-idle' : ''}`} ref={dialog} aria-labelledby="art-title" onCancel={onClose} onClose={() => { if (closingForUnmount.current) { closingForUnmount.current = false; return }; onClose() }}
    onPointerMove={reveal} onPointerDown={reveal} onFocusCapture={reveal} onKeyDown={event => {
      reveal()
      if (event.target instanceof HTMLSelectElement) return
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    }}>
    <div className="art-viewer-stage"><ArtBackdrop artwork={selected} still={reduced || paused || !visible} retry={retry}
      onReady={id => { if (id === selected.id) { setLoaded(id); setFailed(null) } }} onFailure={id => { if (id === selected.id) { setFailed(id); setPlaying(false) } }} /></div>
    <header><p>{selected.bookTitle} <span>· Scene {String(sceneIndex + 1).padStart(2, '0')} / {bookScenes.length} · {String(index + 1).padStart(3, '0')} / {LIBRARY.length}</span></p><button type="button" onClick={onClose} autoFocus>Close artwork</button></header>
    {failed === selected.id && <div className="art-error" role="status"><p>This illustration couldn’t load.</p><button type="button" onClick={() => { setFailed(null); setRetry(value => value + 1) }}>Retry artwork</button><button type="button" onClick={() => move(1)}>Skip artwork</button></div>}
    <footer>
      <div className="art-viewer-caption"><p className="hero-kicker">{playing ? 'The collection · one minute at a time' : 'A visual meditation'}</p><h2 id="art-title">{selected.title}</h2></div>
      <div className="art-viewer-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous artwork">Previous scene</button>
        <label><span className="sr-only">Choose a book artwork</span><select aria-label="Choose a book artwork" value={selected.bookId} onChange={event => choose(scenesForBook(event.target.value)[0]!)}>{ARTWORKS.map(art => <option value={art.id} key={art.id}>{art.bookTitle}</option>)}</select></label>
        <output className="art-scene-indicator" aria-live="polite">Scene {sceneIndex + 1} of {bookScenes.length}</output>
        <button type="button" onClick={() => move(1)} aria-label="Next artwork">Next scene</button>
        <button type="button" onClick={event => { setPlaying(value => !value); if (event.detail) event.currentTarget.blur() }} aria-pressed={playing}>{playing ? 'Stop collection' : 'Play collection'}</button>
        <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? 'Resume motion' : 'Pause motion'}</button>
      </div>
    </footer>
  </dialog>
}
