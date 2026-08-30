import { useEffect, useState } from 'react'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { BrandMark } from '../site/BrandMark.tsx'
import { formatCountdown, msUntilNextHour, passageAt } from './clock.ts'
import { bibleGatewayHref } from './gateway.ts'
import { Sign } from './Sign.tsx'
import type { Motif } from './types.ts'
import { VerseText } from './VerseText.tsx'

/** Authored exhortation, one line per motif. Never presented as Scripture. */
const MOTIF_LINE: Record<Motif, string> = {
  light: 'Even now, light is breaking in.',
  water: 'Be still; the deep is not without God.',
  lamp: 'His word lights the next step.',
  vine: 'Stay near the vine, and grow.',
  life: 'The tomb is empty. He lives.',
}

export function HourLamp({ now }: { now?: Date }) {
  const reduced = usePrefersReducedMotion()
  const visible = useDocumentVisible()
  const [at, setAt] = useState(() => now ?? new Date())

  useEffect(() => {
    if (now) {
      setAt(now)
      return
    }
    const id = window.setInterval(() => setAt(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [now])

  const passage = passageAt(at)
  const remain = msUntilNextHour(at)
  return (
    <div
      className={reduced ? 'word-lamp' : 'word-lamp is-enter'}
      data-motif={passage.motif}
      data-length={passage.text.length > 220 ? 'long' : 'short'}
      data-paused={visible ? undefined : 'true'}
      key={passage.ref}
    >
      <div className="lamp-glow" aria-hidden="true" />
      <div className="word-copy">
        <p className="hero-mark">
          <BrandMark size={48} framed />
        </p>
        <h1>He Lives</h1>
        <p className="hero-kicker">This hour</p>
        <p className="hero-verse">
          <VerseText spans={passage.spans} />
        </p>
        <p className="hero-cite">{passage.ref} · King James Version</p>
        <p className="hero-motif">{MOTIF_LINE[passage.motif]}</p>
      </div>
      <Sign motif={passage.motif} reducedMotion={reduced} />
      <div className="word-acts">
        <p className="hero-actions">
          <a
            className="btn"
            href={bibleGatewayHref(passage.gatewayQuery)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore more
            <span className="sr-only"> on Bible Gateway, opens in a new tab</span>
          </a>
          <a className="btn quiet" href="/scriptures">
            The Scriptures
          </a>
        </p>
        <div className="word-remain">
          <p className="word-remain-label">New scripture every hour</p>
          <p className="word-remain-time">{formatCountdown(remain)}</p>
          <div className="word-remain-rail" aria-hidden="true">
            <span style={{ transform: `scaleX(${remain / 3_600_000})` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
