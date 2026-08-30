import { BrandMark } from '../site/BrandMark.tsx'
import type { Motif } from './types.ts'

type SignProps = {
  motif: Motif
  reducedMotion: boolean
}

/**
 * The lamp of the hour. One authored, luminous line per motif. Never Lucide,
 * never furniture clipart. Life stays the brand mark.
 */
export function Sign({ motif, reducedMotion }: SignProps) {
  const live = reducedMotion ? undefined : 'is-live'
  return (
    <div className="word-sign" data-motif={motif} aria-hidden="true">
      {motif === 'life' ? (
        <BrandMark size={132} />
      ) : (
        <svg
          className={live ? 'word-sign-icon is-live' : 'word-sign-icon'}
          viewBox="0 0 144 144"
          width="112"
          height="112"
          fill="none"
        >
          <title>{SIGN_TITLE[motif]}</title>
          <circle className="sign-halo" cx="72" cy="70" r="52" />
          {motif === 'light' ? <LightSign /> : null}
          {motif === 'water' ? <WaterSign /> : null}
          {motif === 'lamp' ? <LampSign /> : null}
          {motif === 'vine' ? <VineSign /> : null}
        </svg>
      )}
    </div>
  )
}

const SIGN_TITLE: Record<Exclude<Motif, 'life'>, string> = {
  light: 'A single dawn line opening across the void',
  water: 'Still water — one slow horizon',
  lamp: 'A wick and a small flame',
  vine: 'One vine line with two branches',
}

function LightSign() {
  return (
    <>
      <path className="sign-sun" d="M40 80 A 32 32 0 0 1 104 80" />
      <line className="sign-dawn" x1="16" y1="80" x2="128" y2="80" />
      <rect className="sign-spark" x="68.5" y="44.5" width="7" height="7" />
    </>
  )
}

function WaterSign() {
  return (
    <>
      <path className="sign-water" d="M8 72 Q 40 68 72 72 T 136 72" />
      <path className="sign-water sign-water-echo" d="M22 90 Q 48 87 72 90 T 122 90" />
    </>
  )
}

function LampSign() {
  return (
    <>
      <path className="sign-flame" d="M72 30 C 81 45, 83 56, 72 66 C 61 56, 63 45, 72 30 Z" />
      <path className="sign-flame-core" d="M72 41 C 77 49, 78 57, 72 63 C 66 57, 67 49, 72 41 Z" />
      <line className="sign-wick" x1="72" y1="66" x2="72" y2="88" />
      <path className="sign-bowl" d="M50 88 Q 72 104 94 88" />
      <line className="sign-bowl-rim" x1="58" y1="95" x2="86" y2="95" />
      <rect className="sign-spark" x="69" y="46" width="6" height="6" />
    </>
  )
}

function VineSign() {
  return (
    <>
      <path
        className="sign-vine"
        d="M28 120 C 40 80, 48 70, 72 52 C 88 40, 96 36, 116 28 M72 52 C 80 70, 92 78, 110 86 M72 52 C 60 64, 52 86, 44 104"
      />
      <ellipse className="sign-leaf" cx="116" cy="28" rx="7" ry="4" transform="rotate(-32 116 28)" />
      <ellipse className="sign-leaf" cx="110" cy="86" rx="7" ry="4" transform="rotate(28 110 86)" />
      <ellipse className="sign-leaf" cx="44" cy="104" rx="7" ry="4" transform="rotate(-14 44 104)" />
    </>
  )
}
