import { cueAt } from '../genesis/choreography.ts'
import type { ChangeEvent } from 'react'
import { SCENES } from '../genesis/scenes.ts'
import { fullContextHref } from '../genesis/fullContext.ts'
import type { GenesisClock } from '../hooks/useGenesisClock.ts'
import { Timeline } from './Timeline.tsx'
import { sceneUrl } from '../lib/mode.ts'
import { BrandMark } from '../site/BrandMark.tsx'
import { MusicControls } from '../music/MusicControls.tsx'

type HUDProps = {
  clock: GenesisClock
  muted: boolean
  onMute: () => void
  audioBlocked?: boolean
  onRetrySound?: () => void
  audioWaiting?: boolean
  onContinueWithoutSound?: () => void
}

export function HUD({
  clock,
  muted,
  onMute,
  audioBlocked = false,
  onRetrySound,
  audioWaiting = false,
  onContinueWithoutSound,
}: HUDProps) {
  const scene = clock.scene
  const cue = cueAt(scene.id, clock.progress)
  const science = scene.kind === 'science'
  const fullContext = fullContextHref(scene)
  const sourceLabel = scene.kind === 'scripture' ? 'KJV' : scene.kind === 'science' ? 'Afterword' : 'Invitation'

  return (
    <div className="hud">
      <header className="topbar">
        <div className="brand">
          <a className="wordmark" href="/"><BrandMark size={26} />He Lives</a>
          <p className="tag">Genesis</p>
        </div>
        <p className="readouts">
          <span>{sourceLabel}</span>
          <span>{scene.citation}</span>
        </p>
      </header>

      <section className="narration" aria-live="off">
        <p className="epoch-kicker">{scene.kicker}</p>
        <h1>{scene.name}</h1>
        <p className="headline">{cue?.text ?? scene.headline}</p>
        {!cue && <p className="body">{scene.body}</p>}
        {fullContext ? (
          <p className="full-context-link">
            <a href={fullContext} target="_blank" rel="noopener noreferrer" aria-label="Read the KJV passage in full on Bible Gateway">Read the full KJV passage</a>
          </p>
        ) : null}
        {science ? (
          <p className="afterword-link">
            <a href="/genesis/afterword">Read the sources</a>
          </p>
        ) : null}
      </section>

      <footer className="dock">
        {audioBlocked ? (
          <button type="button" className="sound-gate" onClick={onRetrySound}>
            Begin with sound
          </button>
        ) : audioWaiting ? (
          <button type="button" className="audio-waiting" onClick={onContinueWithoutSound}>
            Waiting for audio — continue without sound
          </button>
        ) : null}
        <label className="scene-picker">
          <span>Scene</span>
          <select value={scene.id} onChange={(event) => {
            const selected = SCENES.find((item) => item.id === event.target.value)
            if (!selected) return
            window.history.replaceState(null, '', sceneUrl(window.location.search, selected.id, !clock.playing))
            clock.setProgress(selected.start)
          }}>
            {SCENES.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, '0')} · {item.name}</option>)}
          </select>
          <span className="scene-count">{SCENES.findIndex((item) => item.id === scene.id) + 1} / {SCENES.length}</span>
        </label>
        <div className="transport">
          <MusicControls />
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
        <p className="disclaimer">Genesis 1–3 · King James Version · A visual meditation, not a documentary.</p>
      </footer>
    </div>
  )
}
