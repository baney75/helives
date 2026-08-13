import type { GenesisClock } from '../hooks/useGenesisClock.ts'

type CinematicOverlayProps = {
  clock: GenesisClock
}

export function CinematicOverlay({ clock }: CinematicOverlayProps) {
  const opening = clock.progress < 0.03
  const ending = clock.progress >= 0.97
  const doubt = clock.scene.id === 'doubt'
  const dim = opening || ending || doubt

  return (
    <div className="cine" aria-hidden="true">
      <p className="cine-brand">He Lives</p>
      <p className="cine-host">Genesis</p>
      <div className={opening ? 'cine-title is-on' : 'cine-title'}>
        <p className="cine-kicker">He Lives</p>
        <h1>Genesis</h1>
        <p>In the beginning God created the heaven and the earth.</p>
      </div>
      <div className={doubt ? 'cine-doubt is-on' : 'cine-doubt'}>
        <p className="cine-kicker">After the Word</p>
        <h2>Got doubt?</h2>
      </div>
      <div className={ending ? 'cine-end is-on' : 'cine-end'}>
        <p className="cine-kicker">Then go</p>
        <h2>Live for Jesus Christ</h2>
        <p>helives.dev</p>
      </div>
      <section className={dim ? 'cine-epoch is-dim' : 'cine-epoch'}>
        <p className="cine-kicker">{clock.scene.kicker}</p>
        <h2>{clock.scene.name}</h2>
        <p>{clock.scene.headline}</p>
      </section>
    </div>
  )
}
