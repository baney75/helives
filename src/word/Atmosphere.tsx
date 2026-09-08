import { ArtBackdrop } from '../art/ArtBackdrop.tsx'
import type { Artwork } from '../art/catalog.ts'
import type { Motif } from './types.ts'

/** CSS/SVG scene grammar: no GPU framework or network assets on the reading page. */
export function Atmosphere({ artwork, motif, still }: { artwork: Artwork; motif: Motif; still: boolean }) {
  return <div className="reading-atmosphere" data-scene={motif} data-still={still} aria-hidden="true">
    <ArtBackdrop artwork={artwork} still={still} />
    <div className="atmosphere-light" />
    <svg className="atmosphere-lines" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none">
      <g className="atmosphere-orbits">
        <ellipse cx="1300" cy="490" rx="310" ry="310" /><ellipse cx="1300" cy="490" rx="340" ry="340" />
        <ellipse cx="1300" cy="490" rx="390" ry="390" />
      </g>
      <g className="atmosphere-water">
        {[0,1,2,3,4,5,6,7].map(i=><path key={i} d={`M-200 ${630+i*37} Q200 ${480+i*30} 650 ${650+i*26} T1800 ${590+i*28}`} />)}
      </g>
      <g className="atmosphere-vine">
        <path d="M1540 1100C1050 800 1520 600 1150-100M1470 1100C960 780 1420 530 1080-100" />
        {[0,1,2,3,4].map(i=><path key={i} d={`M${1260+i*20} ${180+i*145}q-160 -40 -180 -155q150 5 180 155q160 -15 200 -115q-150 -20 -200 115`} />)}
      </g>
    </svg>
    <div className="atmosphere-dust">{Array.from({length:16},(_,i)=><i key={i} style={{left:`${(i*47+13)%100}%`,top:`${(i*29+7)%100}%`,animationDelay:`-${i*3.7}s`,animationDuration:`${24+(i%5)*7}s`}} />)}</div>
    <div className="atmosphere-shade" />
  </div>
}
