import type { ChangeEvent } from 'react'
import type { SceneId } from '../genesis/scenes.ts'
import { SCENES } from '../genesis/scenes.ts'

type TimelineProps = {
  progress: number
  sceneId: SceneId
  onScrub: (progress: number) => void
}

const LABELED = new Set<SceneId>(['beginning', 'day1', 'day4', 'garden', 'fall', 'closing', 'doubt'])

export function Timeline({ progress, sceneId, onScrub }: TimelineProps) {
  return (
    <div className="timeline">
      <label className="sr-only" htmlFor="genesis-time">
        Genesis time
      </label>
      <input
        id="genesis-time"
        type="range"
        min={0}
        max={1}
        step={0.0005}
        value={progress}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onScrub(Number(event.target.value))
        }}
      />
      <ol className="ticks">
        {(() => {
          let labeledSeen = 0
          return SCENES.map((scene) => {
            const left = ((scene.start + scene.end) / 2) * 100
            const labeled = LABELED.has(scene.id) || scene.id === sceneId
            const row = labeled ? labeledSeen++ % 2 : 0
            return (
              <li key={scene.id} style={{ left: `${left}%` }}>
                <button
                  type="button"
                  className={scene.id === sceneId ? 'tick is-current' : 'tick'}
                  aria-label={scene.name}
                  aria-current={scene.id === sceneId ? 'true' : undefined}
                  onClick={() => onScrub(scene.start)}
                >
                  <span className="tick-dot" />
                  {labeled ? (
                    <span className="tick-label" data-row={row}>
                      {scene.tick}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })
        })()}
      </ol>
    </div>
  )
}
