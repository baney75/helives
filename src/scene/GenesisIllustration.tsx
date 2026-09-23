import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fallStoryBeat } from '../genesis/choreography.ts'
import { AUDIO_CUES } from '../genesis/audioCues.ts'
import { sceneSeconds } from '../genesis/sceneTiming.ts'
import type { SceneId } from '../genesis/scenes.ts'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { CANOPY_MARKS, DEEP_STARS, hillContours, localSceneProgress, MEADOW_MARKS, SKY_STARS, wavePaths } from './illustration.ts'
import './illustration.css'

export type GenesisIllustrationProps = {
  sceneId: SceneId
  progress: number
  playing: boolean
  reducedMotion: boolean
  onReady?: (ready: boolean) => void
}

const LABELS: Record<SceneId, string> = {
  beginning: 'Dark waters before creation',
  day1: 'Light breaking through the darkness',
  day2: 'The firmament dividing the waters',
  day3: 'Dry land rising beside the sea with plants growing',
  day4: 'Sun, moon, and stars in the sky',
  day5: 'Birds flying above fish in the sea',
  day6: 'A man and woman beside living creatures',
  day7: 'Creation at rest in a still landscape',
  garden: 'A garden with trees, a river, and two figures',
  fall: 'Two figures beside the forbidden tree, fruit, and serpent',
  closing: 'An empty tomb and a distant cross in morning light',
  doubt: 'A solitary person beneath a vast night sky',
  measure: 'A telescope beneath a measured field of stars',
}

const NARROW_FOCUS: Record<SceneId, number> = {
  beginning: 35, day1: 0, day2: 55, day3: 70, day4: 80,
  day5: 85, day6: 120, day7: 80, garden: 70, fall: 40,
  closing: 55, doubt: 90, measure: 100,
}

function cueStart(sceneId: SceneId, index: number): number {
  const cue = AUDIO_CUES[sceneId][index]
  if (!cue) throw new Error(`Missing illustrated cue ${sceneId}:${index}`)
  return cue.start
}

const FALL_GIVE_END = (() => {
  const cue = AUDIO_CUES.fall.find((item) => 'action' in item && item.action === 'give')
  if (!cue) throw new Error('Missing Fall give cue')
  return cue.end
})()

function paint(svg: SVGSVGElement, sceneId: SceneId, progress: number, staged: boolean): void {
  const local = localSceneProgress(sceneId, progress)
  const seconds = local * sceneSeconds(sceneId)
  const phase = seconds * 0.78
  svg.style.setProperty('--gi-local', local.toFixed(4))
  const reveal = (start: number, duration: number) => staged ? Math.min(1, Math.max(0, (seconds - start) / duration)) : 1
  svg.style.setProperty('--gi-reveal', (sceneId === 'day1' ? Math.max(.08, reveal(cueStart('day1', 1), 2.5)) : 1).toFixed(4))
  svg.style.setProperty('--gi-land', (sceneId === 'day3' ? reveal(cueStart('day3', 1), 5.5) : 1).toFixed(4))
  const growth = sceneId === 'day3' ? reveal(cueStart('day3', 3), 7) : 1
  svg.style.setProperty('--gi-grow', growth.toFixed(4))
  svg.style.setProperty('--gi-grow-scale', (.72 + growth * .28).toFixed(4))
  svg.style.setProperty('--gi-life', (sceneId === 'day5' ? reveal(cueStart('day5', 1), 7) : sceneId === 'day6' ? reveal(cueStart('day6', 1), 9) : 1).toFixed(4))
  svg.style.setProperty('--gi-human', (sceneId === 'day6' ? reveal(cueStart('day6', 3), cueStart('day6', 4) - cueStart('day6', 3)) : sceneId === 'garden' ? reveal(cueStart('garden', 0) + 2, 4) : 1).toFixed(4))
  svg.style.setProperty('--gi-firmament', (sceneId === 'day2' ? reveal(cueStart('day2', 1), 5.6) : 1).toFixed(4))
  svg.style.setProperty('--gi-lights', (sceneId === 'day4' ? reveal(.3, 5.6) : 1).toFixed(4))
  svg.style.setProperty('--gi-tomb', (sceneId === 'closing' ? reveal(.5, 5) : 1).toFixed(4))
  svg.style.setProperty('--gi-measure', (sceneId === 'measure' ? reveal(1, 9) * .47 : .47).toFixed(4))
  svg.style.setProperty('--gi-drift', `${(Math.sin(phase) * 8).toFixed(2)}px`)
  svg.style.setProperty('--gi-swell', `${(Math.sin(phase * 1.25) * 5).toFixed(2)}px`)
  svg.style.setProperty('--gi-wing', `${(Math.sin(phase * 2.8) * 7).toFixed(2)}deg`)
  svg.style.setProperty('--gi-glow', (0.76 + Math.sin(phase * 1.45) * 0.16).toFixed(3))
  svg.style.setProperty('--gi-leaf', `${(Math.sin(phase * 1.6) * 2.4).toFixed(2)}deg`)
  svg.style.setProperty('--gi-travel', `${(local * 52).toFixed(2)}px`)
  const story = fallStoryBeat(sceneId === 'fall' ? seconds : 0)
  svg.style.setProperty('--gi-fruit-x', `${(-76 * story).toFixed(2)}px`)
  svg.style.setProperty('--gi-fruit-y', `${(130 * story).toFixed(2)}px`)
  const leafCover = sceneId === 'fall' ? Math.min(1, Math.max(0, (seconds - FALL_GIVE_END) / 1.5)) : 0
  svg.style.setProperty('--gi-cover', leafCover.toFixed(4))
}

function Stars({ deep = false }: { deep?: boolean }) {
  return <g className="gi-stars" fill="#fff4d6">
    {(deep ? DEEP_STARS : SKY_STARS).map((star, i) => <circle key={i} cx={star.x} cy={star.y} r={star.r} opacity={star.opacity} />)}
  </g>
}

function Water({ dark = false, high = false }: { dark?: boolean; high?: boolean }) {
  return <g className={`gi-water ${dark ? 'gi-water-dark' : ''}`} transform={high ? 'translate(0 -135)' : undefined}>
    <path d="M0 563 Q170 541 336 559 T696 559 T1200 545 V800 H0Z" fill={dark ? '#111c29' : 'url(#gi-sea)'} />
    <g className="gi-waves" fill="none" stroke={dark ? '#7e8890' : '#d9c69e'} strokeWidth="1.35" opacity={dark ? '.46' : '.7'}>
      {wavePaths.map((path, i) => <path key={i} d={path} opacity={i < 8 ? '.74' : '.38'} />)}
    </g>
    <path d="M0 655 Q300 626 566 658 T1200 653" stroke="#f4dba4" strokeWidth="2" opacity=".24" fill="none" />
  </g>
}

function Hills({ green = false, low = false }: { green?: boolean; low?: boolean }) {
  return <g transform={low ? 'translate(0 60)' : undefined}>
    <defs><clipPath id="gi-hill-clip"><path d="M0 566 Q127 480 286 513 Q444 449 590 517 Q788 434 982 516 Q1100 480 1200 501 V800 H0Z" /></clipPath></defs>
    <path d="M0 566 Q127 480 286 513 Q444 449 590 517 Q788 434 982 516 Q1100 480 1200 501 V800 H0Z" fill={green ? '#293c2c' : '#342b2a'} stroke="#ad9369" strokeWidth="2" />
    <g clipPath="url(#gi-hill-clip)" fill="none" stroke={green ? '#adc0a1' : '#b8a285'} opacity=".2" strokeWidth=".85">
      {Array.from({ length: 34 }, (_, i) => <path key={i} d={`M${i * 41 - 130} 510 l320 290`} />)}
      {Array.from({ length: 9 }, (_, i) => <path key={`ridge-${i}`} d={`M0 ${550 + i * 18} Q145 ${468 + i * 20} 295 ${518 + i * 19} Q446 ${449 + i * 19} 595 ${526 + i * 16} Q788 ${441 + i * 18} 980 ${522 + i * 17} Q1100 ${483 + i * 18} 1200 ${506 + i * 16}`} />)}
    </g>
    <path d="M0 625 Q171 558 356 615 Q528 553 724 598 Q982 535 1200 577 V800 H0Z" fill={green ? '#172b24' : '#1d1a20'} />
    <g fill="none" stroke={green ? '#8da583' : '#a18c77'} strokeWidth="1" opacity=".42">
      {hillContours.map((path, i) => <path key={i} d={path} />)}
    </g>
  </g>
}

function Tree({ x, y, scale = 1, lush = true, dark = false, fruit = false, trunkLength = 190 }: { x: number; y: number; scale?: number; lush?: boolean; dark?: boolean; fruit?: boolean; trunkLength?: number }) {
  const canopy = 'M-118 7 Q-144-16-124-47 Q-128-84-90-82 Q-76-117-36-105 Q-4-141 35-111 Q73-123 97-91 Q132-76 125-40 Q150-8 119 17 Q115 54 75 52 Q52 77 13 63 Q-29 75-52 52 Q-99 64-118 28Z'
  const clipId = `gi-canopy-${x}-${y}`
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className="gi-tree">
    <path d={`M-31 ${trunkLength} Q-10 ${trunkLength - 18}-6 ${trunkLength - 77} Q-10 75-9 47 Q-22 15-80 2 Q-55 8-23 23 Q-24-13-56-82 Q-19-39-4-14 Q9-63 41-91 Q20-31 11 22 Q51-4 104-25 Q55 18 13 46 Q9 ${trunkLength - 82} 23 ${trunkLength - 4} L3 ${trunkLength - 11} L-9 ${trunkLength + 3}Z`} fill={dark ? '#111311' : '#30251d'} stroke="#b48b5a" strokeWidth="1.8" />
    <path d={`M-31 ${trunkLength} Q-47 ${trunkLength + 6}-62 ${trunkLength - 1} M-6 ${trunkLength - 5} Q-10 ${trunkLength}-24 ${trunkLength + 6} M23 ${trunkLength - 4} Q42 ${trunkLength + 7} 59 ${trunkLength}`} stroke="#a18e69" strokeWidth="2" fill="none" />
    <g fill="none" stroke="#c29d68" strokeWidth="1.3" opacity=".73">
      <path d={`M-17 ${trunkLength - 6} Q-3 ${trunkLength - 89}-9 47 M-24 ${trunkLength - 25} Q-16 ${trunkLength - 66}-18 95 M-5 80 Q-5 35-25 5 M4 46 Q30 1 76-13 M-7 9 Q-22-52-49-74 M2 9 Q18-44 34-75`} />
      <path d={`M-24 ${trunkLength - 48} q6-10 11-12 M-21 ${trunkLength - 79} q5-7 10-8 M-14 70 q6-8 11-9 M5 85 q5-11 9-14`} />
    </g>
    {lush && <g className="gi-foliage">
      <defs><clipPath id={clipId}><path d={canopy} /></clipPath></defs>
      <path d={canopy} fill={dark ? 'url(#gi-canopy-shadow)' : 'url(#gi-canopy-green)'} stroke="#b2b98a" strokeWidth="2" />
      <g clipPath={`url(#${clipId})`}>
        <path d="M-132-105 Q-16-134 132-58 V18 Q31-19-133 65Z" fill="#bdc88c" opacity=".16" />
        <path d="M-135-12 Q-75-49-34-13 Q-12 19 32-14 Q82-57 140-5 V72 H-135Z" fill="#101f1b" opacity=".19" />
        <path d="M-10 68 Q-19 4-76-51 M-6 53 Q30-36 76-79 M-10 39 Q43 26 121-9 M-2 21 Q-41-53-18-113" fill="none" stroke="#20271e" strokeWidth="7" strokeLinecap="round" opacity=".43" />
        <path d="M-10 68 Q-19 4-76-51 M-6 53 Q30-36 76-79 M-10 39 Q43 26 121-9" fill="none" stroke="#b4a77a" strokeWidth="1.1" opacity=".58" />
        <g fill="none" stroke="#d6ca8f" strokeWidth="1" opacity=".38">
          {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${-132 + i * 15} -120 q-40 92 19 192`} />)}
        </g>
        <g stroke="#aabf83" strokeWidth=".9">
          {CANOPY_MARKS.map((leaf, i) => <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${(i * 47) % 170 - 85})`} opacity={leaf.opacity * .85}>
            <path d="M-8 0 Q-1-7 9 0 Q1 8-8 0Z" fill={i % 4 === 0 ? '#97a66c' : i % 3 === 0 ? '#6f8758' : '#566d49'} />
            <path d="M-7 0 H7" fill="none" stroke="#d5d2a0" strokeWidth=".65" />
          </g>)}
        </g>
        <g fill="none" stroke="#d5d4a1" strokeWidth=".7" opacity=".27">
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${-116 + i * 31} 13 q14-54 49-73`} />)}
        </g>
      </g>
      <path d="M-108-37 Q-62-88-16-89 M18-107 Q54-66 46-16 M111-32 Q83 17 31 24 M-95 29 Q-50 8-12 44" fill="none" stroke="#dae0a6" strokeWidth="1.1" opacity=".45" />
      {fruit && <g fill="#e6b773" stroke="#ffe0a1" strokeWidth="1.4"><circle cx="-70" cy="-31" r="5" /><circle cx="37" cy="-47" r="5" /><circle cx="82" cy="10" r="4" /><circle cx="-25" cy="32" r="4" /></g>}
    </g>}
  </g>
}

function Figure({ x, y, scale = 1, facing = 1, robe = '#76694f' }: { x: number; y: number; scale?: number; facing?: number; robe?: string }) {
  const garment = 'M-22-116 Q0-128 22-115 Q27-94 18-77 Q12-68 16-58 Q22-29 36-11 Q1 4-38-11 Q-24-38-17-63 Q-12-82-22-116Z'
  return <g transform={`translate(${x} ${y}) scale(${facing * scale} ${scale})`}>
    <ellipse cy="2" rx="30" ry="6" fill="#08090b" opacity=".5" />
    {facing < 0 && <path d="M-13-156 Q-28-151-23-121 Q-28-100-16-92 Q-21-118-7-130Z" fill="#2b231e" stroke="#816951" strokeWidth="1" />}
    <path d="M-14-102 Q-20-72-19-49 L-14-5 M13-102 Q20-74 18-49 L17-4" fill="none" stroke="#b99c77" strokeWidth="8" strokeLinecap="round" />
    <path d="M-19-116 Q-22-74-33-44 Q-39-31-33-25 M18-116 Q30-76 34-46 L31-26" fill="none" stroke="#bd9e7c" strokeWidth="8" strokeLinecap="round" />
    <path d={garment} fill={robe} stroke="#d9ba86" strokeWidth="1.8" />
    <path d={garment} fill="url(#gi-robe-hatch)" opacity=".35" />
    <path d="M-21-107 Q-13-91-8-67 Q-17-36-28-15 Q-6-23 3-22 Q-8-61-7-114Z" fill="#d3b182" opacity=".22" />
    <path d="M17-105 Q10-79 15-49 Q18-32 27-15 M-19-96 Q-2-84 18-92 M-21-53 Q-2-56 23-47 M-27-21 Q-7-28 23-20" stroke="#f2d4a0" strokeWidth="1.2" opacity=".55" fill="none" />
    <g transform="translate(0 -141) scale(.7) translate(0 141)">
      <path d="M-16-112 Q-17-131-15-142 Q-16-156-4-161 Q12-161 17-145 L15-125 Q9-116 1-115Z" fill="#bd9b78" stroke="#f3d9a2" strokeWidth="1.5" />
      <path d="M-17-141 Q-20-161-4-165 Q13-170 19-151 Q9-156 6-150 Q-4-156-17-141Z" fill="#2b231e" />
      <path d="M14-141 Q10-132 16-128 M-15-141 Q-17-133-13-127" stroke="#d8b58e" strokeWidth="1" fill="none" />
      <path d="M8-139 l3 2 M-11-140 l-2 2" stroke="#4a382e" strokeWidth="1.3" />
    </g>
    <path d="M-15-3 q-5 5-12 4 M17-3 q6 5 13 4" stroke="#c8a579" strokeWidth="5" strokeLinecap="round" />
  </g>
}

/** Back and shoulder silhouettes are deliberately hidden below the foreground leaves. */
function EdenFigure({ x, y, scale = 1, facing = 1, leafCover = false }: { x: number; y: number; scale?: number; facing?: number; leafCover?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${facing * scale} ${scale})`}>
    {facing < 0 && <path d="M-16-151 Q-32-132-25-100 Q-19-89-12-97 Q-22-126-8-138Z" fill="#30251e" />}
    <path d="M-22-73 Q-15-38-13 5 L12 5 Q15-38 22-73Z" fill="#9f8162" stroke="#d0ad86" strokeWidth="1.2" />
    <path d="M-30-73 Q-34-43-25-15 M29-73 Q34-43 25-15" fill="none" stroke="#a88a69" strokeWidth="6" strokeLinecap="round" />
    <path d="M-21-109 Q-2-122 19-109 Q27-94 22-66 Q5-58-23-66 Q-29-91-21-109Z" fill="#a98b6c" stroke="#d5bb92" strokeWidth="1.5" />
    <path d="M-18-104 Q-8-97 1-97 Q11-96 21-104 M-1-96 Q5-79 0-66" fill="none" stroke="#e5cda3" strokeWidth="1.1" opacity=".6" />
    <path d="M-22-105 Q-33-92-30-69 M20-105 Q32-91 30-69" fill="none" stroke="#ac8c6b" strokeWidth="7" strokeLinecap="round" />
    <path d="M-14-122 Q-16-141-10-150 Q-2-161 10-151 Q16-141 12-125 Q5-118-2-118Z" fill="#bd9c79" stroke="#ead4a9" strokeWidth="1.4" />
    <path d="M-14-140 Q-16-159-3-162 Q10-163 16-149 Q7-153 3-148 Q-5-151-14-140Z" fill="#30251e" />
    <path d="M10-140 l3 1 M-9-140 l-2 1" fill="none" stroke="#574437" strokeWidth="1" />
    {leafCover && <g className="gi-leaf-cover" fill="#63754b" stroke="#d1c88d" strokeWidth="1.2">
      <path d="M-19-68 Q-32-93-9-97 Q-4-83 0-67Z M-2-64 Q6-96 29-88 Q25-70 3-61Z" />
      <path d="M-18-72 L-10-91 M4-66 L24-83" fill="none" stroke="#e0d59e" opacity=".68" />
    </g>}
  </g>
}

function EdenBower({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M-154-27 Q-130-50-102-35 Q-74-60-43-39 Q-8-51 22-38 Q61-59 92-36 Q131-49 156-24 V58 H-154Z" fill="#1b392b" stroke="#708a61" strokeWidth="1" />
    {[-132, -103, -68, -31, 8, 44, 79, 109, 139].map((dx, index) => <g key={dx} transform={`translate(${dx} ${index % 4 * 5 - 6}) rotate(${index % 2 ? 15 : -13}) scale(${index % 3 === 0 ? 1.13 : index % 3 === 1 ? .87 : 1})`}>
      <path d="M0 19 Q-3-25 1-73" fill="none" stroke="#9eaa78" strokeWidth="2" />
      <path d={index % 3 === 0 ? 'M1-4 Q-33-17-37-31 Q-22-43-31-57 Q-8-53 2-82 Q12-57 30-60 Q23-42 37-31 Q26-14 1-4Z' : index % 3 === 1 ? 'M1-4 Q-23-18-25-45 Q-12-64 2-86 Q17-61 25-46 Q22-23 1-4Z' : 'M1-4 Q-31-22-26-51 Q-7-60 2-72 Q15-56 29-50 Q28-19 1-4Z'} fill={index % 3 === 0 ? '#3c583d' : index % 3 === 1 ? '#4d6444' : '#2c4c39'} stroke="#a5b082" strokeWidth="1.5" />
      <path d="M1-5 Q0-40 2-67 M0-34 Q-14-40-21-48 M2-33 Q14-44 23-49" fill="none" stroke="#ccd097" strokeWidth=".9" opacity=".64" />
    </g>)}
    <path d="M-153 24 Q-24 7 155 25 M-130 40 Q5 18 140 42" fill="none" stroke="#c2b78b" strokeWidth="1" opacity=".32" />
  </g>
}

function Bird({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className="gi-bird" fill="none" stroke="#f0deb9" strokeWidth="3.5" strokeLinecap="round">
    <path d="M-42 0 Q-20-25 0-5 Q19-26 42-2" />
    <path d="M-35-1 Q-20-12-7-7 M7-7 Q21-14 37-4" opacity=".5" strokeWidth="1.2" />
  </g>
}

function Fish({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className="gi-fish" stroke="#b3c7c8" fill="#365565" strokeWidth="1.5">
    <path d="M-32 0 Q-10-21 28 0 Q-10 21-32 0Z M25 0 L48-15 L43 0 L48 15Z" />
    <path d="M-14-12 L-8-22 L5-15 M-13 12 L-5 20 L7 14" fill="#365565" />
    <circle cx="-20" cy="-2" r="1.5" fill="#fff4d6" stroke="none" />
    <path d="M-8-13 Q2 0-8 13 M5-11 Q15 0 5 11" fill="none" opacity=".56" />
  </g>
}

function Deer({ x = 1002, y = 591, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="#78644b" stroke="#dbbd84" strokeWidth="1.5">
    <path d="M-68-31 Q-37-52 5-36 L27-58 L44-53 L37-20 L4-10 L-37-9 L-58 2Z" />
    <path d="M-48-12 L-53 41 M-27-10 L-29 41 M7-12 L12 38 M27-19 L34 36" stroke="#ac9270" strokeWidth="8" />
    <path d="M31-55 Q21-78 26-98 M37-57 Q54-76 54-96 M27-83 L12-96 M52-78 L68-94" fill="none" stroke="#b69d74" strokeWidth="3" />
    <circle cx="34" cy="-45" r="2" fill="#fff4d6" stroke="none" />
  </g>
}

function Meadow({ shift = 0 }: { shift?: number }) {
  return <g transform={`translate(0 ${shift})`}>
    <g fill="none" stroke="#b4a57a" opacity=".5" strokeWidth="1.2">
      {MEADOW_MARKS.map((mark, i) => <g key={i} transform={`translate(${mark.x} ${mark.y}) scale(${.6 + mark.r * .3})`} opacity={mark.opacity}>
        <path d="M0 0 q-5-15-11-19 M0 0 q3-19 11-25 M0 0 q2-9 0-24" />
        {i % 7 === 0 && <><path d="M0-25 v-17" /><circle cx="0" cy="-44" r="2.4" fill="#d3bd84" stroke="none" /></>}
      </g>)}
    </g>
    <g fill="none" stroke="#d5c093" strokeWidth=".8" opacity=".28">
      {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${310 + i * 55} ${640 + i % 3 * 10} q26-9 53-4`} />)}
    </g>
  </g>
}

function ArchClouds() {
  return <g fill="none" stroke="#dad3c3" opacity=".62">
    <path d="M190 332 Q300 265 411 306 Q486 228 611 278 Q725 213 829 266 Q925 231 1015 284" strokeWidth="2.4" />
    <path d="M210 351 Q312 292 422 323 Q505 252 610 298 Q723 240 818 290 Q919 255 1006 305" strokeWidth="1" />
    <path d="M261 372 Q340 327 446 351 M530 319 Q612 329 685 300 M748 320 Q858 280 959 332" strokeWidth="1" />
  </g>
}

function SceneArtwork({ id }: { id: SceneId }) {
  switch (id) {
    case 'beginning': return <>
      <Stars deep />
      <ellipse cx="739" cy="389" rx="330" ry="113" fill="url(#gi-haze)" opacity=".25" />
      <path d="M0 370 Q390 235 721 386 T1200 326 V800 H0Z" fill="#101521" stroke="#637386" strokeWidth="1.5" />
      <g fill="none" stroke="#778ba0" opacity=".45" strokeWidth="1.3">
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${220 - i * 26} ${522 + i * 30} Q 560 ${368 + i * 17} 878 ${503 + i * 13} T1230 ${422 + i * 25}`} />)}
      </g>
      <Water dark />
      <path d="M472 555 Q740 465 972 572 M529 596 Q737 527 934 604" stroke="#d9d0b5" strokeWidth="1.4" opacity=".32" fill="none" />
    </>
    case 'day1': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="#0c0c13" />
      <defs><clipPath id="gi-day1-beam"><path d="M674 0 L1185 0 L1200 800 L355 800Z" /></clipPath></defs>
      <path className="gi-light-reveal" d="M674 0 L1185 0 L1200 800 L355 800Z" fill="url(#gi-light)" />
      <path className="gi-light-reveal" d="M725 0 L780 0 L966 800 L553 800Z" fill="url(#gi-ray)" opacity=".87" />
      <g className="gi-light-reveal" clipPath="url(#gi-day1-beam)" stroke="#fff1c9" fill="none" opacity=".48">
        {Array.from({ length: 29 }, (_, i) => <path key={i} d={`M${649 + i * 18} -20 Q${637 + i * 20} 300 ${350 + i * 30} 800`} strokeWidth={i % 5 === 0 ? 1.6 : .55} opacity={i % 4 === 0 ? .75 : .32} />)}
        <path d="M360 768 Q761 535 1193 729 M418 792 Q748 611 1197 759" strokeWidth="1.4" opacity=".56" />
      </g>
      <path d="M0 475 Q182 401 333 457 Q473 430 611 503 Q427 477 264 533 Q143 523 0 554Z" fill="#101119" stroke="#56606a" strokeWidth="1" opacity=".7" />
      <path d="M0 555 Q275 501 490 545 Q767 507 1200 571 V800 H0Z" fill="#111923" />
      <Water dark />
      <ellipse cx="728" cy="551" rx="275" ry="32" fill="#fff4d6" opacity=".19" />
      <g className="gi-light-reveal" fill="none" stroke="#f6deb0" strokeLinecap="round">
        {Array.from({ length: 19 }, (_, i) => <path key={i} d={`M${480 + i * 32} ${575 + (i % 4) * 28} q${12 + i % 3 * 4} -4 ${23 + i % 4 * 5} -1`} strokeWidth={i % 3 === 0 ? 2.1 : 1.1} opacity={.55 - (i % 4) * .08} />)}
      </g>
    </>
    case 'day2': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-sky)" />
      <g className="gi-firmament"><g fill="none" stroke="#d8dbc8" opacity=".57"><path d="M94 483 Q552-35 1134 421" strokeWidth="5" /><path d="M128 482 Q554 18 1111 424" strokeWidth="1.5" /><path d="M163 480 Q563 64 1079 422" strokeWidth="1" /></g>
      <ArchClouds />
      <g className="gi-cloud" fill="#7a8989" opacity=".37"><path d="M347 223 Q411 175 483 219 Q545 171 611 216 Q684 179 735 220 Q787 206 829 230 Q654 254 456 248Z" /></g></g>
      <Water high />
      <path d="M0 469 Q341 432 576 467 Q854 422 1200 458 V800 H0Z" fill="url(#gi-sea)" />
      <g fill="none" stroke="#d9d0b5" opacity=".52">{wavePaths.slice(0, 12).map((path, i) => <path key={i} d={path} transform="translate(0 -116)" />)}</g>
    </>
    case 'day3': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-sky)" />
      <path d="M0 569 Q211 506 446 543 T1200 516 V800 H0Z" fill="#19313b" />
      <g className="gi-land"><path d="M315 550 Q463 416 602 465 L661 416 Q756 386 825 449 Q964 400 1078 473 L1200 510 V800 H463 Q399 694 315 550Z" fill="#46513b" stroke="#ccbb8e" strokeWidth="2" />
      <path d="M319 550 Q509 573 552 773 M654 416 Q659 596 801 787 M826 451 Q882 552 972 699" stroke="#b1a578" opacity=".46" fill="none" />
      <g fill="none" stroke="#b5b98e" opacity=".55">{hillContours.map((path, i) => <path key={i} d={path} transform="translate(325 -70)" />)}</g></g>
      <g className="gi-growth"><Tree x={733} y={432} scale={.8} /><Tree x={1011} y={495} scale={.48} /><Meadow shift={-10} /></g>
      <g fill="#cfb96d" opacity=".7">{Array.from({ length: 22 }, (_, i) => <path key={i} d={`M${497 + i * 26} ${558 + (i % 4) * 22} q-5-15-12-20 m12 20 q5-16 14-20`} stroke="#c6be83" strokeWidth="2" />)}</g>
      <Water />
    </>
    case 'day4': return <>
      <g className="gi-heaven-lights"><Stars />
      <circle cx="750" cy="425" r="178" fill="url(#gi-sun-halo)" className="gi-light-reveal" />
      <circle cx="750" cy="425" r="77" fill="#fff4d6" stroke="#e8b86d" strokeWidth="5" className="gi-light-reveal" />
      <g fill="none" stroke="#f2d99c" strokeWidth="1.4" opacity=".62">{Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return <path key={i} d={`M${750 + Math.cos(a) * 91} ${425 + Math.sin(a) * 91} L${750 + Math.cos(a) * 127} ${425 + Math.sin(a) * 127}`} /> })}</g>
      <circle cx="550" cy="360" r="48" fill="#e4d9be" opacity=".91" />
      <circle cx="566" cy="344" r="43" fill="#19212d" /></g>
      <Hills low />
      <Water dark />
    </>
    case 'day5': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-sky)" />
      <ArchClouds />
      <g className="gi-life"><g className="gi-bird-flight"><Bird x={645} y={181} scale={1.15} /><Bird x={814} y={236} scale={.7} /><Bird x={966} y={166} scale={.9} /><Bird x={504} y={278} scale={.52} /></g></g>
      <path d="M0 423 Q310 390 600 429 T1200 405 V800 H0Z" fill="url(#gi-sea)" />
      <g fill="none" stroke="#ddcfae" opacity=".58">{wavePaths.slice(0, 13).map((path, i) => <path key={i} d={path} transform="translate(0 -141)" />)}</g>
      <g className="gi-life"><path d="M531 615 Q656 497 873 553 Q1000 588 1084 552 Q1032 657 857 673 Q635 689 531 615Z" fill="#354f59" stroke="#bac8ba" strokeWidth="2" />
      <path d="M700 536 Q759 454 852 482 Q829 524 862 557 M1023 576 L1127 510 L1100 602" fill="#354f59" stroke="#bac8ba" strokeWidth="2" />
      <path d="M620 609 Q755 650 974 615 M751 566 Q833 553 916 565" fill="none" stroke="#bdd0c1" opacity=".5" />
      <Fish x={399} y={665} scale={.85} /><Fish x={502} y={719} scale={.58} /><Fish x={1054} y={705} scale={.6} /></g>
      <circle cx="580" cy="523" r="5" fill="#e9e3ce" opacity=".65" />
    </>
    case 'day6': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-sky)" />
      <Hills green />
      <Tree x={1019} y={391} scale={.64} />
      <path d="M0 564 Q393 493 769 527 T1200 518 V800 H0Z" fill="#2b332a" />
      <Meadow shift={-70} />
      <g className="gi-human"><EdenFigure x={692} y={525} scale={1.08} /><EdenFigure x={793} y={525} scale={1.04} facing={-1} /><EdenBower x={744} y={525} scale={.9} /></g>
      <g className="gi-life"><Deer x={825} y={523} scale={.72} />
      <g transform="translate(610 530) scale(.82)" fill="#6d6350" stroke="#cfb488" strokeWidth="1.5"><path d="M-55-44 Q-30-61 18-41 L49-62 L60-55 L45-20 Q6-14-38-19Z" /><path d="M-33-20 L-33 27 M1-20 L2 28 M36-27 L38 29" strokeWidth="7" /><circle cx="52" cy="-49" r="2" fill="#fff4d6" /></g></g>
      <Bird x={897} y={293} scale={.5} />
      <g fill="none" stroke="#b9ad80" opacity=".48">{hillContours.slice(0, 5).map((path, i) => <path key={i} d={path} transform="translate(0 55)" />)}</g>
    </>
    case 'day7': return <>
      <Stars />
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-rest)" opacity=".6" />
      <circle cx="836" cy="361" r="178" fill="url(#gi-sun-halo)" opacity=".54" />
      <ArchClouds />
      <Hills green low />
      <path d="M391 652 Q750 558 1200 653 V800 H0Z" fill="#18251f" />
      <path d="M509 639 Q731 583 1030 627 M576 670 Q755 621 959 648" fill="none" stroke="#d5c398" opacity=".4" />
      <Tree x={978} y={424} scale={.78} />
      <ellipse cx="831" cy="689" rx="315" ry="20" fill="#e8b86d" opacity=".07" />
    </>
    case 'garden': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-garden)" />
      <Hills green low />
      <path d="M1200 558 Q949 531 865 586 Q716 648 673 800 H1200Z" fill="#456c70" stroke="#d8d7b1" strokeWidth="2" />
      <g fill="none" stroke="#e5d1a2" opacity=".53"><path d="M1198 583 Q920 560 829 665 M1195 610 Q991 599 944 760 M1123 644 Q1016 670 995 800" /></g>
      <path d="M385 592 Q569 536 754 558 Q857 539 990 580 V800 H0 V680Z" fill="#283a2d" stroke="#a3a37c" strokeWidth="1.5" />
      <Meadow shift={-66} />
      <Tree x={655} y={435} scale={1.12} trunkLength={110} fruit />
      <Tree x={1030} y={477} scale={.85} trunkLength={110} fruit />
      <path d="M492 552 Q626 542 795 557" fill="none" stroke="#d1bb89" strokeWidth="1.1" opacity=".54" />
      <g className="gi-human"><EdenFigure x={625} y={550} scale={.96} /><EdenFigure x={716} y={550} scale={.93} facing={-1} /><EdenBower x={671} y={550} scale={.84} /></g>
      <g fill="none" stroke="#a4bf8c" opacity=".55">{hillContours.slice(0, 5).map((path, i) => <path key={i} d={path} transform="translate(0 75)" />)}</g>
    </>
    case 'fall': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-fall)" />
      <Stars deep />
      <Hills green low />
      <g transform="translate(-120 0)"><Tree x={796} y={388} scale={1.2} trunkLength={140} dark />
      <g fill="#c76f4a" stroke="#f0b77b" strokeWidth="1.4"><circle cx="708" cy="392" r="8" /><circle cx="865" cy="370" r="8" /><circle cx="920" cy="417" r="7" /></g>
      <path d="M788 560 Q830 499 765 469 Q709 444 740 395 Q772 357 750 324" fill="none" stroke="#9a9864" strokeWidth="14" strokeLinecap="round" />
      <path d="M786 558 Q811 506 766 481 Q731 455 747 414 Q774 361 750 323" fill="none" stroke="#d7bd81" strokeWidth="1.4" opacity=".9" />
      <path d="M742 319 Q749 307 760 317 L749 330Z" fill="#8c9a6c" stroke="#d8bb83" />
      <circle cx="756" cy="318" r="1.5" fill="#fff4d6" />
      <g className="gi-fall-fruit"><circle cx="708" cy="392" r="10" fill="#cb7048" stroke="#f3bf84" strokeWidth="2" /><path d="M708 382 q5-8 12-7" stroke="#9ab06d" fill="none" /></g></g>
      <path d="M0 593 Q396 537 720 581 T1200 556 V800 H0Z" fill="#24231f" />
      <Meadow shift={-70} />
      <EdenFigure x={545} y={555} scale={1.08} leafCover />
      <EdenFigure x={645} y={555} scale={1.03} facing={-1} leafCover />
      <EdenBower x={599} y={555} scale={.89} />
      <path d="M0 720 Q428 671 728 722 T1200 685 V800 H0Z" fill="#201c1b" />
    </>
    case 'closing': return <>
      <path d="M0 0 H1200 V800 H0Z" fill="url(#gi-morning)" />
      <path d="M0 552 Q358 448 639 506 Q903 429 1200 506 V800 H0Z" fill="#473d32" />
      <path d="M760 315 L760 510 M704 370 L816 370" stroke="#261e1a" strokeWidth="16" strokeLinecap="square" />
      <path d="M760 315 L760 510 M704 370 L816 370" stroke="#d2ae73" strokeWidth="1.5" opacity=".7" />
      <g transform="translate(0 -120)"><path d="M367 755 L428 492 Q535 425 674 501 L744 755Z" fill="#706658" stroke="#dac9a6" strokeWidth="2.5" />
      <path d="M473 751 L493 570 Q537 523 598 565 L623 751Z" fill="#080a0d" stroke="#d4be96" strokeWidth="3" />
      <path d="M525 571 Q544 548 572 555" fill="none" stroke="#fff4d6" opacity=".45" />
      <ellipse cx="568" cy="666" rx="128" ry="145" fill="url(#gi-tomb-light)" className="gi-tomb-reveal" />
      <ellipse cx="741" cy="713" rx="96" ry="50" fill="#8b806e" stroke="#d7c49e" strokeWidth="2" />
      <path d="M347 755 Q481 717 692 757 M682 706 Q772 686 852 722" fill="none" stroke="#e1cdac" opacity=".35" /></g>
    </>
    case 'doubt': return <>
      <Stars />
      <path d="M189 487 Q550 367 1069 408" fill="none" stroke="#a6afbc" strokeWidth="1" opacity=".3" />
      <circle cx="836" cy="246" r="67" fill="url(#gi-sun-halo)" opacity=".4" />
      <circle cx="836" cy="246" r="20" fill="#fff4d6" opacity=".74" />
      <Hills low />
      <path d="M0 727 Q437 665 800 694 Q1050 674 1200 715 V800 H0Z" fill="#100f14" />
      <Figure x={714} y={580} scale={1.05} robe="#524e50" />
      <path d="M626 699 Q730 642 877 702" stroke="#b2a78b" fill="none" opacity=".33" />
      <g fill="none" stroke="#c7c7bc" opacity=".22"><circle cx="884" cy="244" r="162" /><circle cx="884" cy="244" r="253" /></g>
    </>
    case 'measure': return <>
      <Stars />
      <g className="gi-measure-reveal" fill="none" stroke="#a9bfd0" opacity=".47"><circle cx="812" cy="288" r="142" /><circle cx="812" cy="288" r="234" /><path d="M812 44 V533 M572 288 H1053 M641 135 Q790 208 1011 454 M987 113 Q810 290 663 462" /></g>
      <g fill="#d8e3de"><circle cx="812" cy="288" r="3" /><circle cx="954" cy="288" r="4" /><circle cx="677" cy="198" r="3" /><circle cx="937" cy="91" r="3" /></g>
      <Hills low />
      <path d="M0 703 Q420 636 798 691 Q1042 649 1200 684 V800 H0Z" fill="#15151b" />
      <g transform="translate(745 642) rotate(-28)" fill="#606c71" stroke="#d0c9b6" strokeWidth="2.2"><path d="M-26-178 H32 L37-36 H-30Z" /><ellipse cx="3" cy="-178" rx="31" ry="12" fill="#bac3bb" /><path d="M-35-65 H40 V-40 H-35Z" /></g>
      <path d="M744 582 L735 709 M741 619 L675 705 M741 619 L811 706" stroke="#b7a686" strokeWidth="7" fill="none" />
      <path d="M726 709 H747 M660 706 H690 M799 707 H824" stroke="#d1b78d" strokeWidth="3" />
    </>
  }
}

export function GenesisIllustration({ sceneId, progress, playing, reducedMotion, onReady }: GenesisIllustrationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const progressRef = useRef(progress)
  const onReadyRef = useRef(onReady)
  const lastSceneRef = useRef(sceneId)
  const fullSceneRef = useRef(!playing || reducedMotion)
  const transitionRef = useRef<Animation | null>(null)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 700)
  const visible = useDocumentVisible()
  progressRef.current = progress
  onReadyRef.current = onReady

  useEffect(() => {
    onReadyRef.current?.(true)
    return () => onReadyRef.current?.(false)
  }, [])

  useEffect(() => {
    const resize = () => setNarrow(window.innerWidth <= 700)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useLayoutEffect(() => {
    if (lastSceneRef.current === sceneId) return
    lastSceneRef.current = sceneId
    fullSceneRef.current = !playing || reducedMotion
    transitionRef.current?.cancel()
    transitionRef.current = null
    const svg = svgRef.current
    if (!playing || !visible || reducedMotion || !svg?.animate) return
    const transition = svg.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 680,
      easing: 'ease-out',
    })
    transitionRef.current = transition
    transition.onfinish = () => {
      if (transitionRef.current === transition) transitionRef.current = null
    }
  }, [sceneId, playing, visible, reducedMotion])

  useLayoutEffect(() => {
    if (reducedMotion) fullSceneRef.current = true
  }, [reducedMotion])

  useEffect(() => {
    if (playing && visible && !reducedMotion) return
    transitionRef.current?.finish()
    transitionRef.current = null
  }, [playing, visible, reducedMotion])

  useEffect(() => () => {
    transitionRef.current?.cancel()
    transitionRef.current = null
  }, [])

  useEffect(() => {
    if (svgRef.current) paint(svgRef.current, sceneId, progress, !fullSceneRef.current)
  }, [sceneId, progress, playing, visible, reducedMotion])

  useEffect(() => {
    if (!playing || reducedMotion || !visible || typeof requestAnimationFrame === 'undefined') return
    let frame = 0
    const animate = () => {
      if (svgRef.current) paint(svgRef.current, sceneId, progressRef.current, !fullSceneRef.current)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [playing, reducedMotion, visible, sceneId])

  return <figure className={`genesis-illustration genesis-illustration--${sceneId}`} role="img" aria-label={LABELS[sceneId]}>
    <svg ref={svgRef} className="gi-art" viewBox={`${narrow ? NARROW_FOCUS[sceneId] : 0} 0 1200 800`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gi-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#141823" /><stop offset=".55" stopColor="#57605e" /><stop offset="1" stopColor="#bda878" /></linearGradient>
        <linearGradient id="gi-sea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#344a51" /><stop offset="1" stopColor="#0b1922" /></linearGradient>
        <linearGradient id="gi-light" x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#fff4d6" stopOpacity=".86" /><stop offset=".68" stopColor="#e8b86d" stopOpacity=".48" /><stop offset="1" stopColor="#e8b86d" stopOpacity="0" /></linearGradient>
        <linearGradient id="gi-ray" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff4d6" stopOpacity=".6" /><stop offset="1" stopColor="#e8b86d" stopOpacity="0" /></linearGradient>
        <linearGradient id="gi-rest" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#07060a" /><stop offset=".72" stopColor="#a58a62" /><stop offset="1" stopColor="#e8b86d" /></linearGradient>
        <linearGradient id="gi-garden" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#17241d" /><stop offset=".7" stopColor="#607258" /><stop offset="1" stopColor="#b4a16e" /></linearGradient>
        <linearGradient id="gi-fall" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#0c0b10" /><stop offset=".63" stopColor="#4b302c" /><stop offset="1" stopColor="#8a4d35" /></linearGradient>
        <linearGradient id="gi-morning" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#191b25" /><stop offset=".6" stopColor="#9a856b" /><stop offset="1" stopColor="#e6bf81" /></linearGradient>
        <linearGradient id="gi-canopy-green" x1=".25" y1="0" x2=".75" y2="1"><stop stopColor="#687c50" /><stop offset=".48" stopColor="#42583e" /><stop offset="1" stopColor="#273b31" /></linearGradient>
        <linearGradient id="gi-canopy-shadow" x1=".25" y1="0" x2=".75" y2="1"><stop stopColor="#586745" /><stop offset=".46" stopColor="#303d2d" /><stop offset="1" stopColor="#1c2823" /></linearGradient>
        <pattern id="gi-robe-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 8 L8-2 M2 10 L10 2" stroke="#ead3a3" strokeWidth=".55" opacity=".52" /></pattern>
        <radialGradient id="gi-sun-halo"><stop stopColor="#fff4d6" stopOpacity=".6" /><stop offset="1" stopColor="#e8b86d" stopOpacity="0" /></radialGradient>
        <radialGradient id="gi-haze"><stop stopColor="#c8c3b4" stopOpacity=".5" /><stop offset="1" stopColor="#c8c3b4" stopOpacity="0" /></radialGradient>
        <radialGradient id="gi-tomb-light"><stop stopColor="#fff4d6" stopOpacity=".53" /><stop offset="1" stopColor="#fff4d6" stopOpacity="0" /></radialGradient>
      </defs>
      <path d="M0 0 H1200 V800 H0Z" fill="#07060a" />
      <SceneArtwork id={sceneId} />
      <g className="gi-engraving" fill="none" stroke="#fff4d6" strokeWidth=".7" opacity=".14">
        <path d="M0 98 Q273 78 536 96 M688 66 Q933 49 1200 80 M0 738 Q170 713 336 738 M833 770 Q1033 751 1200 769" />
      </g>
    </svg>
  </figure>
}
