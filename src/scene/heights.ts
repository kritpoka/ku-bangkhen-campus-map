import type { Feature } from 'geojson'
import type { BuildingProps } from '../data/osm'

const LEVEL_HEIGHT = 3.6

/** Building height in meters from OSM tags, with sensible defaults per type. */
export function buildingHeight(f: Feature): number {
  const p = f.properties as BuildingProps
  const h = parseFloat(p.height ?? '')
  if (Number.isFinite(h) && h > 0) return h
  const levels = parseFloat(p['building:levels'] ?? '')
  if (Number.isFinite(levels) && levels > 0) return levels * LEVEL_HEIGHT + 1
  switch (p.building) {
    case 'roof':
      return 4
    case 'house':
    case 'residential':
    case 'detached':
      return 7
    case 'shed':
    case 'kiosk':
    case 'garage':
      return 3.5
    case 'dormitory':
    case 'apartments':
      return 18
    default:
      // Stable pseudo-random variation so unlabelled blocks don't look uniform.
      return 9 + (hash(p.id) % 5)
  }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
