import { useId } from 'react'
import { MUSIC_TRACKS } from './catalog.ts'
import { useMusic } from './MusicProvider.tsx'

export function MusicControls() {
  const music = useMusic()
  const id = useId()
  if (!music) return null
  const active = music.status === 'playing' || music.status === 'loading'
  const track = MUSIC_TRACKS.find((item) => item.id === music.trackId)!
  return (
    <div className="music-controls" aria-label="Background music">
      <button type="button" className="music-toggle" onClick={music.toggle} aria-pressed={active}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M9 18V5l10-2v13M9 9l10-2" /><ellipse cx="6" cy="18" rx="3" ry="2.5" /><ellipse cx="16" cy="16" rx="3" ry="2.5" />
          {!active && <path d="m3 3 18 18" />}
        </svg>
        {music.status === 'loading' ? 'Music loading · cancel' : active ? 'Music on' : music.status === 'error' ? 'Retry music' : 'Music off'}
      </button>
      <button type="button" className="music-settings" popoverTarget={`${id}-panel`} aria-label="Music settings">Settings</button>
        <div className="music-panel" id={`${id}-panel`} popover="auto">
          <p className="music-heading">Music for reading</p>
          <p>{track.title}<small>{track.credit}</small></p>
          {MUSIC_TRACKS.length > 1 && <label>Instrumental<select aria-label="Instrumental" value={music.trackId} onChange={(e) => music.selectTrack(e.target.value)}>
            {MUSIC_TRACKS.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select></label>}
          <label htmlFor={id}>Volume <span>{music.volume}%</span></label>
          <input id={id} aria-label="Music volume" type="range" min="1" max="100" value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} />
          <small>Starts off each visit. Quieter during Genesis. Pauses when you leave this tab.</small>
        </div>

      {music.status === 'error' && <span className="music-error" role="status">Music couldn’t load. Press Retry music to try again.</span>}
    </div>
  )
}
