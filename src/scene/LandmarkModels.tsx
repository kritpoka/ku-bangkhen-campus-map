import type * as THREE from 'three'
import { useMemo } from 'react'
import { materials } from './materials'
import { buildLandmarkModels, type Bucket, type LandmarkModelsResult } from './models'

/** Shadow-casting buckets; flat details (lanes, water) don't need to. */
const CASTS: Partial<Record<Bucket, boolean>> = {
  wall: true, wallPlain: true, roof: true, roofDark: true, trim: true, plinth: true, statue: true, stone: true,
}

/** Model buckets that share a color with a flat ground layer but must write depth. */
const MATERIAL: Partial<Record<Bucket, THREE.Material>> = {
  track: materials.trackSolid,
  pitch: materials.pitchSolid,
  pool: materials.poolSolid,
}

/** All detailed landmark buildings, merged into one mesh per material. */
export function LandmarkModels({ models }: { models: LandmarkModelsResult }) {
  const entries = useMemo(() => Object.entries(models.buckets) as [Bucket, THREE.BufferGeometry][], [models])
  return (
    <group>
      {entries.map(([bucket, geometry]) => (
        <mesh
          key={bucket}
          geometry={geometry}
          material={MATERIAL[bucket] ?? materials[bucket]}
          castShadow={!!CASTS[bucket]}
          receiveShadow
        />
      ))}
    </group>
  )
}

export { buildLandmarkModels }
