import { useStoryFrame } from '../StoryTime.tsx'
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

/** A deterministic, layered sea shared by the void, firmament, coast, and creatures. */
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
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uStrength: { value: strength },
          uOverhead: { value: overhead ? 1 : 0 },
          uDeep: { value: new Color(overhead ? '#061a2d' : '#020b14') },
          uMid: { value: new Color(overhead ? '#145a75' : '#07506a') },
          uLight: { value: new Color(overhead ? '#85d9df' : '#20a0b0') },
          uGold: { value: new Color('#f1d5a0') },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uStrength;
          uniform float uOverhead;
          varying float vWave;
          varying float vChop;
          varying vec3 vWorld;
          varying vec3 vNormal;
          varying vec2 vPlane;

          float sea(vec2 p, float time) {
            float broad = sin(dot(p, vec2(0.48, 0.13)) + time * 0.21) * 0.22;
            float crossing = sin(dot(p, vec2(-0.21, 0.78)) - time * 0.17 + sin(p.x * 0.17)) * 0.12;
            float middle = sin(dot(p, vec2(1.18, 0.57)) + time * 0.34) * 0.055;
            float detail = sin(dot(p, vec2(-2.1, 1.44)) - time * 0.42) * 0.022;
            return broad + crossing + middle + detail;
          }

          void main() {
            vec3 p = position;
            float amplitude = mix(0.7, 0.42, uOverhead) * (0.62 + uStrength * 0.38);
            float wave = sea(p.xy, uTime) * amplitude;
            float eps = 0.045;
            float dx = (sea(p.xy + vec2(eps, 0.0), uTime) - sea(p.xy - vec2(eps, 0.0), uTime)) / (2.0 * eps);
            float dy = (sea(p.xy + vec2(0.0, eps), uTime) - sea(p.xy - vec2(0.0, eps), uTime)) / (2.0 * eps);
            p.z += wave;
            vWave = wave;
            vChop = length(vec2(dx, dy));
            vNormal = normalize(mat3(modelMatrix) * vec3(-dx * amplitude, -dy * amplitude, 1.0));
            vPlane = position.xy / 12.0;
            vec4 world = modelMatrix * vec4(p, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uStrength;
          uniform float uOverhead;
          uniform vec3 uDeep;
          uniform vec3 uMid;
          uniform vec3 uLight;
          uniform vec3 uGold;
          varying float vWave;
          varying float vChop;
          varying vec3 vWorld;
          varying vec3 vNormal;
          varying vec2 vPlane;

          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorld);
            vec3 normal = normalize(vNormal);
            float facing = clamp(abs(dot(normal, viewDir)), 0.0, 1.0);
            float fresnel = pow(1.0 - facing, 2.35);
            float fineA = sin((vPlane.x * 97.0 + vPlane.y * 43.0) + uTime * 0.42);
            float fineB = sin((vPlane.x * -61.0 + vPlane.y * 109.0) - uTime * 0.31);
            float lace = smoothstep(1.2, 1.82, fineA + fineB + vChop * 2.4);
            float crest = smoothstep(0.085, 0.19, vWave + vChop * 0.035);
            vec3 sunDir = normalize(vec3(-0.34, 0.76, 0.55));
            vec3 reflected = reflect(-sunDir, normal);
            float glint = pow(max(dot(reflected, viewDir), 0.0), 52.0);
            float longGlint = pow(max(dot(reflected, viewDir), 0.0), 9.0);

            vec3 color = mix(uDeep, uMid, 0.3 + max(vWave, -0.08) * 1.1 + fresnel * 0.34);
            color = mix(color, uLight, fresnel * 0.48 + crest * 0.3 + lace * 0.08);
            color = mix(color, uGold, glint * 0.68 + longGlint * 0.12);
            float radial = length(vPlane * vec2(0.72, 1.0));
            float edge = 1.0 - smoothstep(0.72, 1.02, radial);
            float body = mix(1.0, 0.5, uOverhead);
            float alpha = min(1.0, body + fresnel * 0.11 + crest * 0.06) * uStrength * edge;
            if (alpha < 0.003) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    [overhead],
  )

  useEffect(() => () => material.dispose(), [material])

  useStoryFrame((seconds) => {
    const time = material.uniforms.uTime
    const intensity = material.uniforms.uStrength
    if (time) time.value = reducedMotion ? 0 : seconds
    if (intensity) intensity.value = strength
    if (mesh.current) mesh.current.visible = strength > 0.025
  })

  const segments = quality === 'low' ? 30 : quality === 'medium' ? 58 : 92
  return (
    <mesh
      ref={mesh}
      position={[0, y, 0]}
      rotation={[overhead ? Math.PI / 2 : -Math.PI / 2, 0, overhead ? Math.PI : 0]}
      scale={[scale, scale, scale]}
      material={material}
      renderOrder={overhead ? -1 : 0}
    >
      <planeGeometry args={[24, 20, segments, segments]} />
    </mesh>
  )
}
