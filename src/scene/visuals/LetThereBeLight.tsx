import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, type Group } from 'three'
import { useEffect, useMemo, useRef } from 'react'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'
import { sceneLocalProgress } from '../../genesis/time.ts'
import { useStoryFrame } from '../StoryTime.tsx'

function luminousMaterial(layer: 'volume' | 'filament' | 'reflection'): ShaderMaterial {
  const vertexShader = layer === 'volume'
    ? `
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
      `
    : `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `

  const fragmentShader = layer === 'volume'
    ? `
        uniform float uTime;
        uniform float uStrength;
        uniform vec3 uGold;
        uniform vec3 uWhite;
        uniform vec3 uBlue;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec3 vLocal;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float facing = max(dot(normalize(vNormal), viewDir), 0.0);
          float turbulence = sin(vLocal.x * 11.0 + uTime * 0.34)
            * sin(vLocal.y * 13.0 - uTime * 0.27)
            * sin(vLocal.z * 9.0 + uTime * 0.19);
          float breathing = 0.82 + 0.18 * sin(uTime * 0.31 + vLocal.y * 4.0);
          float feather = smoothstep(0.02, 0.7, facing);
          float heart = pow(facing, 5.5);
          float density = feather * (0.11 + heart * 0.58) * breathing;
          density *= 0.88 + turbulence * 0.12;
          vec3 color = mix(uBlue, uGold, smoothstep(-0.45, 0.55, vLocal.y));
          color = mix(color, uWhite, heart * 0.74);
          float alpha = density * uStrength;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `
    : layer === 'filament'
      ? `
          uniform float uTime;
          uniform float uStrength;
          uniform vec3 uGold;
          uniform vec3 uWhite;
          varying vec2 vUv;

          void main() {
            vec2 p = vUv - 0.5;
            p.x *= 1.42;
            float radius = length(p);
            float warpA = sin(p.y * 12.0 - uTime * 0.16) * 0.085 + sin(p.y * 27.0 + uTime * 0.11) * 0.026;
            float warpB = sin(p.y * 9.0 + uTime * 0.12 + 1.7) * 0.13;
            float threadA = exp(-abs(p.x + warpA) * 22.0);
            float threadB = exp(-abs(p.x - warpB) * 29.0) * smoothstep(-0.42, 0.2, p.y);
            float veil = 1.0 - smoothstep(0.08, 0.66, radius);
            float inner = 1.0 - smoothstep(0.0, 0.2, radius);
            float alpha = veil * (0.04 + threadA * 0.14 + threadB * 0.1 + inner * 0.08) * uStrength;
            vec3 color = mix(uGold, uWhite, inner * 0.72 + threadA * 0.18);
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `
      : `
          uniform float uTime;
          uniform float uStrength;
          uniform vec3 uGold;
          uniform vec3 uWhite;
          varying vec2 vUv;

          void main() {
            vec2 p = (vUv - 0.5) * vec2(2.8, 1.0);
            float flow = sin(p.y * 46.0 - uTime * 0.52 + sin(p.x * 12.0) * 1.8);
            float crossFlow = sin(p.y * -31.0 - uTime * 0.29 + p.x * 21.0);
            float strands = smoothstep(1.05, 1.75, flow + crossFlow);
            float path = exp(-pow(abs(p.x) * 1.55, 1.35));
            float falloff = 1.0 - smoothstep(0.24, 0.72, length(p));
            float alpha = path * falloff * (0.075 + strands * 0.18) * uStrength;
            vec3 color = mix(uGold, uWhite, strands * 0.52);
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `

  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uGold: { value: new Color('#efbd62') },
      uWhite: { value: new Color('#fff8e6') },
      uBlue: { value: new Color('#7894c6') },
    },
    vertexShader,
    fragmentShader,
  })
}

export function LetThereBeLight({ clock }: { clock: SceneClock }) {
  const current = findSceneAt(clock.progress).id
  const strength = current === 'day1' ? clock.presence.day1 : 0
  const expansion = current === 'day1' ? sceneLocalProgress(clock.progress) : 0
  const release = useRef<Group>(null)
  const materials = useMemo(() => ({
    volume: luminousMaterial('volume'),
    filament: luminousMaterial('filament'),
    reflection: luminousMaterial('reflection'),
  }), [])

  useEffect(() => () => {
    materials.volume.dispose()
    materials.filament.dispose()
    materials.reflection.dispose()
  }, [materials])

  useStoryFrame((seconds) => {
    const time = clock.reducedMotion ? 0 : seconds
    for (const material of Object.values(materials)) {
      const uTime = material.uniforms.uTime
      const uStrength = material.uniforms.uStrength
      if (uTime) uTime.value = time
      if (uStrength) uStrength.value = strength * (0.36 + expansion * 0.64)
    }
    if (release.current) {
      release.current.visible = strength > 0.015
      release.current.scale.setScalar(0.42 + expansion * 0.82)
    }
  })

  if (strength <= 0) return null

  return (
    <group ref={release} position={[-0.36, 0.08, 0]}>
      <mesh material={materials.volume} scale={[1.15, 0.92, 1]}>
        <icosahedronGeometry args={[0.34, clock.quality === 'low' ? 2 : 4]} />
      </mesh>
      <mesh material={materials.volume} scale={[2.8, 1.72, 2.3]} rotation={[0.16, -0.2, -0.08]}>
        <icosahedronGeometry args={[0.42, clock.quality === 'low' ? 2 : 3]} />
      </mesh>
      <group scale={[2.8, 2.35, 2.8]}>
        <mesh material={materials.filament} rotation={[0, 0, -0.14]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh material={materials.filament} rotation={[0.04, Math.PI / 3, 0.2]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        {clock.quality !== 'low' ? (
          <mesh material={materials.filament} rotation={[-0.08, -Math.PI / 3, 0.06]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ) : null}
      </group>
      <mesh
        material={materials.reflection}
        position={[0.22, -1.12, 0.38]}
        rotation={[-Math.PI / 2, 0, -0.12]}
        scale={[3.8, 4.9, 1]}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      <pointLight intensity={4.4 * strength} color="#f4cf87" distance={16} decay={1.7} />
      <pointLight position={[0.4, -0.9, 1]} intensity={1.4 * strength} color="#8ca9cf" distance={8} />
    </group>
  )
}
