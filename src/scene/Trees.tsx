import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import treesJson from '../data/osm/trees.json'
import { toScene } from '../lib/geo'
import { stripToPositionNormal } from './geometry'
import { materials } from './materials'
import { palette } from './palette'

/** Tree shapes, indexed by the `kind` field written by derive-osm.ts. */
const KINDS = [
  // Round broadleaf: low-poly ball canopy.
  { canopy: () => new THREE.IcosahedronGeometry(1, 0), scale: [4.4, 3.7, 4.4], y: 5.6, trunk: 3.0 },
  // Tall slim tree.
  { canopy: () => new THREE.IcosahedronGeometry(1, 0), scale: [3.0, 5.4, 3.0], y: 7.2, trunk: 3.6 },
  // Conifer-like cone.
  { canopy: () => new THREE.ConeGeometry(1, 1, 6), scale: [3.2, 7.5, 3.2], y: 6.2, trunk: 2.6 },
] as const

interface TreeInstance {
  x: number
  z: number
  s: number
  rot: number
}

/**
 * All campus trees in four draw calls: one instanced canopy per kind and one
 * shared instanced trunk. Matrices are written once; nothing runs per frame.
 */
export function Trees({ shadows }: { shadows: boolean }) {
  const { byKind, all } = useMemo(() => {
    const d = treesJson.data
    const byKind: TreeInstance[][] = KINDS.map(() => [])
    const all: (TreeInstance & { kind: number })[] = []
    for (let i = 0; i < d.length; i += treesJson.stride) {
      const [x, z] = toScene(d[i], d[i + 1])
      const kind = d[i + 3]
      // Stable per-tree rotation from its position, so canopies don't look stamped.
      const t = { x, z, s: d[i + 2] / 100, rot: ((x * 12.9898 + z * 78.233) % 6.283) }
      byKind[kind]?.push(t)
      all.push({ ...t, kind })
    }
    return { byKind, all }
  }, [])

  const geos = useMemo(
    () => ({
      canopies: KINDS.map((k) => stripToPositionNormal(k.canopy())),
      trunk: stripToPositionNormal(new THREE.CylinderGeometry(0.28, 0.4, 1, 5).translate(0, 0.5, 0)),
    }),
    [],
  )

  return (
    <group>
      {KINDS.map((kind, k) => (
        <Canopies key={k} geometry={geos.canopies[k]} trees={byKind[k]} kind={kind} shadows={shadows} />
      ))}
      <Trunks geometry={geos.trunk} trees={all} />
    </group>
  )
}

function Canopies({
  geometry,
  trees,
  kind,
  shadows,
}: {
  geometry: THREE.BufferGeometry
  trees: TreeInstance[]
  kind: (typeof KINDS)[number]
  shadows: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  // Created up front so the shader compiles with instance colors on first render.
  const colors = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(trees.length * 3), 3), [trees])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3()
    const color = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot)
      p.set(t.x, kind.y * t.s, t.z)
      sc.set(kind.scale[0] * t.s, kind.scale[1] * t.s, kind.scale[2] * t.s)
      mesh.setMatrixAt(i, m.compose(p, q, sc))
      color.set(palette.canopy[Math.abs(Math.floor(t.rot * 1000)) % palette.canopy.length])
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees, kind])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, materials.canopy, trees.length]}
      instanceColor={colors}
      castShadow={shadows}
      receiveShadow
    />
  )
}

function Trunks({ geometry, trees }: { geometry: THREE.BufferGeometry; trees: (TreeInstance & { kind: number })[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3()
    trees.forEach((t, i) => {
      const h = KINDS[t.kind]?.trunk ?? 2.5
      p.set(t.x, 0, t.z)
      sc.set(t.s, h * t.s, t.s)
      mesh.setMatrixAt(i, m.compose(p, q, sc))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees])

  return <instancedMesh ref={ref} args={[geometry, materials.trunk, trees.length]} />
}
