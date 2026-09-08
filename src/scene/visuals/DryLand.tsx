import { useStoryFrame } from '../StoryTime.tsx'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  type InstancedMesh,
} from 'three'
import { BUDGET } from '../../lib/budget.ts'
import { writeOrientedInstances } from '../../lib/instances.ts'
import { mulberry32 } from '../../lib/rng.ts'
import { createPlantGeometry, createReedTuftGeometry } from '../models/geometry.ts'
import type { SceneClock } from '../types.ts'
import { findSceneAt } from '../../genesis/scenes.ts'
import { OceanSurface } from './OceanSurface.tsx'

const instanceColor = new Color()
const sand = new Color('#8c7447')
const shore = new Color('#647546')
const meadow = new Color('#476638')
const highland = new Color('#75814a')

function terrainHeight(x: number, z: number): number {
  const ellipse = Math.sqrt((x / 3.1) ** 2 + (z / 2.18) ** 2)
  const coastNoise = Math.sin(x * 1.72 + z * 0.54) * 0.07
    + Math.sin(z * 2.35 - x * 0.77) * 0.045
    + Math.sin((x + z) * 4.1) * 0.022
  const coast = Math.max(0, Math.min(1, (1.05 + coastNoise - ellipse) / 0.43))
  const easedCoast = coast * coast * (3 - 2 * coast)
  const westRidge = Math.exp(-((x + 0.72) ** 2) / 1.3 - ((z - 0.2) ** 2) / 0.68) * 0.32
  const easternRise = Math.exp(-((x - 1.28) ** 2) / 0.52 - ((z + 0.45) ** 2) / 0.8) * 0.2
  const oldChannel = Math.exp(-((z + 0.15 + Math.sin(x * 0.9) * 0.22) ** 2) / 0.045) * 0.16
  const broadRoll = Math.sin(x * 1.18 + z * 0.42) * 0.055 + Math.sin(z * 1.72 - x * 0.25) * 0.038
  const groundTexture = (Math.sin(x * 2.4) * Math.sin(z * 2.05) + Math.sin(x * 5.1 + z)) * 0.024
  const islandLift = Math.max(0, 1 - ellipse) * 0.24
  return -0.51 + easedCoast * (0.65 + westRidge + easternRise - oldChannel + broadRoll + groundTexture + islandLift)
}

export function createCoastalTerrainGeometry(segments: number): BufferGeometry {
  const rings = Math.max(12, Math.floor(segments / 3))
  const slices = segments * 2
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const addVertex = (x: number, y: number, z: number) => {
    positions.push(x, y, z)
    const t = Math.max(0, Math.min(1, (y + 0.38) / 0.72))
    const ground = y < -0.18
      ? sand.clone().lerp(shore, t * 1.4)
      : meadow.clone().lerp(highland, Math.max(0, (t - 0.45) * 1.45))
    colors.push(ground.r, ground.g, ground.b)
  }

  addVertex(0, terrainHeight(0, 0), 0)
  for (let ring = 1; ring <= rings; ring += 1) {
    const radial = ring / rings
    const edgeBlend = Math.max(0, Math.min(1, (radial - 0.68) / 0.32))
    const smoothEdge = edgeBlend * edgeBlend * (3 - 2 * edgeBlend)
    for (let slice = 0; slice < slices; slice += 1) {
      const angle = (slice / slices) * Math.PI * 2
      const contour = 1
        + Math.sin(angle * 3 + 0.7) * 0.065
        + Math.sin(angle * 7 - 1.2) * 0.035
        + Math.sin(angle * 11 + 0.3) * 0.018
      const x = Math.cos(angle) * 3.18 * contour * radial
      const z = Math.sin(angle) * 2.26 * contour * radial
      const interior = terrainHeight(x, z)
      const y = interior + (-0.52 - interior) * smoothEdge
      addVertex(x, y, z)
    }
  }

  for (let slice = 0; slice < slices; slice += 1) {
    indices.push(0, 1 + ((slice + 1) % slices), 1 + slice)
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const innerStart = 1 + (ring - 1) * slices
    const outerStart = 1 + ring * slices
    for (let slice = 0; slice < slices; slice += 1) {
      const next = (slice + 1) % slices
      const a = innerStart + slice
      const b = innerStart + next
      const c = outerStart + slice
      const d = outerStart + next
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

type Patch = readonly [x: number, z: number, spreadX: number, spreadZ: number]

function plantedPositions(count: number, seed: number, patches: readonly Patch[], shoreline = false): Float32Array {
  const rng = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  let placed = 0
  let attempts = 0
  while (placed < count && attempts < count * 40) {
    attempts += 1
    const patch = patches[Math.floor(rng() * patches.length)] ?? patches[0]
    if (!patch) break
    const radius = Math.sqrt(rng())
    const angle = rng() * Math.PI * 2
    const x = patch[0] + Math.cos(angle) * radius * patch[2]
    const z = patch[1] + Math.sin(angle) * radius * patch[3]
    const height = terrainHeight(x, z)
    if (height < (shoreline ? -0.27 : -0.08)) continue
    const i3 = placed * 3
    positions[i3] = x
    positions[i3 + 1] = height + 0.012
    positions[i3 + 2] = z
    placed += 1
  }
  return positions
}

export function DryLand({ clock }: { clock: SceneClock }) {
  const terrain = useRef<Group>(null)
  const vegetation = useRef<Group>(null)
  const reeds = useRef<InstancedMesh>(null)
  const flowers = useRef<InstancedMesh>(null)
  const shrubs = useRef<InstancedMesh>(null)
  const fruit = useRef<InstancedMesh>(null)
  const garden = Math.max(clock.presence.garden, clock.presence.fall)
  const current = findSceneAt(clock.progress).id
  const strength =
    (current === 'day3' ? clock.presence.day3 : current === 'day4' ? 0.28 : current === 'day7' ? 0.08 : 0) *
    (1 - garden)
  const baseCount = Math.max(16, Math.round(Math.sqrt(BUDGET[clock.quality].earth) * 1.28))
  const reedCount = Math.max(8, Math.round(baseCount * 0.48))
  const flowerCount = baseCount
  const shrubCount = Math.max(6, Math.round(baseCount * 0.32))
  const plantKinds = useMemo(() => {
    const rng = mulberry32(51)
    return Float32Array.from({ length: baseCount }, () => rng())
  }, [baseCount])
  const reedPositions = useMemo(() => plantedPositions(reedCount, 19, [
    [-2.25, -0.62, 0.52, 0.35],
    [1.98, 0.72, 0.48, 0.42],
    [0.45, -1.46, 0.78, 0.24],
  ], true), [reedCount])
  const flowerPositions = useMemo(() => plantedPositions(flowerCount, 37, [
    [-1.18, 0.25, 0.72, 0.52],
    [0.25, 0.98, 0.62, 0.38],
    [1.28, -0.42, 0.62, 0.46],
  ]), [flowerCount])
  const shrubPositions = useMemo(() => plantedPositions(shrubCount, 73, [
    [-0.7, 0.65, 0.48, 0.36],
    [1.36, 0.12, 0.4, 0.46],
  ]), [shrubCount])

  useLayoutEffect(() => {
    const reedMesh = reeds.current
    if (reedMesh) {
      writeOrientedInstances(reedMesh, reedPositions, reedCount, (index) => {
        const variation = (index * 0.6180339) % 1
        return {
          scale: [0.32 + variation * 0.16, 0.48 + variation * 0.34, 0.32 + variation * 0.16],
          rotation: [0, variation * Math.PI * 2, (variation - 0.5) * 0.1],
        }
      })
      for (let index = 0; index < reedCount; index += 1) {
        instanceColor.set(index % 3 === 0 ? '#74844c' : '#435b39')
        reedMesh.setColorAt(index, instanceColor)
      }
      if (reedMesh.instanceColor) reedMesh.instanceColor.needsUpdate = true
    }

    const flowerMesh = flowers.current
    if (flowerMesh) {
      writeOrientedInstances(flowerMesh, flowerPositions, flowerCount, (index) => {
        const variation = plantKinds[index] ?? 0.5
        const scale = 0.42 + variation * 0.46
        return {
          scale: [scale * 0.88, scale, scale * 0.88],
          rotation: [0.08, variation * Math.PI * 2, (variation - 0.5) * 0.12],
        }
      })
      for (let index = 0; index < flowerCount; index += 1) {
        instanceColor.set((plantKinds[index] ?? 0) > 0.68 ? '#adbe72' : '#6f914d')
        flowerMesh.setColorAt(index, instanceColor)
      }
      if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true
    }

    const shrubMesh = shrubs.current
    if (shrubMesh) {
      writeOrientedInstances(shrubMesh, shrubPositions, shrubCount, (index) => {
        const variation = (index * 0.4142135) % 1
        const scale = 0.7 + variation * 0.5
        return {
          scale: [scale * 1.48, scale * 0.72, scale * 1.35],
          rotation: [0.22, variation * Math.PI * 2, 0.08],
        }
      })
      for (let index = 0; index < shrubCount; index += 1) {
        instanceColor.set(index % 2 === 0 ? '#5e7a43' : '#8b9c57')
        shrubMesh.setColorAt(index, instanceColor)
      }
      if (shrubMesh.instanceColor) shrubMesh.instanceColor.needsUpdate = true
    }

    const fruitMesh = fruit.current
    if (fruitMesh) {
      writeOrientedInstances(fruitMesh, shrubPositions, shrubCount, (index) => {
        const visible = index % 3 === 0 ? 1 : 0
        return { scale: [visible, visible, visible], rotation: [0, 0, 0] }
      })
    }
  }, [flowerCount, flowerPositions, plantKinds, reedCount, reedPositions, shrubCount, shrubPositions])

  const plantGeometry = useMemo(() => createPlantGeometry(), [])
  const reedGeometry = useMemo(() => createReedTuftGeometry(), [])
  const terrainGeometry = useMemo(
    () => createCoastalTerrainGeometry(clock.quality === 'low' ? 32 : clock.quality === 'medium' ? 52 : 72),
    [clock.quality],
  )

  useEffect(() => () => {
    terrainGeometry.dispose()
    plantGeometry.dispose()
    reedGeometry.dispose()
  }, [plantGeometry, reedGeometry, terrainGeometry])

  useStoryFrame((seconds) => {
    if (terrain.current) {
      terrain.current.visible = strength > 0.03 && garden < 0.28
      terrain.current.position.y = -0.36 + Math.min(1, clock.presence.day3 * 1.7) * 0.2
      terrain.current.rotation.y = clock.reducedMotion ? -0.1 : -0.1 + Math.sin(seconds * 0.12) * 0.012
    }
    if (vegetation.current) {
      vegetation.current.visible = strength > 0.2 && garden < 0.18
    }
  })

  if (strength <= 0) return null

  return (
    <group>
      <OceanSurface strength={strength} y={-0.36} reducedMotion={clock.reducedMotion} quality={clock.quality} scale={1.35} />
      <group ref={terrain} position={[0, -0.16, 0]}>
        <mesh geometry={terrainGeometry} receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.94} metalness={0} />
        </mesh>
        <group ref={vegetation}>
          <instancedMesh ref={reeds} args={[reedGeometry, undefined, reedCount]}>
            <meshStandardMaterial
              vertexColors
              color="#dbe2bd"
              emissive="#354624"
              emissiveIntensity={0.22}
              roughness={0.92}
              side={DoubleSide}
            />
          </instancedMesh>
          <instancedMesh ref={flowers} args={[plantGeometry, undefined, flowerCount]}>
            <meshStandardMaterial
              vertexColors
              color="#e0e8c6"
              emissive="#314523"
              emissiveIntensity={0.16}
              roughness={0.86}
              side={DoubleSide}
            />
          </instancedMesh>
          <instancedMesh ref={shrubs} args={[plantGeometry, undefined, shrubCount]}>
            <meshStandardMaterial vertexColors color="#d7e1bc" roughness={0.9} side={DoubleSide} />
          </instancedMesh>
          <instancedMesh ref={fruit} args={[undefined, undefined, shrubCount]} position={[0.04, 0.1, 0.03]}>
            <sphereGeometry args={[0.035, 7, 5]} />
            <meshStandardMaterial color="#d4a447" roughness={0.74} emissive="#6d4017" emissiveIntensity={0.12} />
          </instancedMesh>
        </group>
      </group>
    </group>
  )
}
