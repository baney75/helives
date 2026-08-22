import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { CatmullRomCurve3, Color, DoubleSide, type Group, InstancedMesh, TubeGeometry, Vector2, Vector3 } from 'three'
import type { Quality } from '../../lib/budget.ts'
import {
  writeInstanceMatrices,
  writeOrientedInstances,
  type InstancePose,
} from '../../lib/instances.ts'
import { mulberry32 } from '../../lib/rng.ts'
import { EDEN, canopyLeafCount, groveCount, grovePositions, herbCount, herbPositions } from './eden.ts'
import { createLeafGeometry } from './geometry.ts'

const leafTint = new Color()

export function TreeOfLife({
  fall = 0,
  quality = 'high',
  reducedMotion = false,
}: {
  fall?: number
  quality?: Quality
  reducedMotion?: boolean
}) {
  const leaves = useMemo(() => leafField(canopyLeafCount(quality, 'life'), 0.78, 2.05, 41, 1.15), [quality])
  const fruit = useMemo(() => hangingFruit(6, 0.42, 17, 1.85), [])
  const branches = useMemo(() => lifeBranches(), [])
  useEffect(() => () => branches.forEach((geometry) => geometry.dispose()), [branches])

  return (
    <group position={EDEN.life.position}>
      <TreeRoots color={EDEN.life.trunkColor} radius={0.42} />
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.045, 0.09, 1.9, 16]} />
        <meshStandardMaterial color={EDEN.life.trunkColor} roughness={0.9} emissive="#241d0b" emissiveIntensity={0.1} />
      </mesh>
      {branches.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color={EDEN.life.trunkColor} roughness={0.86} />
        </mesh>
      ))}
      <LeafCanopy
        field={leaves}
        color={EDEN.life.canopyColor}
        emissive="#b88a36"
        emit={0.34}
        fall={fall * 0.2}
        quality={quality}
        reducedMotion={reducedMotion}
      />
      <HangingFruit positions={fruit} color={EDEN.life.fruitColor} emissive="#fff4d6" />
      <pointLight position={[0, 1.9, 0.2]} intensity={1.8 * (1 - fall * 0.55)} color="#fff0c2" distance={7} />
    </group>
  )
}

export function TreeOfKnowledge({
  fall = 0,
  quality = 'high',
  fruitTaken = false,
  reducedMotion = false,
}: {
  fall?: number
  quality?: Quality
  fruitTaken?: boolean
  reducedMotion?: boolean
}) {
  const count = canopyLeafCount(quality, 'knowledge')
  const leaves = useMemo(() => leafField(count, 1.15, 1.72, 63, 0.95), [count])
  const inner = useMemo(() => leafField(Math.floor(count * 0.7), 0.72, 1.62, 71, 0.8), [count])
  const branches = useMemo(() => knowledgeBranches(), [])
  useEffect(() => () => branches.forEach((geometry) => geometry.dispose()), [branches])
  const reach = EDEN.knowledge.fruitLocal

  return (
    <group position={EDEN.knowledge.position}>
      <TreeRoots color={EDEN.knowledge.trunkColor} radius={0.48} />
      <mesh position={[0.04, 0.78, 0]} rotation={[0.06, 0.15, 0.05]}>
        <cylinderGeometry args={[0.07, 0.13, 1.55, 16]} />
        <meshStandardMaterial color={EDEN.knowledge.trunkColor} roughness={0.94} />
      </mesh>
      {branches.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color={EDEN.knowledge.trunkColor} roughness={0.92} />
        </mesh>
      ))}
      <LeafCanopy
        field={leaves}
        color={EDEN.knowledge.canopyColor}
        emissive="#2a1810"
        emit={0.08}
        fall={fall}
        quality={quality}
        reducedMotion={reducedMotion}
      />
      <LeafCanopy
        field={inner}
        color="#3a2818"
        emissive="#1a1008"
        emit={0.04}
        fall={fall}
        quality={quality}
        reducedMotion={reducedMotion}
      />
      <group position={reach} visible={!fruitTaken}>
        <AppleFruit scale={1.55} glow={0.45 + fall * 0.35} />
      </group>
    </group>
  )
}

export function AppleFruit({ scale = 1, glow = 0.36 }: { scale?: number; glow?: number }) {
  const profile = useMemo(
    () => [
      new Vector2(0, -0.072),
      new Vector2(0.048, -0.068),
      new Vector2(0.071, -0.036),
      new Vector2(0.074, 0.018),
      new Vector2(0.058, 0.06),
      new Vector2(0.022, 0.07),
      new Vector2(0.009, 0.058),
      new Vector2(0, 0.055),
    ],
    [],
  )
  return (
    <group scale={scale}>
      <mesh scale={[1.06, 1, 0.98]}>
        <latheGeometry args={[profile, 32]} />
        <meshPhysicalMaterial
          color="#8f281e"
          roughness={0.3}
          metalness={0.02}
          clearcoat={0.5}
          clearcoatRoughness={0.38}
          emissive="#3a0c08"
          emissiveIntensity={glow}
        />
      </mesh>
      <mesh position={[0, 0.095, 0]} rotation={[0.12, 0, -0.18]}>
        <cylinderGeometry args={[0.006, 0.009, 0.07, 7]} />
        <meshStandardMaterial color="#3a2818" roughness={0.86} />
      </mesh>
      <mesh position={[0.026, 0.112, 0]} rotation={[0.18, 0.45, 0.58]} scale={[1.35, 0.72, 1]}>
        <sphereGeometry args={[0.028, 10, 6]} />
        <meshStandardMaterial color="#607d3c" roughness={0.8} />
      </mesh>
    </group>
  )
}

function TreeRoots({ color, radius }: { color: string; radius: number }) {
  return (
    <group>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2 + 0.2
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius * 0.46, 0.055, Math.sin(angle) * radius * 0.46]}
            rotation={[0, -angle, Math.PI / 2 - 0.12]}
            scale={[1, 0.72 + (index % 3) * 0.08, 0.8]}
          >
            <coneGeometry args={[0.065, radius, 7]} />
            <meshStandardMaterial color={color} roughness={0.94} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Grove({
  quality,
  fall,
  reducedMotion = false,
}: {
  quality: Quality
  fall: number
  reducedMotion?: boolean
}) {
  const count = groveCount(quality)
  const positions = useMemo(() => grovePositions(count, 27), [count])
  const used = positions.length / 3
  const trunks = useRef<InstancedMesh>(null)
  const shrubs = useRef<InstancedMesh>(null)
  const leafGeo = useMemo(() => createLeafGeometry(), [])
  const field = useMemo(() => shrubLeaves(positions, used), [positions, used])

  useEffect(() => () => leafGeo.dispose(), [leafGeo])
  useLayoutEffect(() => {
    if (trunks.current) writeInstanceMatrices(trunks.current, lift(positions, 0.22), used, () => 0.85)
    if (shrubs.current) {
      writeOrientedInstances(shrubs.current, field.positions, field.count, (i) => field.poseAt(i))
    }
  }, [field, positions, used])

  if (used === 0) return null
  const canopy = new Color('#3d5a30').lerp(new Color('#574023'), fall * 0.8)

  return (
    <BreathingGroup reducedMotion={reducedMotion} quality={quality} amount={0.01}>
      <instancedMesh ref={trunks} args={[undefined, undefined, used]}>
        <cylinderGeometry args={[0.03, 0.045, 0.45, 5]} />
        <meshStandardMaterial color="#4a3420" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={shrubs} args={[leafGeo, undefined, field.count]}>
        <meshStandardMaterial color={canopy} roughness={0.78} side={DoubleSide} />
      </instancedMesh>
    </BreathingGroup>
  )
}

export function Herbs({ quality }: { quality: Quality }) {
  const count = herbCount(quality)
  const positions = useMemo(() => herbPositions(count, 88), [count])
  const used = positions.length / 3
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => createLeafGeometry(), [])
  const kinds = useMemo(() => {
    const rng = mulberry32(88)
    return Float32Array.from({ length: used }, () => rng())
  }, [used])

  useLayoutEffect(() => {
    if (!mesh.current) return
    writeOrientedInstances(mesh.current, positions, used, (i) => ({
      scale: [0.7 + (kinds[i] ?? 0) * 0.8, 0.9 + (kinds[i] ?? 0) * 1.1, 1],
      rotation: [0.15, (kinds[i] ?? 0) * Math.PI * 2, 0.08],
    }))
  }, [kinds, positions, used])

  useEffect(() => () => geometry.dispose(), [geometry])

  if (used === 0) return null

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, used]}>
      <meshStandardMaterial color="#3d5c32" roughness={0.86} side={DoubleSide} />
    </instancedMesh>
  )
}

function LeafCanopy({
  field,
  color,
  emissive,
  emit,
  fall,
  quality,
  reducedMotion,
}: {
  field: LeafField
  color: string
  emissive: string
  emit: number
  fall: number
  quality: Quality
  reducedMotion: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => createLeafGeometry(), [])
  const tint = useMemo(() => new Color(color).lerp(new Color('#5a3a18'), fall * 0.55), [color, fall])

  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    if (!mesh.current) return
    writeOrientedInstances(mesh.current, field.positions, field.count, (i) => field.poseAt(i))
    for (let i = 0; i < field.count; i += 1) {
      leafTint.copy(tint).offsetHSL(0, ((i % 7) - 3) * 0.008, ((i % 5) - 2) * 0.012)
      mesh.current.setColorAt(i, leafTint)
    }
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [field, tint])

  return (
    <BreathingGroup reducedMotion={reducedMotion} quality={quality} amount={0.014}>
      <instancedMesh ref={mesh} args={[geometry, undefined, field.count]}>
        <meshStandardMaterial
          vertexColors
          roughness={0.62}
          metalness={0.04}
          emissive={emissive}
          emissiveIntensity={emit}
          side={DoubleSide}
        />
      </instancedMesh>
    </BreathingGroup>
  )
}

function BreathingGroup({
  reducedMotion,
  quality,
  amount,
  children,
}: {
  reducedMotion: boolean
  quality: Quality
  amount: number
  children: ReactNode
}) {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!root.current || reducedMotion || quality === 'low') return
    const t = clock.elapsedTime
    root.current.rotation.y = Math.sin(t * 0.22) * amount
    root.current.position.y = Math.sin(t * 0.35) * amount
  })
  return <group ref={root}>{children}</group>
}

function HangingFruit({
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
      <sphereGeometry args={[0.038, 10, 10]} />
      <meshStandardMaterial color={color} roughness={0.35} emissive={emissive} emissiveIntensity={0.7} />
    </instancedMesh>
  )
}

type LeafField = {
  positions: Float32Array
  count: number
  poseAt: (index: number) => InstancePose
}

function leafField(count: number, radius: number, y: number, seed: number, stretchY: number): LeafField {
  const rng = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const poses: Array<{ scale: readonly [number, number, number]; rotation: readonly [number, number, number] }> = []
  for (let i = 0; i < count; i += 1) {
    const u = rng()
    const v = rng()
    const theta = u * Math.PI * 2
    const phi = Math.acos(Math.max(-1, Math.min(1, 2 * v - 1))) * 0.42
    const r = radius * (0.62 + rng() * 0.4)
    const i3 = i * 3
    const x = Math.sin(phi) * Math.cos(theta) * r
    const yy = y + Math.abs(Math.cos(phi)) * r * stretchY * 0.32
    const z = Math.sin(phi) * Math.sin(theta) * r
    positions[i3] = x
    positions[i3 + 1] = yy
    positions[i3 + 2] = z
    const s = 0.82 + rng() * 0.48
    poses.push({
      scale: [s, s * 1.12, s],
      rotation: [phi + rng() * 0.28, theta + rng() * 0.4, rng() * Math.PI],
    })
  }
  return { positions, count, poseAt: (i) => poses[i] ?? { scale: [1, 1, 1], rotation: [0, 0, 0] } }
}

function shrubLeaves(treePos: Float32Array, trees: number): LeafField {
  const per = 18
  const count = trees * per
  const positions = new Float32Array(count * 3)
  const poses: InstancePose[] = []
  const rng = mulberry32(19)
  let n = 0
  for (let t = 0; t < trees; t += 1) {
    const tx = treePos[t * 3] ?? 0
    const tz = treePos[t * 3 + 2] ?? 0
    for (let k = 0; k < per; k += 1) {
      const a = rng() * Math.PI * 2
      const r = 0.08 + rng() * 0.16
      const i3 = n * 3
      positions[i3] = tx + Math.cos(a) * r
      positions[i3 + 1] = 0.28 + rng() * 0.28
      positions[i3 + 2] = tz + Math.sin(a) * r
      poses.push({
        scale: [0.58 + rng() * 0.32, 0.58 + rng() * 0.38, 0.58 + rng() * 0.28],
        rotation: [0.4, a, rng()],
      })
      n += 1
    }
  }
  return { positions, count, poseAt: (i) => poses[i] ?? { scale: [1, 1, 1], rotation: [0, 0, 0] } }
}

function hangingFruit(count: number, radius: number, seed: number, y: number): Float32Array {
  const rng = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2
    const r = 0.16 + rng() * radius
    const i3 = i * 3
    pos[i3] = Math.cos(a) * r
    pos[i3 + 1] = y - 0.35 - rng() * 0.25
    pos[i3 + 2] = Math.sin(a) * r
  }
  return pos
}

function lifeBranches(): TubeGeometry[] {
  const tips: Array<[number, number, number]> = [
    [0.38, 2.45, 0.08],
    [-0.36, 2.5, 0.16],
    [0.14, 2.68, -0.28],
    [-0.16, 2.62, -0.22],
    [0.32, 2.2, 0.34],
    [-0.34, 2.18, -0.26],
    [0.04, 2.82, 0.06],
    [0.22, 2.05, -0.32],
  ]
  return tips.map((tip) => tube([[0, 1.25, 0], [tip[0] * 0.35, 1.85, tip[2] * 0.35], tip], 0.022))
}

function knowledgeBranches(): TubeGeometry[] {
  const tips: Array<[number, number, number]> = [
    [-0.75, 1.72, 0.45],
    [0.72, 1.88, 0.18],
    [0.48, 1.95, -0.48],
    [-0.58, 1.7, 0.22],
    [-0.42, 1.92, -0.38],
    [0.12, 2.18, 0.58],
    [-0.22, 2.05, 0.62],
  ]
  return tips.map((tip) => tube([[0.04, 1.12, 0], [tip[0] * 0.4, 1.48, tip[2] * 0.4], tip], 0.03))
}

function tube(points: Array<readonly [number, number, number]>, radius: number): TubeGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)))
  return new TubeGeometry(curve, 12, radius, 6, false)
}

function lift(positions: Float32Array, y: number): Float32Array {
  const next = positions.slice()
  for (let i = 0; i < next.length / 3; i += 1) {
    next[i * 3 + 1] = y
  }
  return next
}
