import { hasVoice } from '../genesis/voiced.ts'
import type { GenesisClock } from '../hooks/useGenesisClock.ts'
import { Timeline } from './Timeline.tsx'

const SPEEDS = [0.5, 1, 2, 4] as const

function nextSpeed(current: number): number {
  const index = SPEEDS.indexOf(current as (typeof SPEEDS)[number])
  return SPEEDS[(index + 1) % SPEEDS.length] ?? 1
}

type HUDProps = {
  clock: GenesisClock
}

export function HUD({ clock }: HUDProps) {
  const scene = clock.scene
  const science = scene.kind === 'science'
  const voiced = hasVoice(scene.id)

  return (
    <div className="hud">
      <header className="topbar">
        <div className="brand">
          <p className="wordmark">He Lives</p>
          <p className="tag">Genesis</p>
        </div>
        <dl className="readouts">
          <div>
            <dt>Place</dt>
            <dd>{scene.kicker}</dd>
          </div>
          <div>
            <dt>Text</dt>
            <dd>{scene.kind === 'scripture' ? 'KJV' : voiced ? 'Spoken' : 'On screen'}</dd>
          </div>
          <div>
            <dt>Cite</dt>
            <dd>{scene.citation}</dd>
          </div>
        </dl>
      </header>

      <section className="narration" aria-live="polite">
        <p className="epoch-kicker">{scene.kicker}</p>
        <h1>{scene.name}</h1>
        <p className="headline">{scene.headline}</p>
        <p className="body">{scene.body}</p>
        {science ? (
          <p className="afterword-link">
            <a href="/genesis/afterword">Read the sources</a>
          </p>
        ) : null}
      </section>

      <footer className="dock">
        <div className="transport">
          <div className="transport-rail">
            <button type="button" className="icon-btn" onClick={clock.reset}>
              Reset
            </button>
            <button type="button" className="icon-btn primary" onClick={clock.toggle}>
              {clock.playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="icon-btn speed-cycle"
              onClick={() => clock.setSpeed(nextSpeed(clock.speed))}
              aria-label={`Speed ${clock.speed} times, tap to change`}
            >
              {clock.speed}×
            </button>
          </div>
          <a className="text-link" href="/">
            He Lives
          </a>
        </div>
        <Timeline progress={clock.progress} sceneId={scene.id} onScrub={clock.setProgress} />
        <p className="disclaimer">
          A visual meditation on Genesis 1–3. Scripture is the King James Version, public domain. Spoken
          narration covers the days of creation, Eden, the Fall, and the invitation. This is not a
          documentary.
        </p>
      </footer>
    </div>
  )
}
