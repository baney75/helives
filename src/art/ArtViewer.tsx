import { useEffect, useRef, useState } from 'react'
import { ARTWORKS, type Artwork } from './catalog.ts'
import { ArtScene } from './ArtScene.tsx'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'

export function ArtViewer({ artwork, onClose }: { artwork: Artwork; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState(artwork)
  const reduced = usePrefersReducedMotion()
  const visible = useDocumentVisible()
  const [paused, setPaused] = useState(false)
  const index = ARTWORKS.findIndex(art => art.id === selected.id)
  const move = (direction: number) => setSelected(ARTWORKS[(index + direction + ARTWORKS.length) % ARTWORKS.length]!)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog className="art-viewer" ref={dialog} aria-labelledby="art-title" onCancel={onClose} onClose={onClose} onKeyDown={event => {
    if (event.target instanceof HTMLSelectElement) return
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
  }}>
    <div className="art-viewer-stage"><ArtScene key={selected.id} artwork={selected} still={reduced || paused || !visible} /></div>
    <header><p>{selected.bookTitle} <span>· {String(index + 1).padStart(2, '0')} / 66</span></p><button type="button" onClick={onClose} autoFocus>Close artwork</button></header>
    <footer>
      <div><p className="hero-kicker">A visual meditation</p><h2 id="art-title">{selected.title}</h2></div>
      <div className="art-viewer-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous artwork">Previous</button>
        <label><span className="sr-only">Choose a book artwork</span><select aria-label="Choose a book artwork" value={selected.id} onChange={event => setSelected(ARTWORKS.find(art => art.id === event.target.value)!)}>{ARTWORKS.map(art => <option value={art.id} key={art.id}>{art.bookTitle}</option>)}</select></label>
        <button type="button" onClick={() => move(1)} aria-label="Next artwork">Next</button>
        <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? 'Resume motion' : 'Pause motion'}</button>
      </div>
    </footer>
  </dialog>
}
