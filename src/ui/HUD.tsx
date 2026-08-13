import type { ChangeEvent } from 'react'
import type { GenesisClock } from '../hooks/useGenesisClock.ts'
import { Timeline } from './Timeline.tsx'

type HUDProps = {
  clock: GenesisClock
}

export function HUD({ clock }: HUDProps) {
  const scene = clock.scene
  const science = scene.kind === 'science'

  return (
    <div className="hud">
      <header className="topbar">
        <div className="brand">
          <p className="wordmark">Genesis</p>
          <p className="tag">He Lives</p>
        </div>
        <dl className="readouts">
          <div>
            <dt>Place</dt>
            <dd>{scene.kicker}</dd>
          </div>
          <div>
            <dt>{scene.kind === 'scripture' ? 'Text' : 'Voice'}</dt>
            <dd>{scene.kind === 'scripture' ? 'KJV' : 'Original'}</dd>
          </div>
          <div>
            <dt>Cite</dt>
            <dd>{scene.citation}</dd>
          </div>
        </dl>
      </header>

      <footer className="dock">
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
        <div className="transport">
          <button type="button" className="icon-btn" onClick={clock.reset}>
            Reset
          </button>
          <button type="button" className="icon-btn primary" onClick={clock.toggle}>
            {clock.playing ? 'Pause' : 'Play'}
          </button>
          <label className="speed">
            Speed
            <select
              value={String(clock.speed)}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                clock.setSpeed(Number(event.target.value))
              }}
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>
          <a className="text-link" href="/">
            He Lives
          </a>
        </div>
        <Timeline progress={clock.progress} sceneId={scene.id} onScrub={clock.setProgress} />
        <p className="disclaimer">
          A visual meditation on Genesis 1–3. Scripture is the King James Version, public domain. This is not a
          documentary and not a science disproof.
        </p>
      </footer>
    </div>
  )
}
