import { BrandMark } from '../site/BrandMark.tsx'
import type { Motif } from './types.ts'

type SignProps = {
  motif: Motif
  reducedMotion: boolean
}

/** Small engraved illustrations accompany the verse without competing with it. */
export function Sign({ motif }: SignProps) {
  return (
    <div className="word-sign" data-motif={motif} aria-hidden="true">
      {motif === 'life' ? <BrandMark size={96} /> : (
        <svg className="word-sign-icon" viewBox="0 0 144 144" width="112" height="112" fill="none">
          <title>{SIGN_TITLE[motif]}</title>
          {motif === 'light' && <LightSign />}
          {motif === 'water' && <WaterSign />}
          {motif === 'lamp' && <LampSign />}
          {motif === 'vine' && <VineSign />}
        </svg>
      )}
    </div>
  )
}

const SIGN_TITLE = {
  light: 'Dawn above the hills',
  water: 'Ripples across still water',
  lamp: 'An earthen oil lamp',
  vine: 'A vine with leaves and fruit',
}

function LightSign() {
  return <>
    <path d="M49 77a23 23 0 0 1 46 0" />
    <path className="sign-fine" d="M72 43v-9m-24 16-6-7m-7 26-9-2m70-17 6-7m7 26 9-2" />
    <path d="M17 89c19-17 33-9 51-3s35-13 59-7M25 98c24-8 42 5 62 0s27-8 33-7" />
    <path className="sign-fine" d="M40 107c16-2 26 4 40 2m-19-32h22" />
  </>
}
function WaterSign() {
  return <>
    <path d="M72 30c-5 9-11 15-11 22a11 11 0 0 0 22 0c0-7-6-13-11-22Z" />
    <path className="sign-fine" d="M67 52c0 4 2 6 5 6M56 75c-20 2-25 7-16 11 13 7 51 7 64 0 9-4 4-9-16-11M53 81c8 4 30 4 38 0" />
    <path d="M30 85c-17 6-18 13 1 18 23 7 59 7 82 0 19-5 18-12 1-18" />
    <path className="sign-fine" d="M23 112c23 10 75 12 98 0" />
  </>
}
function LampSign() {
  return <>
    <path className="sign-body" d="M27 81c15 0 24-9 38-9 12 0 21 7 32 7l22-7-13 22c-8 14-20 20-40 20-23 0-36-13-39-33Z" />
    <path d="M34 82c14 6 44 9 65 0M36 78c-12-20-28-8-21 5 3 6 9 8 15 8M103 80l8-10" />
    <path className="sign-flame" d="M112 63c-12-8-9-18 0-30-1 13 13 21 0 30Z" />
    <path className="sign-fine" d="M43 94c10 9 28 12 43 6M47 101l-3 4m11-1-2 5m11-4v6m9-6 1 5m9-7 3 4M52 117h30" />
  </>
}
function VineSign() {
  return <>
    <path d="M40 122c30-21 24-56 62-98" />
    <path className="sign-body" d="M67 88C40 88 34 73 33 61c19 2 33 9 34 27ZM76 70c-2-24-15-33-27-35 0 19 9 31 27 35ZM83 56c23 3 32-9 36-23-18-1-31 6-36 23Z" />
    <path className="sign-fine" d="m43 73 24 15m-7-42 16 24m7-14 25-15M78 88c13-13 24-5 17 4" />
    <path d="M84 96a5 5 0 1 0 10 0 5 5 0 0 0-10 0Zm10 1a5 5 0 1 0 10 0 5 5 0 0 0-10 0Zm-6 9a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z" />
  </>
}
