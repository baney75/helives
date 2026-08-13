import { AdaptiveDpr, OrbitControls, PerspectiveCamera, Preload } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense } from 'react'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { DPR } from '../lib/budget.ts'
import { fogFar, framedCamera } from '../genesis/time.ts'
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
  const camera = useThree((state) => state.camera)

  useFrame(() => {
    if (clock.cinematic) return
    if (!clock.playing && clock.progress >= 0.6 && clock.progress < 0.86) {
      const framed = framedCamera(clock.progress)
      camera.position.lerp(camera.position.clone().set(framed.x, framed.y, framed.z), 0.12)
      camera.lookAt(0.2, 0.7, 0.2)
      return
    }
    const len = camera.position.length()
    if (len < 0.2) return
    const scale = 1 + (clock.distance / len - 1) * 0.035
    camera.position.multiplyScalar(scale)
  })

  const gardenStill = !clock.playing && clock.progress >= 0.6 && clock.progress < 0.86

  return (
    <OrbitControls
      enabled={!clock.cinematic && !gardenStill}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={clock.distance * 0.4}
      maxDistance={clock.distance * 2.1}
      autoRotate={!clock.reducedMotion && !clock.cinematic && clock.playing}
      autoRotateSpeed={0.16}
      makeDefault
    />
  )
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
  const gardenLit = Math.max(clock.presence.garden, clock.presence.fall)
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
      <CinematicRig clock={clock} />
      <fog attach="fog" args={['#07060a', gardenFogNear, fog]} />
      <ambientLight intensity={0.28 + clock.presence.day1 * 0.2 + gardenLit * 0.35} />
      <hemisphereLight args={['#2a3a58', '#07060a', 0.42 + gardenLit * 0.2]} />
      <pointLight position={[0, 0.4, 0]} intensity={3.2 + clock.presence.day1 * 4} color="#ffd28a" distance={28} />
      <pointLight position={[6, 8, 12]} intensity={0.9} color="#7a90b8" distance={48} />
      <directionalLight
        position={[4.2, 5.4, 3.2]}
        intensity={1.15 * gardenLit}
        color="#ffe7b8"
      />
      <pointLight position={[1.4, 2.2, 1.1]} intensity={2.4 * clock.presence.fall} color="#e8b86d" distance={10} />
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
      <Preload all />
    </>
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

export function GenesisCanvas({ clock }: { clock: SceneClock }) {
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
        </Suspense>
      </Canvas>
    </div>
  )
}
