import {
  AdaptiveDpr,
  AdaptiveEvents,
  OrbitControls,
  PerformanceMonitor,
  PerspectiveCamera,
  Preload,
} from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { DPR, type Quality } from '../lib/budget.ts'
import { demoteQuality } from '../lib/quality.ts'
import { cameraPose, fogFar, framedCamera } from '../genesis/time.ts'
import type { SceneClock } from './types.ts'
import { SceneEffects } from './SceneEffects.tsx'
import { DryLand } from './visuals/DryLand.tsx'
import { Firmament } from './visuals/Firmament.tsx'
import { Garden } from './visuals/Garden.tsx'
import { HeavenLights } from './visuals/HeavenLights.tsx'
import { LetThereBeLight } from './visuals/LetThereBeLight.tsx'
import { LivingCreatures } from './visuals/LivingCreatures.tsx'
import { MeasureSky } from './visuals/MeasureSky.tsx'
import { TheFall } from './visuals/TheFall.tsx'
import { VoidWaters } from './visuals/VoidWaters.tsx'

function GuidedControls({ clock }: { clock: SceneClock }) {
  return (
    <OrbitControls
      enabled={!clock.cinematic && !clock.playing && !clock.isMobile}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={clock.distance * 0.4}
      maxDistance={clock.distance * 2.1}
      autoRotate={false}
      makeDefault
    />
  )
}

const railPosition = new Vector3()
const railTarget = new Vector3()

function JourneyCameraRig({ clock }: { clock: SceneClock }) {
  const width = useThree((state) => state.size.width)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    if (clock.cinematic || clock.playing) return
    const pose = cameraPose(clock.progress, width < 700)
    camera.position.set(...pose.position)
    camera.lookAt(...pose.target)
    camera.updateMatrixWorld()
  }, [camera, clock.cinematic, clock.playing, clock.progress, width])

  useFrame(({ camera: frameCamera }, delta) => {
    if (clock.cinematic || !clock.playing) return
    const pose = cameraPose(clock.progress, width < 700)
    railPosition.set(...pose.position)
    railTarget.set(...pose.target)
    frameCamera.position.lerp(railPosition, 1 - Math.exp(-delta * 1.75))
    frameCamera.lookAt(railTarget)
  })
  return null
}

function CinematicRig({ clock }: { clock: SceneClock }) {
  useFrame(({ camera }) => {
    if (!clock.cinematic) return
    const p = clock.progress
    const dist = clock.distance
    const angle = p * Math.PI * 1.15
    const y = 0.18 + p * 1.4
    camera.position.set(Math.sin(angle) * dist, y, Math.cos(angle) * dist)
    camera.lookAt(0, 0, 0)
  })
  return null
}

function Creation({ clock }: { clock: SceneClock }) {
  const fog = fogFar(clock.progress)
  const gardenLit = Math.max(clock.presence.garden, clock.presence.fall, clock.presence.day6 * 0.34)
  const creationLit =
    Math.max(
      clock.presence.day3,
      clock.presence.day4,
      clock.presence.day5,
      clock.presence.day6,
      clock.presence.day7,
    ) * (1 - gardenLit)
  const fall = clock.presence.fall
  const gardenFogNear = gardenLit > 0.25 ? 14 : 8
  const startCam = framedCamera(clock.progress)
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[startCam.x, startCam.y, startCam.z]}
        fov={48}
        near={0.05}
        far={220}
      />
      <GuidedControls clock={clock} />
      <JourneyCameraRig clock={clock} />
      <CinematicRig clock={clock} />
      <fog attach="fog" args={['#07060a', gardenFogNear, fog]} />
      <ambientLight intensity={0.27 + clock.presence.day1 * 0.18 + gardenLit * 0.24 - fall * 0.04} />
      <hemisphereLight args={['#7185a0', '#211b10', 0.38 + gardenLit * 0.34 - fall * 0.06]} />
      <pointLight position={[0, 0.4, 0]} intensity={2.4 + clock.presence.day1 * 1.8} color="#ffd28a" distance={28} />
      <pointLight position={[6, 8, 12]} intensity={0.9} color="#7a90b8" distance={48} />
      <directionalLight
        position={[-4.2, 6.8, 4.8]}
        intensity={(1.75 - fall * 0.52) * gardenLit}
        color="#ffe7b8"
      />
      <directionalLight position={[5.5, 3.4, -4]} intensity={0.42 * gardenLit} color="#9caf93" />
      <directionalLight position={[-3.8, 5.2, 5.5]} intensity={0.88 * creationLit} color="#d7e1cb" />
      <pointLight position={[1.4, 2.2, 1.1]} intensity={1.9 * fall} color="#d6974c" distance={10} />
      <VoidWaters clock={clock} />
      <LetThereBeLight clock={clock} />
      <Firmament clock={clock} />
      <DryLand clock={clock} />
      <HeavenLights clock={clock} />
      <LivingCreatures clock={clock} />
      <Garden clock={clock} />
      <TheFall clock={clock} />
      <MeasureSky clock={clock} />
      <SceneEffects clock={clock} />
      <AdaptiveDpr />
      <AdaptiveEvents />
      <Preload all />
    </>
  )
}

function LiveQuality({
  quality,
  locked,
  onFactor,
  onFallback,
}: {
  quality: Quality
  locked: boolean
  onFactor?: (factor: number) => void
  onFallback?: (quality: Quality) => void
}) {
  const qualityRef = useRef(quality)
  qualityRef.current = quality

  if (locked) return null

  return (
    <PerformanceMonitor
      flipflops={3}
      onDecline={(api) => {
        const next = demoteQuality(qualityRef.current, api.factor)
        if (next !== qualityRef.current) onFallback?.(next)
      }}
      onFallback={() => {
        if (qualityRef.current !== 'low') onFallback?.('low')
      }}
      onChange={(api) => onFactor?.(api.factor)}
    />
  )
}

function Fallback() {
  return (
    <div className="fallback">
      <p>This browser cannot start WebGL, so the scene cannot run.</p>
      <p>Try a current Chrome, Firefox, or Safari with hardware acceleration on.</p>
    </div>
  )
}

export function GenesisCanvas({
  clock,
  qualityLocked = false,
  onQualityFallback,
  onPerformanceFactor,
}: {
  clock: SceneClock
  qualityLocked?: boolean
  onQualityFallback?: (quality: Quality) => void
  onPerformanceFactor?: (factor: number) => void
}) {
  const visible = useDocumentVisible()

  return (
    <div className="stage" aria-hidden="true">
      <Canvas
        dpr={DPR[clock.quality]}
        frameloop={visible ? 'always' : 'never'}
        gl={{
          antialias: clock.quality === 'high',
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          preserveDrawingBuffer: true,
        }}
        camera={{
          position: [framedCamera(clock.progress).x, framedCamera(clock.progress).y, framedCamera(clock.progress).z],
          fov: 48,
        }}
        fallback={<Fallback />}
      >
        <color attach="background" args={['#07060a']} />
        <Suspense fallback={null}>
          <Creation clock={clock} />
          <LiveQuality
            quality={clock.quality}
            locked={qualityLocked}
            onFallback={onQualityFallback}
            onFactor={onPerformanceFactor}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
