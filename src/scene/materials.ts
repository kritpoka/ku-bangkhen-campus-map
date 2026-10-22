import * as THREE from 'three'
import { withCampusFade, windowBands } from './campusFade'
import { LANDMARK_FLOOR } from './heights'
import { palette } from './palette'

/** Lambert keeps the low-poly look cheap on phones. Every material fades outside campus. */
function lambert(color: THREE.ColorRepresentation, opts: THREE.MeshLambertMaterialParameters = {}) {
  return withCampusFade(new THREE.MeshLambertMaterial({ color, ...opts }))
}

/**
 * Ground-level layers are drawn without depth writes in a fixed renderOrder
 * (see BaseLayers), so stacked flat polygons never z-fight at overview zoom.
 */
const flat = (color: THREE.ColorRepresentation) => lambert(color, { depthWrite: false })

/** Shared scene materials, created once. */
export const materials = {
  groundOutside: flat(palette.groundOutside),
  campusPlate: flat(palette.campusPlate),
  lawn: flat(palette.lawn),
  park: flat(palette.park),
  pitch: flat(palette.pitch),
  track: flat(palette.track),
  water: flat(palette.water),
  pool: flat(palette.pool),
  road: flat(palette.road),
  roadOutside: flat(palette.roadOutside),
  path: flat(palette.path),
  dash: flat(palette.dash),
  // Lane lines sit on top of modelled (depth-writing) surfaces.
  lane: lambert(palette.trim, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  // Plain blocks get per-vertex colors (lighter roofs) from the geometry. The
  // emissive lift keeps their shaded walls from going dark, so they recede and
  // the detailed landmarks carry the contrast.
  building: lambert('#ffffff', { vertexColors: true, emissive: '#5a5c58' }),
  landmarkPad: flat(palette.landmarkPad),
  outline: new THREE.LineBasicMaterial({ color: palette.outline, transparent: true, opacity: 0.55 }),

  // Detailed landmarks (these write depth, unlike the flat ground layers)
  trackSolid: lambert(palette.track),
  pitchSolid: lambert(palette.pitch),
  poolSolid: lambert(palette.pool),
  wall: withCampusFade(
    new THREE.MeshLambertMaterial({ color: palette.wall }),
    windowBands(palette.glass, LANDMARK_FLOOR),
    '-windows',
  ),
  wallPlain: lambert(palette.wall),
  roof: lambert(palette.roof, { flatShading: true }),
  roofDark: lambert(palette.roofDark),
  trim: lambert(palette.trim),
  plinth: lambert(palette.plinth),
  statue: lambert(palette.statue, { flatShading: true }),
  stone: lambert(palette.stone),

  // Trees (instance colors tint the canopy)
  canopy: lambert('#ffffff', { flatShading: true }),
  trunk: lambert(palette.trunk),
} as const

/** Paint roofs and walls of a merged building geometry with different colors. */
export function colorByFacing(
  g: THREE.BufferGeometry,
  wall: THREE.ColorRepresentation,
  roof: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const normal = g.getAttribute('normal')
  if (!normal) return g
  const w = new THREE.Color(wall), r = new THREE.Color(roof)
  const colors = new Float32Array(normal.count * 3)
  for (let i = 0; i < normal.count; i++) {
    const c = normal.getY(i) > 0.5 ? r : w
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}
