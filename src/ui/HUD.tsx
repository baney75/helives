import { cueAt } from '../genesis/choreography.ts'
import type { ChangeEvent } from 'react'
import { SCENES } from '../genesis/scenes.ts'
import { hasVoice } from '../genesis/voiced.ts'
import type { GenesisClock } from '../hooks/useGenesisClock.ts'
import { Timeline } from './Timeline.tsx'

type HUDProps = {
  clock: GenesisClock
  muted: boolean
  onMute: () => void
}

export function HUD({ clock, muted, onMute }: HUDProps) {
  const scene = clock.scene
  const cue = cueAt(scene.id, clock.progress)
  const science = scene.kind === 'science'
  const voiced = hasVoice(scene.id)

  return (
    <div className="hud">
      <header className="topbar">
        <div className="brand">
          <a className="wordmark" href="/">He Lives</a>
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

      <section className="narration" aria-live="off">
        <p className="epoch-kicker">{scene.kicker}</p>
        <h1>{scene.name}</h1>
        <p className="headline">{cue?.text ?? scene.headline}</p>
        {!cue && <p className="body">{scene.body}</p>}
        {science ? (
          <p className="afterword-link">
            <a href="/genesis/afterword">Read the sources</a>
          </p>
        ) : null}
      </section>

      <footer className="dock">
        <label className="scene-picker">
          <span>Scene</span>
          <select value={scene.id} onChange={(event) => {
            const selected = SCENES.find((item) => item.id === event.target.value)
            if (selected) clock.setProgress(selected.start)
          }}>
            {SCENES.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, '0')} · {item.name}</option>)}
          </select>
          <span className="scene-count">{SCENES.findIndex((item) => item.id === scene.id) + 1} / {SCENES.length}</span>
        </label>
        <div className="transport">
          <button type="button" className="icon-btn" onClick={clock.reset}>
            Reset
          </button>
          <button type="button" className="icon-btn primary" onClick={clock.toggle}>
            {clock.playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="icon-btn" aria-pressed={muted} onClick={onMute}>
            {muted ? 'Sound off' : 'Sound on'}
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
          <a className="text-link" href="/scriptures">
            Scriptures
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
