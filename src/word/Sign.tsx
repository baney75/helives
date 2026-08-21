import { BrandMark } from '../site/BrandMark.tsx'
import type { Motif } from './types.ts'

type SignProps = {
  motif: Motif
  reducedMotion: boolean
}

/** Lucide static 0.544.0 (ISC). Life stays the brand mark. */
export function Sign({ motif, reducedMotion }: SignProps) {
  const motion = reducedMotion ? undefined : 'in'
  return (
    <div className="word-sign" data-motif={motif} aria-hidden="true">
      {motif === 'life' ? (
        <BrandMark size={96} />
      ) : (
        <svg
          className={motion ? 'word-sign-icon' : undefined}
          viewBox="0 0 24 24"
          width="112"
          height="112"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {motif === 'light' ? <LucideSun /> : null}
          {motif === 'water' ? <LucideWaves /> : null}
          {motif === 'lamp' ? <LucideLamp /> : null}
          {motif === 'vine' ? <LucideSprout /> : null}
        </svg>
      )}
    </div>
  )
}

function LucideSun() {
  return (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>
  )
}

function LucideWaves() {
  return (
    <>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </>
  )
}

function LucideLamp() {
  return (
    <>
      <path d="M12 12v6" />
      <path d="M4.077 10.615A1 1 0 0 0 5 12h14a1 1 0 0 0 .923-1.385l-3.077-7.384A2 2 0 0 0 15 2H9a2 2 0 0 0-1.846 1.23Z" />
      <path d="M8 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
    </>
  )
}

function LucideSprout() {
  return (
    <>
      <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
      <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
      <path d="M5 21h14" />
    </>
  )
}
