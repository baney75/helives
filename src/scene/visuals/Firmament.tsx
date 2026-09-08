import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useMemo, useRef } from 'react'
import { BackSide, Color, ShaderMaterial, type Group, type Mesh } from 'three'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'
import { OceanSurface } from './OceanSurface.tsx'

export function Firmament({ clock }: { clock: SceneClock }) {
  const dome = useRef<Mesh>(null)
  const mist = useRef<Group>(null)
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const strength = Math.max(clock.presence.day2, clock.presence.day4 * 0.42) * (1 - garden)
  const daylight = current === 'day2' ? 0.36 : current === 'day3' ? 0.58 : 1
  const segs = clock.quality === 'low' ? 24 : clock.quality === 'medium' ? 40 : 56
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: BackSide,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uDaylight: { value: 0 },
          uZenithNight: { value: new Color('#071526') },
          uZenithDay: { value: new Color('#1c708f') },
          uHorizon: { value: new Color('#5c91a0') },
          uWarmth: { value: new Color('#e7c98f') },
          uCloud: { value: new Color('#a9c3c6') },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIntensity;
          uniform float uDaylight;
          uniform vec3 uZenithNight;
          uniform vec3 uZenithDay;
          uniform vec3 uHorizon;
          uniform vec3 uWarmth;
          uniform vec3 uCloud;
          varying vec3 vDir;

          void main() {
            float height = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
            float horizon = exp(-pow((height - 0.49) * 6.1, 2.0));
            vec3 zenith = mix(uZenithNight, uZenithDay, uDaylight);
            vec3 color = mix(uHorizon, zenith, smoothstep(0.43, 0.93, height));

            float sweepA = sin(vDir.x * 15.0 + vDir.z * 9.0 + uTime * 0.026);
            float sweepB = sin(vDir.x * -8.0 + vDir.z * 17.0 - uTime * 0.019);
            float folded = sin((sweepA + sweepB) * 1.7 + vDir.x * 23.0);
            float cloudBand = smoothstep(0.2, 0.78, height) * (1.0 - smoothstep(0.75, 0.96, height));
            float clouds = smoothstep(0.44, 1.58, sweepA + sweepB + folded * 0.45) * cloudBand;

            float warmWindow = exp(-pow(vDir.x * 1.8 + 0.26, 2.0) - pow((height - 0.48) * 5.0, 2.0));
            float columnPattern = 0.5 + 0.5 * sin(vDir.x * 39.0 + sweepA * 0.16);
            float ray = pow(columnPattern, 8.0) * warmWindow * smoothstep(0.38, 0.65, height);

            color = mix(color, uCloud, clouds * (0.12 + uDaylight * 0.2));
            color = mix(color, uWarmth, horizon * 0.17 + warmWindow * 0.3 + ray * 0.14);
            float alpha = (0.2 + horizon * 0.16 + clouds * 0.08 + ray * 0.035) * uIntensity;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    [],
  )
  const hazeMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uDaylight: { value: 0 },
          uCool: { value: new Color('#527f8e') },
          uCloud: { value: new Color('#becdcc') },
          uWarm: { value: new Color('#ead0a0') },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIntensity;
          uniform float uDaylight;
          uniform vec3 uCool;
          uniform vec3 uCloud;
          uniform vec3 uWarm;
          varying vec2 vUv;

          void main() {
            vec2 p = vUv - 0.5;
            float drift = uTime * 0.008;
            float billowA = sin((p.x + drift) * 17.0 + sin(p.y * 9.0) * 1.6);
            float billowB = sin((p.x - drift * 0.7) * -29.0 + p.y * 13.0);
            float billowC = sin(p.x * 47.0 + p.y * 21.0 + drift * 4.0);
            float cloud = smoothstep(0.38, 1.62, billowA + billowB * 0.62 + billowC * 0.22);
            float bank = exp(-pow((p.y + 0.08) * 3.4, 2.0));
            float window = exp(-pow((p.x + 0.18) * 2.2, 2.0) - pow((p.y - 0.04) * 3.2, 2.0));
            float edge = smoothstep(0.5, 0.3, abs(p.x)) * smoothstep(0.5, 0.34, abs(p.y));
            float alpha = (bank * (0.075 + cloud * 0.14) + window * 0.055) * edge * uIntensity;
            vec3 color = mix(uCool, uCloud, cloud * (0.5 + uDaylight * 0.28));
            color = mix(color, uWarm, window * 0.35);
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    [],
  )

  useEffect(() => () => {
    material.dispose()
    hazeMaterial.dispose()
  }, [hazeMaterial, material])

  useStoryFrame((seconds) => {
    const uTime = material.uniforms.uTime
    const uIntensity = material.uniforms.uIntensity
    const uDaylight = material.uniforms.uDaylight
    const hazeTime = hazeMaterial.uniforms.uTime
    const hazeIntensity = hazeMaterial.uniforms.uIntensity
    const hazeDaylight = hazeMaterial.uniforms.uDaylight
    if (uTime) uTime.value = clock.reducedMotion ? 0 : seconds
    if (uIntensity) uIntensity.value = strength
    if (uDaylight) uDaylight.value = daylight
    if (hazeTime) hazeTime.value = clock.reducedMotion ? 0 : seconds
    if (hazeIntensity) hazeIntensity.value = strength * (current === 'day2' ? 1 : 0.72)
    if (hazeDaylight) hazeDaylight.value = daylight
    if (dome.current) {
      dome.current.visible = strength > 0.03
      dome.current.scale.setScalar(9.2 + clock.scale * 0.35)
    }
    if (mist.current) mist.current.visible = strength > 0.03
  })

  if (strength <= 0) return null

  const overheadStrength = (current === 'day2' ? 0.92 : current === 'day5' ? 0.38 : 0.22) * strength
  return (
    <group>
      <mesh ref={dome} material={material} renderOrder={-20}>
        <sphereGeometry args={[1, segs, Math.max(16, Math.floor(segs * 0.66))]} />
      </mesh>
      <group ref={mist}>
        <mesh position={[0, 1.28, -6.4]} material={hazeMaterial} renderOrder={-10}>
          <planeGeometry args={[16, 6.2]} />
        </mesh>
        <OceanSurface
          strength={overheadStrength}
          y={3.65}
          overhead
          reducedMotion={clock.reducedMotion}
          quality={clock.quality}
          scale={1.18}
        />
        <pointLight
          position={[-2.4, 2.2, 1.2]}
          intensity={(0.72 + daylight * 0.88) * strength}
          color={current === 'day2' ? '#dce9e4' : '#f3d9aa'}
          distance={22}
          decay={1.5}
        />
      </group>
    </group>
  )
}
