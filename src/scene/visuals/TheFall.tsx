import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3, type Mesh } from 'three'
import type { SceneClock } from '../types.ts'

export function TheFall({ clock }: { clock: SceneClock }) {
  const strength = clock.presence.fall
  const mesh = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(0.15, 0.2, 0.9),
      new Vector3(0.45, 0.85, 0.4),
      new Vector3(0.1, 1.5, 0.15),
      new Vector3(-0.2, 1.9, 0.35),
    ])
    return new TubeGeometry(curve, 32, 0.035, 8, false)
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock: r3f }) => {
    if (!mesh.current) return
    mesh.current.visible = strength > 0.05
    if (!clock.reducedMotion) mesh.current.rotation.y = Math.sin(r3f.elapsedTime * 0.4) * 0.08
  })

  if (strength <= 0) return null

  return (
    <group>
      <mesh ref={mesh} geometry={geometry}>
        <meshStandardMaterial color="#5a3a28" roughness={0.45} />
      </mesh>
      <pointLight position={[0.2, 1.2, 1.2]} intensity={1.4 * strength} color="#c45a3a" distance={8} />
      <mesh position={[0, 2.1, 0.2]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#8a2a22" roughness={0.4} />
      </mesh>
    </group>
  )
}
