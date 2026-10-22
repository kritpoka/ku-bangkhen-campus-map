import * as THREE from 'three'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { buildings, roads, sport } from '../data/osm'
import { landmarks } from '../data/landmarks'
import { project, toScene } from '../lib/geo'
import {
  hipRoof,
  loft,
  mergeParts,
  offsetRing,
  openCCW,
  orientedBox,
  polygonsOf,
  prism,
  ribbons,
  stripToPositionNormal,
} from './geometry'
import { buildingHeight, HEIGHT_SCALE, LANDMARK_BOOST } from './heights'
import { landmarkModels, type BuildingStyle, type ModelSpec } from './modelSpecs'

/** Geometry buckets, one merged mesh (and material) each. */
export type Bucket =
  | 'wall' | 'wallPlain' | 'roof' | 'roofDark' | 'trim' | 'plinth' | 'statue' | 'stone'
  | 'track' | 'pitch' | 'pool' | 'lane' | 'pad'

/** Buckets whose silhouettes get crisp outline edges. */
const OUTLINED: Bucket[] = ['wall', 'wallPlain', 'roof', 'roofDark', 'trim', 'stone']

/** Ground highlight margin around each landmark (m). */
const PAD = 7

export interface LandmarkModelsResult {
  buckets: Partial<Record<Bucket, THREE.BufferGeometry>>
  /** Feature-edge lines for the modelled landmarks (one LineSegments). */
  edges: THREE.BufferGeometry
  /** Height of each modelled landmark's tallest point, for pin placement. */
  tops: Map<string, number>
}

const buildingById = new Map(buildings.features.map((f) => [f.properties.id, f]))
const sportById = new Map(sport.features.map((f) => [f.properties.id, f]))

/** Largest outer ring of a (multi)polygon, open and CCW, in projected meters. */
function outerRing(f: Feature<Polygon | MultiPolygon>): [number, number][] {
  const polys = polygonsOf(f.geometry)
  let best = polys[0][0]
  for (const p of polys) if (p[0].length > best.length) best = p[0]
  return openCCW(best)
}

export function buildLandmarkModels(): LandmarkModelsResult {
  const parts: Partial<Record<Bucket, THREE.BufferGeometry[]>> = {}
  const add = (b: Bucket, g: THREE.BufferGeometry) => (parts[b] ??= []).push(g)
  const tops = new Map<string, number>()

  for (const [id, spec] of Object.entries(landmarkModels)) {
    const top = buildModel(id, spec, add)
    if (top > 0) tops.set(id, top)
  }

  const buckets: LandmarkModelsResult['buckets'] = {}
  for (const [k, list] of Object.entries(parts)) buckets[k as Bucket] = mergeParts(list!)
  return { buckets, tops, edges: outlineEdges(buckets) }
}

function buildModel(id: string, spec: ModelSpec, add: (b: Bucket, g: THREE.BufferGeometry) => void): number {
  switch (spec.kind) {
    case 'building': {
      let top = 0
      for (const bid of spec.buildings) {
        const f = buildingById.get(bid)
        if (!f) {
          console.warn(`[models] ${id}: building ${bid} not in OSM data`)
          continue
        }
        const levels = parseFloat(f.properties['building:levels'] ?? '') || spec.levels
        const h = (levels ? (levels * 3.6 + 1) * HEIGHT_SCALE : buildingHeight(f)) * LANDMARK_BOOST
        const ring = outerRing(f)
        add('pad', prism(offsetRing(ring, PAD), [], 0, 0.04))
        top = Math.max(top, building(ring, h, spec.style, add))
      }
      return top
    }
    case 'stadium':
      return stadium(spec.stadium, spec.pitch, add)
    case 'pool':
      return pool(spec.deck, spec.pools, add)
    case 'monument':
      return monument(id, spec.facing, add)
    case 'gate':
      return gate(id, spec.width, add)
  }
}

/** One footprint in a given style. Returns the roof-top height. */
function building(
  ring: [number, number][],
  h: number,
  style: BuildingStyle,
  add: (b: Bucket, g: THREE.BufferGeometry) => void,
): number {
  const box = orientedBox(ring)
  const short = Math.min(box.length, box.width)

  switch (style) {
    case 'modern': {
      add('plinth', prism(offsetRing(ring, 0.35), [], 0, 1.2))
      add('wall', prism(ring, [], 0, h))
      const inner = offsetRing(ring, -0.8)
      add('trim', prism(offsetRing(ring, 0.15), [inner], h - 0.2, h + 1.1))
      add('roof', prism(inner, [], h - 0.2, h + 0.35))
      // A plant-room box on the roof breaks up the silhouette.
      const s = Math.min(9, short * 0.3)
      if (s > 3) add('plinth', orientedBlock(box.center, box.cos, box.sin, s * 1.4, s, h + 0.35, h + 2.6))
      return h + 2.6
    }
    case 'hip':
    case 'hall': {
      add('plinth', prism(offsetRing(ring, 0.35), [], 0, 1.2))
      add(style === 'hip' ? 'wall' : 'wallPlain', prism(ring, [], 0, h))
      const eave = offsetRing(ring, 1.2)
      add('roofDark', prism(eave, [], h, h + 0.5))
      const rise = short * (style === 'hip' ? 0.3 : 0.16)
      add('roof', hipRoof(eave, h + 0.5, rise, short * 0.5))
      return h + 0.5 + rise
    }
    case 'thai': {
      // Two-tier steep roof with a wide lower skirt, after Thai civic halls.
      add('plinth', prism(offsetRing(ring, 1.5), [], 0, 1.6))
      add('wall', prism(ring, [], 0, h))
      const eave = offsetRing(ring, 2.2)
      const shoulder = offsetRing(ring, 0.2)
      add('roofDark', prism(eave, [], h, h + 0.4))
      add('roof', loft(eave, shoulder, h + 0.4, h + 2.6, false))
      const rise = short * 0.3
      add('roof', hipRoof(shoulder, h + 2.6, rise, short * 0.5))
      return h + 2.6 + rise
    }
    case 'pavilion': {
      const ph = Math.max(h, 4.5)
      add('plinth', prism(offsetRing(ring, 0.6), [], 0, 0.8))
      for (const p of ring) add('trim', orientedBlock(p, 1, 0, 0.6, 0.6, 0.8, ph))
      const eave = offsetRing(ring, 1.4)
      add('roofDark', prism(eave, [], ph, ph + 0.4))
      const rise = short * 0.7
      add('roof', hipRoof(eave, ph + 0.4, rise, short))
      return ph + 0.4 + rise
    }
    case 'canopy': {
      // Open-sided food hall: posts and a low hipped roof over a raised floor.
      const ph = 5.5
      add('plinth', prism(ring, [], 0, 0.6))
      for (const p of resample(ring, 9)) add('trim', orientedBlock(p, box.cos, box.sin, 0.5, 0.5, 0.6, ph))
      const eave = offsetRing(ring, 1.6)
      add('roofDark', prism(eave, [], ph, ph + 0.4))
      const rise = short * 0.18
      add('roof', hipRoof(eave, ph + 0.4, rise, short * 0.5))
      return ph + 0.4 + rise
    }
  }
}

function stadium(stadiumId: string, pitchId: string, add: (b: Bucket, g: THREE.BufferGeometry) => void): number {
  const pitchF = sportById.get(pitchId)
  const stadiumF = sportById.get(stadiumId)
  if (!pitchF || !stadiumF) return 0
  const pitch = outerRing(pitchF)
  const box = orientedBox(pitch)
  // Running track: a ring around the pitch.
  const trackOuter = offsetRing(pitch, 9)
  add('pad', prism(offsetRing(pitch, 9 + 26), [], 0, 0.04))
  add('track', prism(trackOuter, [pitch], 0, 0.22))
  add('pitch', prism(pitch, [], 0, 0.25))
  // Lane lines on the track.
  for (const d of [3, 6]) add('lane', ribbons([closed(offsetRing(pitch, d))], 0.25, 0.24))
  // Main grandstand along one long side, a smaller one opposite.
  const halfW = box.width / 2 + 11
  const len = box.length * 0.62
  for (const [side, tiers, canopy] of [[-1, 4, true], [1, 2, false]] as const) {
    for (let t = 0; t < tiers; t++) {
      const depth = 4
      const v = side * (halfW + t * depth)
      const c = box.fromBox([0, v + side * depth / 2])
      add('plinth', orientedBlock(c, box.cos, box.sin, len, depth, 0, 1.6 + t * 1.6))
    }
    if (canopy) {
      const v = side * (halfW + (tiers * 4) / 2)
      add('roof', orientedBlock(box.fromBox([0, v]), box.cos, box.sin, len * 1.04, tiers * 4 + 3, 11, 11.8))
      for (let u = -len / 2; u <= len / 2 + 0.1; u += len / 6) {
        add('trim', orientedBlock(box.fromBox([u, side * (halfW + tiers * 4)]), box.cos, box.sin, 0.6, 0.6, 0, 11))
      }
    }
  }
  return 12
}

function pool(deckId: string, poolIds: string[], add: (b: Bucket, g: THREE.BufferGeometry) => void): number {
  const deck = buildingById.get(deckId)
  if (deck) {
    add('pad', prism(offsetRing(outerRing(deck), PAD), [], 0, 0.04))
    add('plinth', prism(outerRing(deck), [], 0, 0.5))
  }
  for (const pid of poolIds) {
    const f = sportById.get(pid)
    if (!f) continue
    const ring = outerRing(f)
    add('trim', prism(offsetRing(ring, 0.8), [ring], 0.5, 0.75))
    add('pool', prism(ring, [], 0.5, 0.62))
    // Lane ropes along the long axis of the bigger pools.
    const box = orientedBox(ring)
    if (box.length > 20) {
      const lanes: [number, number][][] = []
      for (let v = -box.width / 2 + 2.5; v < box.width / 2 - 1; v += 2.5) {
        lanes.push([box.fromBox([-box.length / 2 + 1, v]), box.fromBox([box.length / 2 - 1, v])])
      }
      add('lane', ribbons(lanes, 0.18, 0.64))
    }
  }
  return 3
}

function monument(id: string, facingId: string, add: (b: Bucket, g: THREE.BufferGeometry) => void): number {
  const l = landmarks.find((x) => x.id === id)
  const behind = buildingById.get(facingId)
  if (!l) return 0
  const [x, z] = toScene(l.coordinates.lng, l.coordinates.lat)
  const c: [number, number] = [x, -z]
  // Line the statues up parallel to the building behind them.
  const axis = behind ? orientedBox(outerRing(behind)) : { cos: 1, sin: 0 }
  // Exaggerated ~1.8x so the group reads at campus scale.
  add('pad', orientedBlock(c, axis.cos, axis.sin, 22 + PAD * 2, 11 + PAD * 2, 0, 0.04))
  add('stone', orientedBlock(c, axis.cos, axis.sin, 22, 11, 0, 0.6))
  for (const u of [-6.5, 0, 6.5]) {
    const p = offsetAlong(c, axis.cos, axis.sin, u)
    add('stone', orientedBlock(p, axis.cos, axis.sin, 3, 3, 0.6, 3.2))
    const body = new THREE.CylinderGeometry(0.75, 0.95, 3.6, 7)
    body.translate(p[0], 3.2 + 1.8, -p[1])
    add('statue', stripToPositionNormal(body))
    const head = new THREE.IcosahedronGeometry(0.62, 0)
    head.translate(p[0], 3.2 + 3.6 + 0.55, -p[1])
    add('statue', stripToPositionNormal(head))
  }
  return 8.5
}

/**
 * A gateway across the road that enters campus at the gate: two pillars, a
 * lintel with a KU-green roof, and a guard booth on each side.
 */
function gate(id: string, width: number, add: (b: Bucket, g: THREE.BufferGeometry) => void): number {
  const l = landmarks.find((x) => x.id === id)
  if (!l) return 0
  const c = project(l.coordinates.lng, l.coordinates.lat)
  const dir = nearestRoadDirection(c)
  // The gate spans across the road: its long axis is perpendicular to it.
  const cos = -dir[1], sin = dir[0]
  const half = width / 2
  const ph = 10 * LANDMARK_BOOST
  add('pad', orientedBlock(c, cos, sin, width + 16 + PAD * 2, 8 + PAD * 2, 0, 0.04))
  for (const side of [-1, 1]) {
    add('trim', orientedBlock(offsetAlong(c, cos, sin, side * half), cos, sin, 3.2, 3.2, 0, ph))
    // Guard booth.
    const booth = offsetAlong(c, cos, sin, side * (half + 6))
    add('wallPlain', orientedBlock(booth, cos, sin, 5, 5, 0, 4.5))
    add('roof', hipRoof(boxRing(booth, cos, sin, 6.6, 6.6), 4.5, 2.2, 3.3))
  }
  add('trim', orientedBlock(c, cos, sin, width + 4, 3.6, ph, ph + 1.8))
  add('roof', hipRoof(boxRing(c, cos, sin, width + 7, 6.5), ph + 1.8, 3.4, 3.25))
  return ph + 5.2
}

/** Unit direction (east, north) of the on-campus road nearest to p (the entrance road, not the street outside). */
function nearestRoadDirection(p: [number, number]): [number, number] {
  let best = Infinity
  let dir: [number, number] = [1, 0]
  for (const r of roads.features) {
    if (r.properties.class === 'path' || !r.properties.inside) continue
    const pts = r.geometry.coordinates.map(([lng, lat]) => project(lng, lat))
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
      const dx = bx - ax, dy = by - ay
      const l2 = dx * dx + dy * dy || 1
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
      const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))
      if (d < best) {
        best = d
        const len = Math.sqrt(l2)
        dir = [dx / len, dy / len]
      }
    }
  }
  return dir
}

/** Crisp feature lines (creases > 25°) for the solid landmark buckets. */
function outlineEdges(buckets: LandmarkModelsResult['buckets']): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const b of OUTLINED) {
    const g = buckets[b]
    if (g) parts.push(new THREE.EdgesGeometry(g, 25))
  }
  return parts.length ? mergeParts(parts) : new THREE.BufferGeometry()
}

// ─── helpers ───────────────────────────────────────────────────────────────

function boxRing(c: [number, number], cos: number, sin: number, length: number, width: number): [number, number][] {
  const hl = length / 2, hw = width / 2
  return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => [c[0] + u * cos - v * sin, c[1] + u * sin + v * cos])
}


/** Axis-aligned-in-its-own-frame box centered on c (projected east/north). */
function orientedBlock(
  c: [number, number],
  cos: number,
  sin: number,
  length: number,
  width: number,
  y0: number,
  y1: number,
): THREE.BufferGeometry {
  const hl = length / 2, hw = width / 2
  const corner = (u: number, v: number): [number, number] => [c[0] + u * cos - v * sin, c[1] + u * sin + v * cos]
  return prism([corner(-hl, -hw), corner(hl, -hw), corner(hl, hw), corner(-hl, hw)], [], y0, y1)
}

function offsetAlong(c: [number, number], cos: number, sin: number, u: number): [number, number] {
  return [c[0] + u * cos, c[1] + u * sin]
}

/** Points along a ring at roughly `step` meter spacing (for posts). */
function resample(ring: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.round(len / step))
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

function closed(ring: [number, number][]): [number, number][] {
  return [...ring, ring[0]]
}
