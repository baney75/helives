import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, ExtrudeGeometry, InstancedMesh, Shape, type Group } from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { writeOrientedInstances } from '../../lib/instances.ts'
import { fillDisk, mulberry32 } from '../../lib/rng.ts'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'
import { OceanSurface } from './OceanSurface.tsx'

const land = new Color('#6d8a4e')
const soil = new Color('#8a6b3d')
const color = new Color()

export function DryLand({ clock }: { clock: SceneClock }) {
  const terrain = useRef<Group>(null)
  const plants = useRef<InstancedMesh>(null)
  const crowns = useRef<InstancedMesh>(null)
  const fruit = useRef<InstancedMesh>(null)
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const strength =
    (current === 'day3' ? clock.presence.day3 : current === 'day4' ? 0.28 : current === 'day7' ? 0.08 : 0) *
    (1 - garden)
  const count = Math.max(28, Math.round(Math.sqrt(BUDGET[clock.quality].earth) * 1.8))
  const positions = useMemo(() => {
    const disk = fillDisk(count, 1.65, 88, 0.02)
    for (let i = 0; i < count; i += 1) {
      disk[i * 3] = (disk[i * 3] ?? 0) * 1.22 - 0.2
      disk[i * 3 + 1] = 0
      // Keep the nearest shore open so the land reads as coastline and meadow,
      // not as a wall of repeated vegetation.
      disk[i * 3 + 2] = (disk[i * 3 + 2] ?? 0) * 0.58 - 0.34
    }
    return disk
  }, [count])
  const kinds = useMemo(() => {
    const rng = mulberry32(51)
    return Float32Array.from({ length: count }, () => rng())
  }, [count])

  useLayoutEffect(() => {
    const inst = plants.current
    if (!inst) return
    writeOrientedInstances(inst, positions, count, (i) => {
      const scale = 0.48 + (kinds[i] ?? 0) * 0.46
      return {
        scale: [scale * 0.62, scale, scale * 0.62],
        rotation: [0, (kinds[i] ?? 0) * Math.PI * 2, ((i % 5) - 2) * 0.035],
      }
    })
    for (let i = 0; i < count; i += 1) {
      color.copy((kinds[i] ?? 0) > 0.42 ? land : soil)
      inst.setColorAt(i, color)
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true

    const canopy = crowns.current
    if (!canopy) return
    writeOrientedInstances(canopy, positions, count, (i) => {
      const scale = 0.55 + (kinds[i] ?? 0) * 0.7
      return {
        scale: [scale * 0.24, scale * 0.32, scale * 0.24],
        rotation: [0, (kinds[i] ?? 0) * Math.PI * 2, 0],
      }
    })
    for (let i = 0; i < count; i += 1) {
      color.set((kinds[i] ?? 0) > 0.55 ? '#b7ca7b' : '#789954')
      canopy.setColorAt(i, color)
    }
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true

    const fruitMesh = fruit.current
    if (!fruitMesh) return
    writeOrientedInstances(fruitMesh, positions, count, (i) => {
      const visible = (kinds[i] ?? 0) > 0.58 ? 1 : 0
      return {
        scale: [visible, visible, visible],
        rotation: [0, 0, 0],
      }
    })
  }, [count, kinds, positions])

  const islandGeometry = useMemo(() => createIslandGeometry([
    [-2.65, -0.2], [-2.25, -1.0], [-1.5, -1.38], [-0.65, -1.26], [0.2, -1.48],
    [1.05, -1.16], [1.72, -0.72], [2.42, -0.48], [2.68, 0.15], [2.18, 0.62],
    [1.45, 0.72], [0.88, 1.14], [0.08, 1.28], [-0.62, 1.02], [-1.35, 1.18],
    [-2.05, 0.78], [-2.72, 0.52],
  ], 0.38), [])
  const shelfGeometry = useMemo(() => createIslandGeometry([
    [-1.15, -0.2], [-0.78, -0.62], [-0.05, -0.72], [0.48, -0.45], [0.9, -0.06],
    [0.62, 0.42], [0.02, 0.58], [-0.62, 0.43],
  ], 0.18), [])

  useEffect(() => () => {
    islandGeometry.dispose()
    shelfGeometry.dispose()
  }, [islandGeometry, shelfGeometry])

  useFrame(({ clock: r3f }) => {
    if (terrain.current) {
      terrain.current.visible = strength > 0.03 && garden < 0.28
      terrain.current.position.y = -0.15 + Math.min(1, clock.presence.day3 * 1.7) * 0.34
      terrain.current.rotation.y = clock.reducedMotion ? -0.08 : -0.08 + Math.sin(r3f.elapsedTime * 0.12) * 0.018
    }
    const inst = plants.current
    if (!inst) return
    inst.visible = strength > 0.22 && garden < 0.18 && current !== 'day5'
    inst.scale.setScalar(0.85 + clock.presence.day3 * 0.3)
    if (crowns.current) {
      crowns.current.visible = inst.visible
      crowns.current.scale.copy(inst.scale)
    }
    if (fruit.current) {
      fruit.current.visible = inst.visible
      fruit.current.scale.copy(inst.scale)
    }
  })

  // Day 5 gets an unobstructed ocean/sky stage; coastline vegetation would
  // otherwise silhouette across the hero fish and turn the scene into a thicket.
  if (strength <= 0 || current === 'day5') return null

  return (
    <group>
      <OceanSurface strength={strength} y={-0.36} reducedMotion={clock.reducedMotion} quality={clock.quality} scale={1.35} />
      <group ref={terrain} position={[0, 0.05, 0]}>
        <mesh geometry={islandGeometry} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial attach="material-0" color="#607d3c" roughness={0.9} />
          <meshStandardMaterial attach="material-1" color="#60452d" roughness={0.96} />
        </mesh>
        <mesh geometry={shelfGeometry} position={[-0.75, 0.18, -0.15]} rotation={[Math.PI / 2, 0.1, 0]}>
          <meshStandardMaterial attach="material-0" color="#78934b" roughness={0.88} />
          <meshStandardMaterial attach="material-1" color="#725039" roughness={0.98} />
        </mesh>
        <instancedMesh ref={plants} args={[undefined, undefined, count]} position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.018, 0.026, 0.25, 5]} />
          <meshStandardMaterial color="#493922" roughness={0.95} />
        </instancedMesh>
        <instancedMesh ref={crowns} args={[undefined, undefined, count]} position={[0, 0.55, 0]}>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial vertexColors color="#e4eccb" roughness={0.82} emissive="#445b2c" emissiveIntensity={0.25} />
        </instancedMesh>
        <instancedMesh ref={fruit} args={[undefined, undefined, count]} position={[0.05, 0.58, 0.06]}>
          <sphereGeometry args={[0.045, 7, 5]} />
          <meshStandardMaterial color="#d8a743" roughness={0.72} emissive="#7a4818" emissiveIntensity={0.16} />
        </instancedMesh>
      </group>
    </group>
  )
}

function createIslandGeometry(points: readonly (readonly [number, number])[], depth: number): ExtrudeGeometry {
  const shape = new Shape()
  points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.09,
    bevelThickness: 0.08,
    curveSegments: 1,
  })
  geometry.computeVertexNormals()
  return geometry
}
