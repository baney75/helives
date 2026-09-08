import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { formatCountdown } from './clock.ts'
import { bibleGatewayHref } from './gateway.ts'
import { artworkForPassage } from '../art/catalog.ts'
import { VerseText } from './VerseText.tsx'
import { MusicControls } from '../music/MusicControls.tsx'
import { Atmosphere } from './Atmosphere.tsx'
import { useRotation } from './useRotation.ts'
import { rotationLabel } from './rotation.ts'

export function HourLamp({ now }: { now?: Date }) {
  const reduced = usePrefersReducedMotion()
  const rotation = useRotation(now)
  const { passage, remain } = rotation
  const artwork = artworkForPassage(passage.ref, rotation.sequence, rotation.epoch)
  return (
    <div
      className="word-lamp reading-lamp"
      data-motif={passage.motif}
      data-length={passage.text.length > 220 ? 'long' : 'short'}
      data-paused={!rotation.visible || rotation.paused ? 'true' : undefined}
    >
      <Atmosphere artwork={artwork} motif={passage.motif} still={reduced || rotation.paused || !rotation.visible} />
      <div className={`word-copy${reduced ? '' : ' verse-arrive'}`} key={rotation.sequence}>
        <h1 className="sr-only">He Lives</h1>
        <p className="hero-verse">
          <VerseText spans={passage.spans} />
        </p>
        <p className="hero-cite">{passage.ref} · King James Version</p>
      </div>
      <div className="word-sign" aria-hidden="true"><span className="art-caption"><span className="art-caption-label">The illustration</span><span className="art-caption-title">{artwork.title}</span></span></div>
      <div className="word-acts">
        <div className="hero-actions">
          <a
            className="btn"
            href={bibleGatewayHref(passage.gatewayQuery)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore more
            <span className="sr-only"> on Bible Gateway, opens in a new tab</span>
          </a>
          <MusicControls />
          <span className="reading-transport"><button type="button" className="reading-settings" aria-pressed={rotation.paused} aria-label={rotation.paused ? 'Resume Scripture rotation' : 'Pause Scripture rotation'} onClick={rotation.toggle}>{rotation.paused ? 'Resume' : 'Pause'}</button>
          <button type="button" className="reading-settings" aria-label="Next Scripture" onClick={() => rotation.move(1)}>Next</button></span>
        </div>
        <div className="word-remain">
          <p className="word-remain-label">{rotation.paused ? 'Rotation paused' : rotationLabel(rotation.seconds)}</p>
          <p className="word-remain-time">{formatCountdown(remain)}</p>
          <div className="word-remain-rail" aria-hidden="true">
            <span style={{ transform: `scaleX(${remain / (rotation.seconds * 1000)})` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
