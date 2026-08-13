import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, ShaderMaterial, type Mesh } from 'three'
import type { SceneClock } from '../types.ts'

export function Firmament({ clock }: { clock: SceneClock }) {
  const mesh = useRef<Mesh>(null)
  const strength = Math.max(clock.presence.day2, clock.presence.day4 * 0.4)
  const segs = clock.quality === 'low' ? 24 : 40
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uColor: { value: new Color('#8eb4e8') },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIntensity;
          uniform vec3 uColor;
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            float band = smoothstep(-0.15, 0.05, h) * smoothstep(0.85, 0.2, h);
            float wave = 0.5 + 0.5 * sin(vPos.x * 1.4 + uTime * 0.35);
            float alpha = band * (0.18 + wave * 0.12) * uIntensity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock: r3f }) => {
    const uTime = material.uniforms.uTime
    const uIntensity = material.uniforms.uIntensity
    if (uTime) uTime.value = r3f.elapsedTime
    if (uIntensity) uIntensity.value = strength
    if (!mesh.current) return
    mesh.current.visible = strength > 0.03
    mesh.current.scale.setScalar(8.5 + clock.scale * 0.4)
  })

  if (strength <= 0) return null

  return (
    <mesh ref={mesh} material={material}>
      <sphereGeometry args={[1, segs, segs]} />
    </mesh>
  )
}
