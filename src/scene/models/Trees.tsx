import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  TubeGeometry,
  Vector3,
} from 'three'
import { writeInstanceMatrices } from '../../lib/instances.ts'
import { fillSphere, mulberry32 } from '../../lib/rng.ts'
import { EDEN, groveCount, grovePositions, herbCount, herbPositions } from './eden.ts'
import type { Quality } from '../../lib/budget.ts'

const leafTint = new Color()

export function TreeOfLife({ fall = 0 }: { fall?: number }) {
  const fruitCount = 7
  const leafCount = 22
  const leaves = useMemo(() => canopyCloud(leafCount, 0.62, 41, 2.15), [])
  const fruit = useMemo(() => fruitCloud(fruitCount, 0.48, 17, 2.05), [])
  const branches = useMemo(() => lifeBranches(), [])
  useEffect(() => () => branches.forEach((geometry) => geometry.dispose()), [branches])

  return (
    <group position={EDEN.life.position}>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.055, 0.1, 1.7, 8]} />
        <meshStandardMaterial color={EDEN.life.trunkColor} roughness={0.92} />
      </mesh>
      {branches.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color={EDEN.life.trunkColor} roughness={0.9} />
        </mesh>
      ))}
      <LeafCloud positions={leaves} color={EDEN.life.canopyColor} fall={fall * 0.25} />
      <FruitCloud positions={fruit} color={EDEN.life.fruitColor} emissive="#fff4d6" />
      <pointLight position={[0, 2.1, 0]} intensity={1.1} color="#fff4d6" distance={6} />
    </group>
  )
}

export function TreeOfKnowledge({ fall = 0 }: { fall?: number }) {
  const leafCount = 26
  const fruitCount = 8
  const leaves = useMemo(() => canopyCloud(leafCount, 0.85, 63, 1.72), [])
  const fruit = useMemo(() => knowledgeFruitCloud(fruitCount), [])
  const branches = useMemo(() => knowledgeBranches(), [])
  useEffect(() => () => branches.forEach((geometry) => geometry.dispose()), [branches])
  const reach = EDEN.knowledge.fruitLocal

  return (
    <group position={EDEN.knowledge.position}>
      <mesh position={[0.05, 0.72, 0]} rotation={[0.08, 0.2, 0.06]}>
        <cylinderGeometry args={[0.07, 0.13, 1.45, 8]} />
        <meshStandardMaterial color={EDEN.knowledge.trunkColor} roughness={0.94} />
      </mesh>
      {branches.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color={EDEN.knowledge.trunkColor} roughness={0.92} />
        </mesh>
      ))}
      <LeafCloud positions={leaves} color={EDEN.knowledge.canopyColor} fall={fall} />
      <FruitCloud positions={fruit} color={EDEN.knowledge.fruitColor} emissive="#5a1814" />
      <mesh position={reach}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial
          color={EDEN.knowledge.fruitColor}
          roughness={0.35}
          emissive="#4a120e"
          emissiveIntensity={0.35 + fall * 0.4}
        />
      </mesh>
      <mesh position={[reach[0], reach[1] + 0.08, reach[2]]}>
        <cylinderGeometry args={[0.008, 0.01, 0.07, 5]} />
        <meshStandardMaterial color="#3a2818" roughness={0.8} />
      </mesh>
    </group>
  )
}

export function Grove({ quality, fall }: { quality: Quality; fall: number }) {
  const count = groveCount(quality)
  const positions = useMemo(() => grovePositions(count, 27), [count])
  const kinds = useMemo(() => {
    const rng = mulberry32(27)
    return Float32Array.from({ length: count }, () => rng())
  }, [count])
  const trunks = useRef<InstancedMesh>(null)
  const mid = useRef<InstancedMesh>(null)
  const top = useRef<InstancedMesh>(null)
  const used = positions.length / 3

  useLayoutEffect(() => {
    if (trunks.current) {
      writeInstanceMatrices(trunks.current, lift(positions, 0.42), used, (i) => 0.7 + (kinds[i] ?? 0) * 0.4)
    }
    if (mid.current) {
      writeInstanceMatrices(mid.current, lift(positions, 0.95), used, (i) => 0.55 + (kinds[i] ?? 0) * 0.3)
    }
    if (top.current) {
      writeInstanceMatrices(top.current, lift(positions, 1.28), used, (i) => 0.38 + (kinds[i] ?? 0) * 0.22)
    }
  }, [kinds, positions, used])

  if (used === 0) return null
  const canopy = fall > 0.4 ? '#5a4024' : '#4f6a38'

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, used]}>
        <cylinderGeometry args={[0.04, 0.06, 0.9, 5]} />
        <meshStandardMaterial color="#4a3420" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={mid} args={[undefined, undefined, used]}>
        <coneGeometry args={[0.28, 0.55, 6]} />
        <meshStandardMaterial color={canopy} roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={top} args={[undefined, undefined, used]}>
        <coneGeometry args={[0.18, 0.4, 6]} />
        <meshStandardMaterial color={canopy} roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

export function Herbs({ quality }: { quality: Quality }) {
  const count = herbCount(quality)
  const positions = useMemo(() => herbPositions(count, 88), [count])
  const used = positions.length / 3
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (mesh.current) writeInstanceMatrices(mesh.current, positions, used, () => 1)
  }, [positions, used])

  if (used === 0) return null

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, used]}>
      <coneGeometry args={[0.06, 0.16, 5]} />
      <meshStandardMaterial color="#3d5c32" roughness={0.88} />
    </instancedMesh>
  )
}

function LeafCloud({
  positions,
  color,
  fall,
}: {
  positions: Float32Array
  color: string
  fall: number
}) {
  const mesh = useRef<InstancedMesh>(null)
  const count = positions.length / 3
  const tint = useMemo(() => new Color(color).lerp(new Color('#5a3a18'), fall * 0.55), [color, fall])

  useLayoutEffect(() => {
    if (!mesh.current) return
    writeInstanceMatrices(mesh.current, positions, count, (i) => 0.72 + (i % 5) * 0.08)
    for (let i = 0; i < count; i += 1) {
      leafTint.copy(tint)
      mesh.current.setColorAt(i, leafTint)
    }
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [count, positions, tint])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.22, 8, 8]} />
      <meshStandardMaterial vertexColors roughness={0.78} />
    </instancedMesh>
  )
}

function FruitCloud({
  positions,
  color,
  emissive,
}: {
  positions: Float32Array
  color: string
  emissive: string
}) {
  const mesh = useRef<InstancedMesh>(null)
  const count = positions.length / 3

  useLayoutEffect(() => {
    if (mesh.current) writeInstanceMatrices(mesh.current, positions, count, () => 1)
  }, [count, positions])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshStandardMaterial color={color} roughness={0.4} emissive={emissive} emissiveIntensity={0.25} />
    </instancedMesh>
  )
}

function canopyCloud(count: number, radius: number, seed: number, y: number): Float32Array {
  const pos = fillSphere(count, radius, seed)
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    pos[i3 + 1] = Math.abs(pos[i3 + 1] ?? 0) * 0.55 + y
  }
  return pos
}

function fruitCloud(count: number, radius: number, seed: number, y: number): Float32Array {
  const rng = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2
    const r = 0.18 + rng() * radius
    const i3 = i * 3
    pos[i3] = Math.cos(a) * r
    pos[i3 + 1] = y - 0.15 + rng() * 0.45
    pos[i3 + 2] = Math.sin(a) * r
  }
  return pos
}

function knowledgeFruitCloud(count: number): Float32Array {
  const pos = fruitCloud(count, 0.7, 91, 1.7)
  const reach = EDEN.knowledge.fruitLocal
  pos[0] = reach[0]
  pos[1] = reach[1] + 0.28
  pos[2] = reach[2] - 0.12
  return pos
}

function lifeBranches(): TubeGeometry[] {
  const tips: Array<[number, number, number]> = [
    [0.35, 2.35, 0.05],
    [-0.32, 2.4, 0.18],
    [0.12, 2.55, -0.3],
    [-0.18, 2.5, -0.22],
    [0.28, 2.15, 0.32],
    [-0.3, 2.1, -0.28],
    [0.05, 2.7, 0.08],
  ]
  return tips.map((tip) => tube([[0, 1.15, 0], [tip[0] * 0.4, 1.7, tip[2] * 0.4], tip], 0.028))
}

function knowledgeBranches(): TubeGeometry[] {
  const tips: Array<[number, number, number]> = [
    [0.85, 1.85, 0.15],
    [0.55, 1.95, -0.45],
    [-0.55, 1.75, 0.35],
    [-0.4, 1.88, -0.4],
    [0.15, 2.15, 0.55],
  ]
  return tips.map((tip) => tube([[0.04, 1.05, 0], [tip[0] * 0.45, 1.45, tip[2] * 0.45], tip], 0.032))
}

function tube(points: Array<readonly [number, number, number]>, radius: number): TubeGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)))
  return new TubeGeometry(curve, 10, radius, 5, false)
}

function lift(positions: Float32Array, y: number): Float32Array {
  const next = positions.slice()
  for (let i = 0; i < next.length / 3; i += 1) {
    next[i * 3 + 1] = y
  }
  return next
}
