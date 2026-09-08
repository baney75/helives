import { Line } from '@react-three/drei'
import { useStoryFrame } from '../StoryTime.tsx'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, type Points } from 'three'
import type { SceneClock } from '../types.ts'

type Point3 = [number, number, number]

// A sparse, fixed survey rather than a decorative star field: the marks give the
// final scene a human scale and make the sky feel observed.
const MARKERS: readonly Point3[] = [
  [-3.7, 2.1, -1.8], [-3.15, 0.64, -2.45], [-2.55, 3.18, -2.8], [-1.84, 1.47, -3.15],
  [-1.1, 3.76, -2.7], [-0.42, 0.92, -3.4], [0.18, 2.5, -3.1], [0.9, 4.04, -2.42],
  [1.56, 1.24, -3.34], [2.08, 2.83, -3.05], [2.7, 0.54, -2.55], [3.18, 3.42, -2.18],
  [3.76, 1.74, -1.7], [-2.1, -0.08, -2.7], [0.06, -0.3, -3.2], [2.26, -0.1, -2.55],
]

function ellipse(rx: number, ry: number, rotation = 0): Point3[] {
  return Array.from({ length: 38 }, (_value, index) => {
    const angle = (index / 37) * Math.PI * 2
    return [Math.cos(angle) * rx, Math.sin(angle) * ry + 1.75, Math.sin(angle) * Math.sin(rotation) - 2.7]
  })
}

function sweep(y: number, amplitude: number): Point3[] {
  return Array.from({ length: 34 }, (_value, index) => {
    const x = -4.25 + (index / 33) * 8.5
    return [x, y + Math.cos((x / 4.25) * Math.PI * 0.5) * amplitude, -2.5]
  })
}

export function MeasureSky({ clock }: { clock: SceneClock }) {
  const strength = Math.max(clock.presence.doubt * 0.55, clock.presence.measure)
  const assembly = useRef<Group>(null)
  const field = useRef<Points>(null)
  const grid = useMemo(
    () => [ellipse(4.12, 2.72, 0.12), ellipse(2.6, 3.62, 0.46), sweep(1.64, 0.15), sweep(2.86, 0.42), sweep(0.46, -0.24)],
    [],
  )
  const signal = useMemo(() => new Float32Array(MARKERS.flatMap(([x, y, z], index) => {
    const offset = ((index * 17) % 7) * 0.018
    return [x + offset, y - offset, z]
  })), [])

  useStoryFrame((seconds) => {
    if (assembly.current) {
      assembly.current.visible = strength > 0.03
      assembly.current.position.set(clock.isMobile ? 0 : 1.9, (clock.isMobile ? -1.2 : -0.42) + (clock.reducedMotion ? 0 : Math.sin(seconds * 0.18) * 0.025), 0)
      assembly.current.rotation.y = clock.reducedMotion ? 0 : Math.sin(seconds * 0.07) * 0.035
    }
    if (field.current) {
      field.current.visible = strength > 0.03
      if (!clock.reducedMotion) field.current.rotation.z = seconds * 0.008
    }
  })

  if (strength <= 0) return null

  return (
    <group ref={assembly}>
      <group scale={clock.isMobile ? [0.4, 0.4, 0.48] : [0.58, 0.58, 0.7]}>
        {grid.map((points, index) => (
          <Line
            key={index}
            points={points}
            color={index === 0 ? '#d8c590' : '#7d9ebf'}
            lineWidth={index === 0 ? 1.15 : 0.7}
            transparent
            opacity={(index === 0 ? 0.42 : 0.18) * strength}
          />
        ))}
        <Line
          points={[[-4.35, -0.65, -2.3], [-1.05, 1.06, -2.72], [2.56, 3.55, -2.27]]}
          color="#e8b86d"
          lineWidth={1.05}
          transparent
          opacity={0.48 * strength}
        />
        <Line
          points={[[-3.92, 3.82, -2.26], [-0.18, 2.12, -2.95], [3.98, 0.14, -2.18]]}
          color="#a9c1d9"
          lineWidth={0.85}
          transparent
          opacity={0.28 * strength}
        />
        {MARKERS.map((position, index) => (
          <mesh key={index} position={position}>
            <sphereGeometry args={[index % 5 === 0 ? 0.075 : 0.04, 10, 10]} />
            <meshBasicMaterial
              color={index % 5 === 0 ? '#f0d9a8' : '#b6cae0'}
              transparent
              opacity={(index % 5 === 0 ? 0.94 : 0.62) * strength}
              toneMapped={false}
            />
          </mesh>
        ))}
        <points ref={field}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[signal, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={clock.quality === 'low' ? 0.04 : 0.028}
            color="#dbe8f4"
            transparent
            opacity={0.44 * strength}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </points>
      </group>
      <pointLight position={[-1.4, 2.2, 1.6]} intensity={0.48 * strength} color="#9fbcd6" distance={14} />
    </group>
  )
}
