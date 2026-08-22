import { BrandMark } from '../site/BrandMark.tsx'
import type { Motif } from './types.ts'

type SignProps = {
  motif: Motif
  reducedMotion: boolean
}

/**
 * One-line motif for this hour’s verse. Authored marks, not Lucide clipart.
 * Life stays the brand mark. No furniture lamp, sunburst, or sprout.
 */
export function Sign({ motif, reducedMotion }: SignProps) {
  const live = reducedMotion ? undefined : 'is-live'
  return (
    <div className="word-sign" data-motif={motif} aria-hidden="true">
      {motif === 'life' ? (
        <BrandMark size={96} />
      ) : (
        <svg
          className={live ? 'word-sign-icon is-live' : 'word-sign-icon'}
          viewBox="0 0 144 144"
          width="112"
          height="112"
          fill="none"
        >
          <title>{SIGN_TITLE[motif]}</title>
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
      <line className="sign-dawn" x1="12" y1="72" x2="132" y2="72" />
      <rect className="sign-spark" x="69" y="69" width="6" height="6" />
    </>
  )
}

function WaterSign() {
  return <path className="sign-water" d="M8 72 Q 40 68 72 72 T 136 72" />
}

function LampSign() {
  return (
    <>
      <line className="sign-wick" x1="72" y1="118" x2="72" y2="62" />
      <ellipse className="sign-flame" cx="72" cy="48" rx="5" ry="11" />
      <rect className="sign-spark" x="69" y="45" width="6" height="6" />
    </>
  )
}

function VineSign() {
  return (
    <path
      className="sign-vine"
      d="M28 120 C 40 80, 48 70, 72 52 C 88 40, 96 36, 116 28 M72 52 C 80 70, 92 78, 110 86 M72 52 C 60 64, 52 86, 44 104"
    />
  )
}
