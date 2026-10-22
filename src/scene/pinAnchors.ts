import { buildings } from '../data/osm'
import type { Landmark } from '../data/types'
import { project } from '../lib/geo'
import { polygonsOf } from './geometry'
import { buildingHeight } from './heights'

function pointInRing([x, y]: [number, number], ring: [number, number][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Height (m) a pin should float above: the modelled landmark's top, or the
 * plain OSM block under the pin, or ground level.
 */
export function pinHeights(list: Landmark[], modelTops: Map<string, number>): Map<string, number> {
  const inside = buildings.features.filter((f) => f.properties.inside)
  const out = new Map<string, number>()
  for (const l of list) {
    const top = modelTops.get(l.id)
    if (top) {
      out.set(l.id, top)
      continue
    }
    const p = project(l.coordinates.lng, l.coordinates.lat)
    let h = 0
    for (const f of inside) {
      if (polygonsOf(f.geometry).some((rings) => pointInRing(p, rings[0]))) {
        h = Math.max(h, buildingHeight(f))
      }
    }
    out.set(l.id, h)
  }
  return out
}
