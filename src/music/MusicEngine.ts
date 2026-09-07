import { MUSIC_TRACKS } from './catalog.ts'
export type MusicStatus = 'off' | 'loading' | 'playing' | 'error'
type Clip = { audio: HTMLAudioElement; gain: number; id: string }
type Snapshot = { status: MusicStatus; trackId: string }

/** Two-deck playback with a six-second handoff. All work starts after consent. */
export class MusicEngine {
  private current: Clip | null = null
  private outgoing: Clip | null = null
  private prepared: Clip | null = null
  private enabled = false
  private revision = 0
  private frame = 0
  private volume = .35
  private selected = MUSIC_TRACKS[0]!.id
  private changing = false
  private loading: Clip | null = null
  private failedNext: string | null = null
  private publish: (state: Snapshot) => void
  constructor(publish: (state: Snapshot) => void) { this.publish = publish }
  private emit(status: MusicStatus) { this.publish({ status, trackId: this.selected }) }
  private apply() {
    for (const clip of [this.current, this.outgoing]) if (clip) clip.audio.volume = Math.min(1, Math.max(0, clip.gain*this.volume))
  }
  setVolume(volume: number) { this.volume = Math.min(1,Math.max(0,volume)); this.apply() }
  private next(id: string) { return MUSIC_TRACKS[(MUSIC_TRACKS.findIndex(t=>t.id===id)+1)%MUSIC_TRACKS.length]!.id }
  private make(id: string): Clip {
    const track = MUSIC_TRACKS.find(t=>t.id===id)!
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/music/${track.file}`)
    audio.preload = 'none'
    audio.dataset.track = id
    audio.setAttribute('playsinline', '')
    const clip = { audio, id, gain: 0 }
    audio.addEventListener('timeupdate', () => {
      if (!this.enabled || this.current !== clip || this.changing || !Number.isFinite(audio.duration)) return
      const remaining = audio.duration-audio.currentTime
      if (remaining <= 30 && !this.prepared) {
        this.prepared = this.make(this.next(id))
        this.prepared.audio.preload = 'auto'
        this.prepared.audio.load()
      }
      if (remaining <= 6 && MUSIC_TRACKS.length>1 && this.failedNext !== this.next(id)) void this.play(this.next(id), 6000)
    })
    audio.addEventListener('ended', () => {
      if (this.enabled && this.current === clip && !this.changing) void this.play(this.next(id), 1200)
    })
    audio.addEventListener('error', () => {
      if (this.current !== clip || !this.enabled || this.loading === clip) return
      this.stop()
      this.emit('error')
    })
    return clip
  }
  async play(id=this.selected, fadeMs=1200) {
    if (!MUSIC_TRACKS.some(t=>t.id===id) || document.hidden) return
    this.enabled = true
    const revision = ++this.revision
    this.changing = true
    cancelAnimationFrame(this.frame)
    this.outgoing?.audio.pause()
    this.outgoing = null
    const previous = this.current
    const clip = previous?.id===id && !previous.audio.error ? previous
      : this.prepared?.id===id && !this.prepared.audio.error ? this.prepared : this.make(id)
    if (this.prepared !== clip) this.prepared?.audio.pause()
    this.prepared = null
    this.current = clip
    this.outgoing = previous !== clip ? previous : null
    this.selected = id
    if (previous !== clip) clip.gain = 0
    this.apply()
    this.loading=clip
    this.emit('loading')
    try {
      await clip.audio.play()
      if (revision !== this.revision || !this.enabled) { if (!this.enabled || this.current!==clip) clip.audio.pause(); return }
      this.loading=null
      this.failedNext=null
      this.emit('playing')
      const began = performance.now()
      const initial = clip.gain
      const oldGain = this.outgoing?.gain ?? 0
      const fade = () => {
        if (revision!==this.revision || !this.enabled) return
        const progress = Math.min(1,(performance.now()-began)/fadeMs)
        // Constant-sum fade avoids a loud midpoint when similar recordings overlap.
        clip.gain = initial+(1-initial)*progress
        if (this.outgoing) this.outgoing.gain = oldGain*(1-progress)
        this.apply()
        if (progress<1) this.frame=requestAnimationFrame(fade)
        else { this.outgoing?.audio.pause(); this.outgoing=null; this.changing=false }
      }
      this.frame=requestAnimationFrame(fade)
    } catch {
      if (revision!==this.revision) return
      this.loading=null
      this.failedNext=id
      clip.audio.pause()
      this.current = this.outgoing
      this.outgoing = null
      this.changing = false
      if (this.current && !this.current.audio.paused) {
        this.current.gain=1
        this.selected=this.current.id
        this.apply()
        this.emit('playing')
      } else { this.stop(); this.emit('error') }
    }
  }
  stop() {
    this.enabled=false
    this.revision++
    this.changing=false
    this.loading=null
    cancelAnimationFrame(this.frame)
    for (const clip of [this.current,this.outgoing,this.prepared]) clip?.audio.pause()
    if (this.current) this.current.gain=0
    this.outgoing=null
    this.prepared=null
    this.emit('off')
  }
  toggle() { if(this.enabled) this.stop(); else void this.play() }
  select(id: string) {
    if(!MUSIC_TRACKS.some(t=>t.id===id)) return
    this.selected=id
    if(this.enabled) void this.play(id)
    else this.emit('off')
  }
}
