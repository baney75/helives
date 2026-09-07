import type { Artwork } from './catalog.ts'

/** A few composited light marks add atmosphere without filters or another rendering loop. */
export function SceneAir({ artwork }: { artwork: Artwork }) {
  const water = artwork.id !== 'exodus' && ['sea', 'river', 'boat', 'bridge'].includes(artwork.family)
  return <div className={`scene-air air-${artwork.palette}${water ? ' has-water' : ''}${artwork.weather === 'stars' ? ' has-stars' : ''}`} aria-hidden="true">
    <div className="scene-air-glow" />
    <div className="scene-air-haze" />
    {water && <svg className="scene-air-water" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g>{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${760 + (i % 3) * 51} ${artwork.horizon + 64 + i * 19}q${36 + i * 7} -3 ${86 + i * 13} 0`} />)}</g></svg>}
    {artwork.weather === 'stars' && <div className="scene-air-stars">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${18 + (i * 29) % 76}%`, top: `${9 + (i * 11) % 29}%`, animationDelay: `${-i * 1.7}s` }} />)}</div>}
  </div>
}
