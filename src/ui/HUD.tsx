import { cueAt } from '../genesis/choreography.ts'
import { useRef, type ChangeEvent } from 'react'
import { NARRATION } from '../genesis/script.ts'
import { SCENES, type Scene } from '../genesis/scenes.ts'
import { INTERACTIVE_SECONDS } from '../genesis/sceneTiming.ts'
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
  const transcript = useRef<HTMLDialogElement>(null)
  const sceneIndex = SCENES.findIndex((item) => item.id === scene.id)
  const selectScene = (selected: Scene) => {
    window.history.replaceState(null, '', sceneUrl(window.location.search, selected.id, !clock.playing))
    clock.setProgress(selected.start)
  }
  const cue = cueAt(scene.id, clock.progress)
  const science = scene.kind === 'science'
  const fullContext = fullContextHref(scene)
  const sourceLabel = scene.kind === 'scripture' ? 'KJV' : scene.kind === 'science' ? 'Afterword' : 'Invitation'

  return (
    <div className="hud">
      <header className="topbar">
        <div className="brand">
          <a className="wordmark" href="/"><BrandMark size={26} />He Lives</a>
          <p className="tag">The book of beginnings</p>
        </div>
        <nav className="journey-nav" aria-label="Journey navigation">
          <a href="/scriptures">Scriptures</a>
          <a href="/faith">Faith in Christ</a>
        </nav>
      </header>

      <section className="narration" aria-live="off">
        <p className="epoch-kicker"><span className="chapter-number">{String(sceneIndex + 1).padStart(2, '0')}</span>{scene.kicker}</p>
        <h1>{scene.name}</h1>
        <p className="headline">{cue?.text ?? scene.headline}</p>
        <p className="passage-citation">{scene.citation}{scene.kind === 'scripture' ? ' · KJV' : ` · ${sourceLabel}`}</p>
        <button type="button" className="read-scene" onClick={() => { clock.pause(); transcript.current?.showModal() }}>Read this scene <span aria-hidden="true">↗</span></button>
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
        <div className="journey-meta"><span>Genesis 1–3</span><span>{formatTime(clock.progress * INTERACTIVE_SECONDS)} <span aria-hidden="true">/</span> {formatTime(INTERACTIVE_SECONDS)}</span></div>
        {audioBlocked ? (
          <button type="button" className="sound-gate" onClick={onRetrySound}>
            Begin with sound
          </button>
        ) : audioWaiting ? (
          <button type="button" className="audio-waiting" onClick={onContinueWithoutSound}>
            Waiting for audio — continue without sound
          </button>
        ) : null}
        <div className="chapter-controls">
          <button className="chapter-step" type="button" aria-label="Previous scene" disabled={sceneIndex === 0} onClick={() => { const previous = SCENES[sceneIndex - 1]; if (previous) selectScene(previous) }}><span aria-hidden="true">←</span></button>
          <label className="scene-picker">
            <span className="sr-only">Scene</span>
            <select value={scene.id} onChange={(event) => { const selected = SCENES.find((item) => item.id === event.target.value); if (selected) selectScene(selected) }}>
              {SCENES.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, '0')} · {item.name}</option>)}
            </select>
          </label>
          <span className="scene-count">{sceneIndex + 1} / {SCENES.length}</span>
          <button className="chapter-step" type="button" aria-label="Next scene" disabled={sceneIndex === SCENES.length - 1} onClick={() => { const next = SCENES[sceneIndex + 1]; if (next) selectScene(next) }}><span aria-hidden="true">→</span></button>
        </div>
        <div className="transport">
          <button type="button" className="icon-btn reset-button" aria-label="Reset" onClick={clock.reset}>
            <span className="reset-icon" aria-hidden="true">↺</span><span className="reset-text">Reset</span>
          </button>
          <button type="button" className="icon-btn primary" onClick={() => { if (clock.progress >= 1) { clock.reset(); clock.play() } else clock.toggle() }}>
            <span aria-hidden="true">{clock.playing ? 'Ⅱ' : '▷'}</span> {clock.playing ? 'Pause' : clock.progress >= 1 ? 'Replay' : 'Play'}
          </button>
          <button type="button" className="icon-btn" aria-pressed={muted} onClick={onMute}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <label className="speed">
            <span className="speed-label">Speed</span>
            <select
              aria-label="Playback speed"
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
          <MusicControls />
        </div>
        <Timeline progress={clock.progress} sceneId={scene.id} onScrub={clock.setProgress} />
        <p className="disclaimer">An illustrated meditation on Scripture. <span>Space to pause · Arrow keys to seek</span></p>
      </footer>
      <dialog ref={transcript} className="scene-transcript" aria-labelledby="transcript-title">
        <form method="dialog"><button className="icon-btn" aria-label="Close scene text">Close <span aria-hidden="true">×</span></button></form>
        <p className="epoch-kicker">{sourceLabel}</p>
        <h2 id="transcript-title">{scene.name}</h2>
        <p className="passage-citation">{scene.citation}{scene.kind === 'scripture' ? ' · Selected KJV verses' : ' · Original commentary'}</p>
        <div className="transcript-copy">{NARRATION[scene.id].split(/(?<=\.)\s+(?=And |But |Therefore |So |The )/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        {fullContext && <a href={fullContext} target="_blank" rel="noopener noreferrer">Read the passage in full on Bible Gateway ↗</a>}
      </dialog>
    </div>
  )
}

function formatTime(seconds: number): string {
  const rounded = Math.floor(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}
