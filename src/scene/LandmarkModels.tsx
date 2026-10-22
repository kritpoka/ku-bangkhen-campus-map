import type * as THREE from 'three'
import { useMemo } from 'react'
import { materials } from './materials'
import { buildLandmarkModels, type Bucket, type LandmarkModelsResult } from './models'

/** Shadow-casting buckets; flat details (lanes, water) don't need to. */
const CASTS: Partial<Record<Bucket, boolean>> = {
  wall: true, wallPlain: true, roof: true, roofDark: true, trim: true, plinth: true, statue: true, stone: true,
}

/** Material per bucket (solid variants for surfaces that sit on top of other geometry). */
const MATERIAL: Record<Bucket, THREE.Material> = {
  wall: materials.wall,
  wallPlain: materials.wallPlain,
  roof: materials.roof,
  roofDark: materials.roofDark,
  trim: materials.trim,
  plinth: materials.plinth,
  statue: materials.statue,
  stone: materials.stone,
  lane: materials.lane,
  track: materials.trackSolid,
  pitch: materials.pitchSolid,
  pool: materials.poolSolid,
  pad: materials.landmarkPad,
}

/** Pads are a ground layer: drawn depth-free between the lawns and the roads (see BaseLayers). */
export const PAD_RENDER_ORDER = -96.5

/** All detailed landmark buildings, merged into one mesh per material. */
export function LandmarkModels({ models }: { models: LandmarkModelsResult }) {
  const entries = useMemo(() => Object.entries(models.buckets) as [Bucket, THREE.BufferGeometry][], [models])
  return (
    <group>
      {entries.map(([bucket, geometry]) => (
        <mesh
          key={bucket}
          geometry={geometry}
          material={MATERIAL[bucket]}
          renderOrder={bucket === 'pad' ? PAD_RENDER_ORDER : 0}
          castShadow={!!CASTS[bucket]}
          receiveShadow
        />
      ))}
      <lineSegments geometry={models.edges} material={materials.outline} />
    </group>
  )
}

export { buildLandmarkModels }
