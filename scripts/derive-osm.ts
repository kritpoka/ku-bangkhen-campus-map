/**
 * Derive render-only data from the saved OSM layers in src/data/osm/:
 *
 * - trees.json      Real OSM trees plus procedurally scattered decorative trees
 *                   (open campus ground, parks and road verges). Decorative only:
 *                   these are NOT surveyed tree positions.
 * - fade-mask.json  A coarse grid of distance-outside-campus, used by the scene
 *                   shader to fade the surroundings toward the background.
 *
 * Runs automatically at the end of `npm run fetch-osm`, or on its own (no
 * network needed) with `npm run derive-osm`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon, Position } from 'geojson'

const OSM_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'osm')

const TREE_SPACING_M = 13
const FADE_GRID = 160
/** Distance outside the campus over which the surroundings fade out (m). */
const FADE_DISTANCE_M = 260

type Area = Feature<Polygon | MultiPolygon, { inside: boolean; [k: string]: unknown }>

/** Deterministic PRNG so regenerated trees don't churn the diff. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Local equirectangular meters, only for distance tests inside this script. */
function makeProjector(lat0: number, lng0: number) {
  const k = (Math.PI / 180) * 6378137
  const c = Math.cos((lat0 * Math.PI) / 180)
  return {
    to: ([lng, lat]: Position): [number, number] => [(lng - lng0) * k * c, (lat - lat0) * k],
    from: ([x, y]: [number, number]): [number, number] => [x / (k * c) + lng0, y / k + lat0],
  }
}

/** Uniform-grid spatial index of polygons (projected) for fast point tests. */
class PolygonIndex {
  private cells = new Map<string, [number, number][][][]>()
  constructor(polys: [number, number][][][], private size = 40) {
    for (const rings of polys) {
      const [minX, minY, maxX, maxY] = ringBBox(rings[0])
      for (let gx = Math.floor(minX / size); gx <= Math.floor(maxX / size); gx++)
        for (let gy = Math.floor(minY / size); gy <= Math.floor(maxY / size); gy++) {
          const key = `${gx},${gy}`
          const list = this.cells.get(key) ?? []
          list.push(rings)
          this.cells.set(key, list)
        }
    }
  }
  /** True when p is inside (or within `pad` meters of) any indexed polygon. */
  hit(p: [number, number], pad = 0): boolean {
    const gx = Math.floor(p[0] / this.size), gy = Math.floor(p[1] / this.size)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        for (const rings of this.cells.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (pointInRings(p, rings)) return true
          if (pad > 0 && distToRings(p, rings) < pad) return true
        }
      }
    return false
  }
}

/** Uniform-grid index of line segments for distance-to-road tests. */
class SegmentIndex {
  private cells = new Map<string, [number, number, number, number, number][]>()
  constructor(private size = 30) {}
  add(line: [number, number][], halfWidth: number) {
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1], [bx, by] = line[i]
      const seg: [number, number, number, number, number] = [ax, ay, bx, by, halfWidth]
      for (let gx = Math.floor(Math.min(ax, bx) / this.size); gx <= Math.floor(Math.max(ax, bx) / this.size); gx++)
        for (let gy = Math.floor(Math.min(ay, by) / this.size); gy <= Math.floor(Math.max(ay, by) / this.size); gy++) {
          const key = `${gx},${gy}`
          const list = this.cells.get(key) ?? []
          list.push(seg)
          this.cells.set(key, list)
        }
    }
  }
  /** Smallest (distance - halfWidth) to any road edge near p. */
  clearance(p: [number, number]): number {
    let best = Infinity
    const gx = Math.floor(p[0] / this.size), gy = Math.floor(p[1] / this.size)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const [ax, ay, bx, by, hw] of this.cells.get(`${gx + dx},${gy + dy}`) ?? []) {
          best = Math.min(best, distToSeg(p, ax, ay, bx, by) - hw)
        }
    return best
  }
}

function ringBBox(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}

function pointInRing([x, y]: [number, number], ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function pointInRings(p: [number, number], rings: [number, number][][]): boolean {
  if (!pointInRing(p, rings[0])) return false
  for (let h = 1; h < rings.length; h++) if (pointInRing(p, rings[h])) return false
  return true
}

function distToSeg([px, py]: [number, number], ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function distToRings(p: [number, number], rings: [number, number][][]) {
  let best = Infinity
  for (const ring of rings)
    for (let i = 1; i < ring.length; i++)
      best = Math.min(best, distToSeg(p, ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]))
  return best
}

const readJson = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(join(OSM_DIR, name), 'utf8')) as T

export async function derive() {
  const meta = await readJson<{ origin: { lat: number; lng: number }; bbox: number[] }>('meta.json')
  const boundary = await readJson<Feature<Polygon | MultiPolygon>>('boundary.json')
  const buildings = await readJson<FeatureCollection<Polygon | MultiPolygon>>('buildings.json')
  const roads = await readJson<FeatureCollection<LineString, { class: string; inside: boolean }>>('roads.json')
  const water = await readJson<FeatureCollection>('water.json')
  const sport = await readJson<FeatureCollection<Polygon | MultiPolygon>>('sport.json')
  const green = await readJson<FeatureCollection<Polygon | MultiPolygon, { inside: boolean }>>('green.json')
  const osmTrees = await readJson<FeatureCollection<Point, { inside: boolean }>>('trees-osm.json')

  const P = makeProjector(meta.origin.lat, meta.origin.lng)
  const projPolys = (fs: Feature[]) =>
    fs.flatMap((f) => {
      const g = f.geometry
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
      return polys.map((rings) => rings.map((r) => r.map(P.to)))
    })

  const campus = new PolygonIndex(projPolys([boundary]), 200)
  const blocked = new PolygonIndex(
    projPolys([...buildings.features, ...sport.features, ...water.features.filter((f) => f.geometry.type !== 'LineString')]),
  )
  const greens = new PolygonIndex(projPolys(green.features as Area[]))
  const roadIdx = new SegmentIndex()
  const halfWidth: Record<string, number> = { main: 4.5, minor: 2.8, path: 1.1 }
  for (const r of roads.features) roadIdx.add(r.geometry.coordinates.map(P.to), halfWidth[r.properties.class] ?? 2)
  for (const w of water.features)
    if (w.geometry.type === 'LineString') roadIdx.add((w.geometry as LineString).coordinates.map(P.to), 3)

  // --- Trees -------------------------------------------------------------
  // Flat array, stride 4: lng, lat, scale (x100), kind (0 round, 1 tall, 2 cone).
  const out: number[] = []
  const rand = mulberry32(20260223)
  const push = (lng: number, lat: number, scale: number, kind: number) =>
    out.push(+lng.toFixed(6), +lat.toFixed(6), Math.round(scale * 100), kind)

  for (const t of osmTrees.features) {
    const [lng, lat] = t.geometry.coordinates
    push(lng, lat, 1.1 + rand() * 0.3, 0)
  }

  const [w, s, e, n] = meta.bbox
  const [x0, y0] = P.to([w, s]), [x1, y1] = P.to([e, n])
  let inside = 0, outside = 0
  for (let x = x0; x < x1; x += TREE_SPACING_M)
    for (let y = y0; y < y1; y += TREE_SPACING_M) {
      const p: [number, number] = [x + (rand() - 0.5) * TREE_SPACING_M * 0.8, y + (rand() - 0.5) * TREE_SPACING_M * 0.8]
      const isIn = campus.hit(p)
      const inGreen = greens.hit(p)
      // Campus is leafy; surroundings get a light sprinkle that the fade swallows.
      const keep = isIn ? (inGreen ? 0.85 : 0.55) : inGreen ? 0.35 : 0.07
      if (rand() > keep) continue
      if (blocked.hit(p, 2.5)) continue
      if (roadIdx.clearance(p) < 2.2) continue
      const [lng, lat] = P.from(p)
      const r = rand()
      push(lng, lat, 0.75 + rand() * 0.6, r < 0.72 ? 0 : r < 0.92 ? 1 : 2)
      isIn ? inside++ : outside++
    }

  await writeFile(
    join(OSM_DIR, 'trees.json'),
    JSON.stringify({
      note: 'Generated by scripts/derive-osm.ts. Real OSM trees first, then decorative scattered trees (not surveyed).',
      stride: 4,
      osmCount: osmTrees.features.length,
      data: out,
    }) + '\n',
  )

  // --- Fade mask ---------------------------------------------------------
  // Value 0 inside the campus, rising to 255 at FADE_DISTANCE_M outside it.
  const campusRings = projPolys([boundary])
  const mask = new Uint8Array(FADE_GRID * FADE_GRID)
  for (let j = 0; j < FADE_GRID; j++)
    for (let i = 0; i < FADE_GRID; i++) {
      const p: [number, number] = [x0 + ((i + 0.5) / FADE_GRID) * (x1 - x0), y0 + ((j + 0.5) / FADE_GRID) * (y1 - y0)]
      if (campus.hit(p)) continue
      let d = Infinity
      for (const rings of campusRings) d = Math.min(d, distToRings(p, rings))
      mask[j * FADE_GRID + i] = Math.round(Math.min(1, d / FADE_DISTANCE_M) * 255)
    }
  await writeFile(
    join(OSM_DIR, 'fade-mask.json'),
    JSON.stringify({
      note: 'Generated by scripts/derive-osm.ts. Row-major, row 0 = south edge of bbox.',
      bbox: meta.bbox,
      size: FADE_GRID,
      fadeDistanceM: FADE_DISTANCE_M,
      data: Buffer.from(mask).toString('base64'),
    }) + '\n',
  )
  console.log('Derived trees:', { osm: osmTrees.features.length, inside, outside }, 'and fade mask', `${FADE_GRID}²`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  derive().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
