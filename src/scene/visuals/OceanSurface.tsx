import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, ShaderMaterial, type Mesh } from 'three'

type OceanSurfaceProps = {
  strength: number
  y: number
  overhead?: boolean
  reducedMotion: boolean
  quality: 'low' | 'medium' | 'high'
  scale?: number
}

export function OceanSurface({
  strength,
  y,
  overhead = false,
  reducedMotion,
  quality,
  scale = 1,
}: OceanSurfaceProps) {
  const mesh = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: !overhead,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uStrength: { value: strength },
          uDeep: { value: new Color(overhead ? '#092946' : '#061929') },
          uLight: { value: new Color(overhead ? '#80d9e7' : '#2381a0') },
          uGold: { value: new Color('#f4ddb0') },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uStrength;
          varying float vWave;
          varying vec3 vWorld;
          void main() {
            vec3 p = position;
            float broad = sin(p.x * 0.72 + uTime * 0.62) * 0.16;
            float cross = sin(p.y * 1.17 - uTime * 0.47 + p.x * 0.24) * 0.095;
            float detail = sin((p.x - p.y) * 2.35 + uTime * 0.88) * 0.035;
            vWave = broad + cross + detail;
            p.z += vWave * (0.45 + uStrength * 0.55);
            vec4 world = modelMatrix * vec4(p, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          uniform float uStrength;
          uniform vec3 uDeep;
          uniform vec3 uLight;
          uniform vec3 uGold;
          varying float vWave;
          varying vec3 vWorld;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorld);
            float horizon = pow(1.0 - abs(viewDir.y), 2.0);
            float crest = smoothstep(0.13, 0.27, vWave);
            float shimmer = 0.5 + 0.5 * sin(vWorld.x * 3.2 + vWorld.z * 2.4);
            vec3 color = mix(uDeep, uLight, 0.38 + vWave * 1.15 + horizon * 0.18);
            color = mix(color, uGold, crest * (0.35 + shimmer * 0.22));
            float alpha = (0.8 + horizon * 0.12) * uStrength;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    [overhead],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    const time = material.uniforms.uTime
    const intensity = material.uniforms.uStrength
    if (time) time.value = reducedMotion ? 0 : clock.elapsedTime
    if (intensity) intensity.value = strength
    if (mesh.current) mesh.current.visible = strength > 0.025
  })

  const segments = quality === 'low' ? 28 : quality === 'medium' ? 48 : 72
  return (
    <mesh
      ref={mesh}
      position={[0, y, 0]}
      rotation={[overhead ? Math.PI / 2 : -Math.PI / 2, 0, overhead ? Math.PI : 0]}
      scale={[scale, scale, scale]}
      material={material}
    >
      <planeGeometry args={[18, 18, segments, segments]} />
    </mesh>
  )
}
