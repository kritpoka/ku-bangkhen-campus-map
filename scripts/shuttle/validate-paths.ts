/**
 * Validate the traced shuttle routes (src/data/shuttle-paths.json):
 *
 * - every route vertex lies on campus: within AREA_TOL of the OSM campus
 *   polygons, or on a reviewed KU road from outside-roads.json for that line
 * - no public road (primary/secondary/…; Ngamwongwan, Phahonyothin, Vibhavadi)
 * - each line is one continuous path: every step follows an OSM road (no
 *   straight-line jumps across gaps > GAP_MAX), and the loop closes
 * - every on-map stop of a line is within STOP_MAX of its path
 *
 * Usage: npm run test:shuttle-data   (exits 1 on any failure)
 */
import { readFileSync } from 'node:fs'
import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson'
import { shuttleLines, shuttleStopById } from '../../src/data/shuttle'
import { project } from '../../src/lib/geo'

const AREA_TOL = 10 // m
const GAP_MAX = 5 // m
const STOP_MAX = 30 // m
const PUBLIC_HIGHWAY = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/
const PUBLIC_NAMES = ['งามวงศ์วาน', 'พหลโยธิน', 'วิภาวดี', 'Ngam Wong Wan', 'Phahon Yothin', 'Vibhavadi']

type P = [number, number]
type Seg = [P, P]
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T

const boundary = read<Feature<Polygon | MultiPolygon>>('../../src/data/osm/boundary.json')
const roads = read<{ features: Feature<LineString | MultiLineString>[] }>('../../src/data/osm/roads.json').features
const outside = read<{ ways: Record<string, { lines: string[] }> }>('./outside-roads.json').ways

const rings: P[][] = (boundary.geometry.type === 'Polygon' ? [boundary.geometry.coordinates] : boundary.geometry.coordinates)
  .flat()
  .map((ring) => ring.map(([lng, lat]) => project(lng, lat)))
const edges: Seg[] = rings.flatMap((r) => r.slice(1).map((p, i): Seg => [r[i], p]))

function segDist(p: P, [a, b]: Seg): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1])
}
const nearest = (p: P, segs: Seg[]) => segs.reduce((m, s) => Math.min(m, segDist(p, s)), Infinity)

/** Distance to the campus area: 0 inside (even-odd over all rings), else to the nearest edge. */
function areaDistance(p: P): number {
  let inside = false
  for (const [a, b] of edges) {
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) inside = !inside
  }
  return inside ? 0 : nearest(p, edges)
}

interface Road { id: string; public: boolean; segs: Seg[] }
const drivable: Road[] = roads
  .filter((f) => f.properties?.class !== 'path')
  .map((f) => {
    const pr = f.properties ?? {}
    const name = `${pr.name ?? ''} ${pr['name:en'] ?? ''}`
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    return {
      id: pr.id as string,
      public: PUBLIC_HIGHWAY.test(pr.highway ?? '') || PUBLIC_NAMES.some((n) => name.includes(n)),
      segs: lines.flatMap((l) => l.slice(1).map((c, i): Seg => [project(l[i][0], l[i][1]), project(c[0], c[1])])),
    }
  })
function nearestRoad(p: P): { road: Road; d: number } {
  let best = { road: drivable[0], d: Infinity }
  for (const road of drivable) {
    const d = nearest(p, road.segs)
    if (d < best.d) best = { road, d }
  }
  return best
}

let failures = 0
const fail = (msg: string) => {
  failures++
  console.log(`FAIL  ${msg}`)
}

for (const line of shuttleLines) {
  if (line.path.length === 0) {
    console.log(`skip  line ${line.id}: no published route map`)
    continue
  }
  const pts = line.path.map(([lng, lat]) => project(lng, lat))
  const allowed = drivable.filter((r) => outside[r.id]?.lines.includes(line.id)).flatMap((r) => r.segs)
  const before = failures

  // On campus.
  pts.forEach((p, i) => {
    const d = areaDistance(p)
    if (d > AREA_TOL && nearest(p, allowed) > AREA_TOL) fail(`line ${line.id}: vertex ${i} ${line.path[i]} is ${d.toFixed(0)} m outside the campus area`)
  })

  // Continuous, on roads, no public roads: test every step every ~2 m.
  const first = pts[0], last = pts[pts.length - 1]
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > GAP_MAX) fail(`line ${line.id}: loop does not close`)
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.ceil(L / 2))
    for (let j = 0; j <= n; j++) {
      const q: P = [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]
      const { road, d } = nearestRoad(q)
      if (d > GAP_MAX) {
        fail(`line ${line.id}: step ${i} leaves the road network by ${d.toFixed(1)} m (gap) near ${line.path[i]}`)
        break
      }
      if (road.public && d < 1) {
        fail(`line ${line.id}: step ${i} runs on public road ${road.id}`)
        break
      }
    }
  }

  // Stops near the path.
  const pathSegs = pts.slice(1).map((p, i): Seg => [pts[i], p])
  for (const id of new Set(line.stops)) {
    const stop = shuttleStopById.get(id)!
    if (stop.offMap) continue
    const d = nearest(project(stop.coordinates.lng, stop.coordinates.lat), pathSegs)
    if (d > STOP_MAX) fail(`line ${line.id}: stop ${stop.code ?? id} is ${d.toFixed(0)} m from the path`)
  }

  const km = pathSegs.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0) / 1000
  if (failures === before) console.log(`PASS  line ${line.id}: ${pts.length} vertices, ${km.toFixed(2)} km, on campus, continuous, stops within ${STOP_MAX} m`)
}

const offMap = shuttleLines.flatMap((l) => l.stops.filter((id) => shuttleStopById.get(id)?.offMap).map((id) => `${l.id}:${id}`))
if (offMap.length) console.log(`note  not routed (off-map stops): ${offMap.join(', ')}`)
console.log(failures ? `\n${failures} problem(s)` : '\nshuttle data OK')
process.exit(failures ? 1 : 0)
