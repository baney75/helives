import {
  AdaptiveDpr,
  AdaptiveEvents,
  OrbitControls,
  PerformanceMonitor,
  PerspectiveCamera,
  Preload,
  useGLTF,
} from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Vector3 } from 'three'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { DPR, type Quality } from '../lib/budget.ts'
import { demoteQuality } from '../lib/quality.ts'
import { guardWebGLContext } from '../lib/webglSafety.ts'
import { cameraPose, fogFar, framedCamera } from '../genesis/time.ts'
import type { SceneClock } from './types.ts'
import { INTERACTIVE_SECONDS } from '../genesis/sceneTiming.ts'
import { StoryTimeProvider } from './StoryTime.tsx'
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
      <ambientLight intensity={0.22 + clock.presence.day1 * 0.18 + gardenLit * 0.13 - fall * 0.03} />
      <hemisphereLight args={['#7185a0', '#21180e', 0.28 + gardenLit * 0.24 - fall * 0.05]} />
      <pointLight
        position={gardenLit > 0.25 ? [-1.8, 3.8, 0.75] : [0, 0.4, 0]}
        intensity={gardenLit > 0.25 ? 2.1 : 2.4 + clock.presence.day1 * 1.8}
        color="#ffd790"
        distance={28}
        decay={2}
      />
      <pointLight position={[6, 8, 12]} intensity={0.9} color="#7a90b8" distance={48} />
      <directionalLight
        castShadow={clock.quality !== 'low'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        position={[-4.2, 6.8, 4.8]}
        intensity={(2.05 - fall * 0.62) * gardenLit}
        color="#ffe7b8"
      />
      <directionalLight position={[5.5, 3.4, -4]} intensity={0.28 * gardenLit} color="#8fa698" />
      <pointLight position={[0.42, 1.72, 2.28]} intensity={0.52 * gardenLit} color="#ffd8ad" distance={4.8} decay={2} />
      <directionalLight position={[-3.8, 5.2, 5.5]} intensity={0.88 * creationLit} color="#d7e1cb" />
      <pointLight position={[1.4, 2.2, 1.1]} intensity={0.8 * fall} color="#d6974c" distance={8} decay={2} />
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
      {clock.quality === 'high' ? <Preload all /> : <Preload />}
    </>
  )
}

const MODEL_URLS = [
  '/models/genesis/man.glb',
  '/models/genesis/woman.glb',
  '/models/genesis/fish.glb',
  '/models/genesis/bird.glb',
] as const

class CanvasErrorBoundary extends Component<{
  children: ReactNode
  onUnavailable?: () => void
  onRetry: () => void
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.props.onUnavailable?.()
  }

  private retry = (): void => {
    this.props.onRetry()
    this.setState({ failed: false })
  }

  render(): ReactNode {
    return this.state.failed ? (
      <div className="stage stage-fallback">
        <Fallback onRetry={this.retry} />
      </div>
    ) : this.props.children
  }
}

function WebGLGuard({
  onLost,
  onRestored,
}: {
  onLost: () => void
  onRestored: () => void
}) {
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => guardWebGLContext(canvas, onLost, onRestored), [canvas, onLost, onRestored])
  return null
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

function Fallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="fallback" role="status">
      <p>The 3D scene could not start.</p>
      <p>The Scripture, narration, and controls remain available. You can retry the full scene when the connection or graphics context recovers.</p>
      {onRetry ? <button type="button" className="icon-btn primary" onClick={onRetry}>Retry 3D scene</button> : null}
    </div>
  )
}

function canStartWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function Readiness({ ready, onReady }: { ready: boolean; onReady?: (ready: boolean) => void }) {
  // Suspense replays layout effects when it reveals an existing scene. A passive
  // effect can leave the production app loading after a later model resolves.
  useLayoutEffect(() => { onReady?.(ready) }, [ready, onReady])
  return null
}

export function GenesisCanvas({
  clock,
  qualityLocked = false,
  onQualityFallback,
  onPerformanceFactor,
  onReady,
  onUnavailable,
}: {
  clock: SceneClock
  onReady?: (ready: boolean) => void
  onUnavailable?: () => void
  qualityLocked?: boolean
  onQualityFallback?: (quality: Quality) => void
  onPerformanceFactor?: (factor: number) => void
}) {
  const visible = useDocumentVisible()
  const [webglAvailable, setWebglAvailable] = useState(canStartWebGL)
  const [epoch, setEpoch] = useState(0)
  const lost = useRef(onQualityFallback)
  lost.current = onQualityFallback

  useEffect(() => {
    if (!webglAvailable) onUnavailable?.()
  }, [onUnavailable, webglAvailable])

  const retry = useCallback(() => {
    for (const url of MODEL_URLS) useGLTF.clear(url)
    const available = canStartWebGL()
    if (!available) {
      // A failed retry must preserve the usable text/audio fallback. Since the
      // boolean state remains false, its effect will not fire a second time.
      onUnavailable?.()
      return
    }
    onReady?.(false)
    setWebglAvailable(true)
    setEpoch((value) => value + 1)
  }, [onReady, onUnavailable])

  if (!webglAvailable) {
    return (
      <div className="stage stage-fallback">
        <Fallback onRetry={retry} />
      </div>
    )
  }

  return (
    <CanvasErrorBoundary onUnavailable={onUnavailable} onRetry={retry}>
      <div className="stage" aria-hidden="true">
      <Canvas
        key={epoch}
        shadows={clock.quality !== 'low'}
        dpr={DPR[clock.quality]}
        frameloop={visible ? 'always' : 'never'}
        gl={{
          antialias: clock.quality === 'high',
          alpha: false,
          powerPreference: clock.isMobile ? 'default' : 'high-performance',
          stencil: false,
          preserveDrawingBuffer: false,
        }}
        camera={{
          position: [framedCamera(clock.progress).x, framedCamera(clock.progress).y, framedCamera(clock.progress).z],
          fov: 48,
        }}
        fallback={<Fallback onRetry={retry} />}
      >
        <color attach="background" args={['#07060a']} />
        <WebGLGuard
          onLost={() => lost.current?.('low')}
          onRestored={() => setEpoch((value) => value + 1)}
        />
        <StoryTimeProvider seconds={clock.progress * INTERACTIVE_SECONDS}>
        <Suspense fallback={<Readiness ready={false} onReady={onReady} />}>
          <Readiness ready onReady={onReady} />
          <Creation clock={clock} />
          <LiveQuality
            quality={clock.quality}
            locked={qualityLocked}
            onFallback={onQualityFallback}
            onFactor={onPerformanceFactor}
          />
        </Suspense>
        </StoryTimeProvider>
      </Canvas>
      </div>
    </CanvasErrorBoundary>
  )
}
