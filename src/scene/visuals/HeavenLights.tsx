import { Stars } from '@react-three/drei'
import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, type Group } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'

function createSunMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uWarm: { value: new Color('#efba5c') },
      uWhite: { value: new Color('#fff5d7') },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uWarm;
      uniform vec3 uWhite;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vLocal;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float facing = max(dot(normalize(vNormal), viewDir), 0.0);
        float grain = sin(vLocal.x * 31.0 + uTime * 0.05) * sin(vLocal.y * 27.0 - uTime * 0.04);
        float disc = smoothstep(0.02, 0.68, facing);
        float center = pow(facing, 4.0);
        float alpha = (disc * 0.52 + center * 0.36) * uStrength * (0.96 + grain * 0.04);
        vec3 color = mix(uWarm, uWhite, center * 0.88);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}

/** Day four's lights are landmarks in the firmament, with a restrained Day five carryover. */
export function HeavenLights({ clock }: { clock: SceneClock }) {
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const strength =
    (current === 'day4' ? clock.presence.day4 : current === 'day5' ? 0.2 : current === 'day7' ? 0.1 : 0) *
    (1 - garden)
  const group = useRef<Group>(null)
  const sunMaterial = useMemo(createSunMaterial, [])

  useEffect(() => () => sunMaterial.dispose(), [sunMaterial])

  useStoryFrame((seconds) => {
    if (group.current) group.current.visible = strength > 0.025
    const time = sunMaterial.uniforms.uTime
    const intensity = sunMaterial.uniforms.uStrength
    if (time) time.value = clock.reducedMotion ? 0 : seconds
    if (intensity) intensity.value = strength
  })

  if (strength <= 0) return null

  const starCount = Math.round(BUDGET[clock.quality].stars * (current === 'day4' ? 0.28 : 0.12))
  return (
    <group ref={group}>
      <group position={[3.85, 2.55, -5.1]}>
        <mesh material={sunMaterial} scale={[1, 1, 0.82]}>
          <sphereGeometry args={[0.34, clock.quality === 'low' ? 18 : 30, clock.quality === 'low' ? 14 : 24]} />
        </mesh>
        <pointLight intensity={2.3 * strength} color="#ffe6ad" distance={19} decay={1.7} />
      </group>
      <group position={[-3.7, 2.08, -5.8]}>
        <mesh>
          <sphereGeometry args={[0.25, 24, 24]} />
          <meshStandardMaterial
            color="#c9cecb"
            emissive="#596b82"
            emissiveIntensity={0.16 * strength}
            transparent
            opacity={Math.min(0.86, strength)}
            roughness={0.96}
            metalness={0}
          />
        </mesh>
        <mesh position={[-0.075, 0.08, 0.236]}>
          <circleGeometry args={[0.042, 16]} />
          <meshBasicMaterial color="#858d92" transparent opacity={0.48 * strength} side={DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0.072, -0.035, 0.24]}>
          <circleGeometry args={[0.055, 16]} />
          <meshBasicMaterial color="#93999b" transparent opacity={0.42 * strength} side={DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <Stars radius={68} depth={32} count={starCount} factor={1.18} saturation={0} fade speed={0} />
    </group>
  )
}
