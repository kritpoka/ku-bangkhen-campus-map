import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Feature, Geometry, Position } from 'geojson'
import { project } from '../lib/geo'

/** Polygon rings in projected [east, north] meters. */
export type Rings = [number, number][][]

export function polygonsOf(geometry: Geometry): Rings[] {
  const proj = (ring: Position[]) => ring.map(([lng, lat]) => project(lng, lat))
  if (geometry.type === 'Polygon') return [geometry.coordinates.map(proj)]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p.map(proj))
  return []
}

export function linesOf(geometry: Geometry): [number, number][][] {
  const proj = (line: Position[]) => line.map(([lng, lat]) => project(lng, lat))
  if (geometry.type === 'LineString') return [proj(geometry.coordinates)]
  if (geometry.type === 'MultiLineString') return geometry.coordinates.map(proj)
  return []
}

export function shapeFromRings(rings: Rings): THREE.Shape | null {
  const [outer, ...holes] = rings
  if (!outer || outer.length < 4) return null
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of holes) {
    if (h.length >= 4) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  }
  return shape
}

/** Shapes are authored in the (east, north) plane; this lays them flat with north = -z. */
const LAY_FLAT = new THREE.Matrix4().makeRotationX(-Math.PI / 2)

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) return new THREE.BufferGeometry()
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  merged.computeBoundingSphere()
  return merged
}

/** Flat polygons (ground cover, water…) merged into one geometry at height y. */
export function flatPolygons(features: Feature[], y: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const f of features) {
    for (const rings of polygonsOf(f.geometry)) {
      const shape = shapeFromRings(rings)
      if (!shape) continue
      const g = new THREE.ShapeGeometry(shape)
      g.applyMatrix4(LAY_FLAT)
      g.translate(0, y, 0)
      parts.push(stripToPositionNormal(g))
    }
  }
  return merge(parts)
}

/** Extruded prisms merged into one geometry; height comes from the callback. */
export function extrudedPolygons(
  features: Feature[],
  heightOf: (f: Feature) => number,
  base = 0,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const f of features) {
    const depth = heightOf(f)
    for (const rings of polygonsOf(f.geometry)) {
      const shape = shapeFromRings(rings)
      if (!shape) continue
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
      g.applyMatrix4(LAY_FLAT)
      g.translate(0, base, 0)
      parts.push(stripToPositionNormal(g))
    }
  }
  return merge(parts)
}

/**
 * Flat ribbons along polylines (roads, paths, canals). Uses mitered joins with a
 * clamp so sharp corners don't spike, plus a small disc at every end so
 * junctions between separate OSM ways look continuous.
 */
export function ribbons(
  lines: [number, number][][],
  width: number,
  y: number,
): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const half = width / 2

  for (const line of lines) {
    const pts = dedupe(line)
    if (pts.length < 2) continue
    const start = pos.length / 3
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)]
      const next = pts[Math.min(pts.length - 1, i + 1)]
      const cur = pts[i]
      // Average the incoming/outgoing directions for a miter normal.
      let dx1 = cur[0] - prev[0], dy1 = cur[1] - prev[1]
      let dx2 = next[0] - cur[0], dy2 = next[1] - cur[1]
      const l1 = Math.hypot(dx1, dy1) || 1, l2 = Math.hypot(dx2, dy2) || 1
      dx1 /= l1; dy1 /= l1; dx2 /= l2; dy2 /= l2
      if (i === 0) { dx1 = dx2; dy1 = dy2 }
      if (i === pts.length - 1) { dx2 = dx1; dy2 = dy1 }
      let nx = -(dy1 + dy2), ny = dx1 + dx2
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl; ny /= nl
      // Miter length = half / cos(theta/2), clamped to avoid spikes.
      const dot = nx * -dy1 + ny * dx1
      const m = half / Math.max(dot, 0.5)
      pos.push(cur[0] + nx * m, y, -(cur[1] + ny * m))
      pos.push(cur[0] - nx * m, y, -(cur[1] - ny * m))
      if (i > 0) {
        const a = start + (i - 1) * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    for (const end of [pts[0], pts[pts.length - 1]]) disc(pos, idx, end, half, y)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  fixWinding(g)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Dashed center line: short quads every `period` meters along each polyline. */
export function dashes(
  lines: [number, number][][],
  width: number,
  dash: number,
  gap: number,
  y: number,
): THREE.BufferGeometry {
  const segs: [number, number][][] = []
  for (const line of lines) {
    const pts = dedupe(line)
    let carry = 0 // distance into the current dash/gap cycle
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
      const len = Math.hypot(bx - ax, by - ay)
      let t = 0
      while (t < len) {
        const cycle = (carry + t) % (dash + gap)
        if (cycle < dash) {
          const run = Math.min(dash - cycle, len - t)
          const s = t / len, e = (t + run) / len
          segs.push([
            [ax + (bx - ax) * s, ay + (by - ay) * s],
            [ax + (bx - ax) * e, ay + (by - ay) * e],
          ])
          t += run
        } else {
          t += dash + gap - cycle
        }
      }
      carry = (carry + len) % (dash + gap)
    }
  }
  return ribbonsNoCaps(segs, width, y)
}

function ribbonsNoCaps(segs: [number, number][][], width: number, y: number) {
  const pos: number[] = []
  const idx: number[] = []
  const half = width / 2
  for (const [[ax, ay], [bx, by]] of segs) {
    const l = Math.hypot(bx - ax, by - ay) || 1
    const nx = (-(by - ay) / l) * half, ny = ((bx - ax) / l) * half
    const s = pos.length / 3
    pos.push(ax + nx, y, -(ay + ny), ax - nx, y, -(ay - ny), bx + nx, y, -(by + ny), bx - nx, y, -(by - ny))
    idx.push(s, s + 1, s + 2, s + 1, s + 3, s + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  fixWinding(g)
  g.computeVertexNormals()
  return g
}

function disc(pos: number[], idx: number[], [cx, cy]: [number, number], r: number, y: number) {
  const n = 10
  const c = pos.length / 3
  pos.push(cx, y, -cy)
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    pos.push(cx + Math.cos(a) * r, y, -(cy + Math.sin(a) * r))
  }
  for (let k = 0; k < n; k++) idx.push(c, c + 1 + k, c + 1 + ((k + 1) % n))
}

/** Make every triangle face up (+y) so flat ribbons light consistently. */
function fixWinding(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const index = g.getIndex()!
  const arr = index.array as Uint32Array | Uint16Array
  for (let i = 0; i < arr.length; i += 3) {
    const a = arr[i], b = arr[i + 1], c = arr[i + 2]
    const abx = p.getX(b) - p.getX(a), abz = p.getZ(b) - p.getZ(a)
    const acx = p.getX(c) - p.getX(a), acz = p.getZ(c) - p.getZ(a)
    // y component of (ab x ac) must be positive.
    if (abz * acx - abx * acz < 0) {
      arr[i + 1] = c
      arr[i + 2] = b
    }
  }
  index.needsUpdate = true
}

function dedupe(line: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const p of line) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.05) out.push(p)
  }
  return out
}

/** Signed area (positive = counter-clockwise) of a closed or open ring. */
export function ringArea(ring: [number, number][]): number {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  return a / 2
}

/** Ring without the duplicated closing vertex, wound counter-clockwise. */
export function openCCW(ring: [number, number][]): [number, number][] {
  const r = dedupe(ring)
  if (r.length > 2 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop()
  const first = r[0], last = r[r.length - 1]
  if (r.length > 2 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.05) r.pop()
  return ringArea(r) < 0 ? r.reverse() : r
}

/**
 * Offset a CCW ring outward (d > 0) or inward (d < 0) with clamped miters.
 * Good for small offsets (eaves, parapets); not a full straight skeleton.
 */
export function offsetRing(ring: [number, number][], d: number): [number, number][] {
  const n = ring.length
  return ring.map((cur, i) => {
    const prev = ring[(i - 1 + n) % n], next = ring[(i + 1) % n]
    let ax = cur[0] - prev[0], ay = cur[1] - prev[1]
    let bx = next[0] - cur[0], by = next[1] - cur[1]
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1
    ax /= la; ay /= la; bx /= lb; by /= lb
    // Outward normals of a CCW ring point to the right of travel.
    const nx = ay + by, ny = -(ax + bx)
    const nl = Math.hypot(nx, ny) || 1
    const cos = (nx / nl) * ay + (ny / nl) * -ax
    const m = d / Math.max(cos, 0.35)
    return [cur[0] + (nx / nl) * m, cur[1] + (ny / nl) * m]
  })
}

/** Oriented bounding box via the longest edge direction (good for buildings). */
export function orientedBox(ring: [number, number][]) {
  let best = 0, angle = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l > best) { best = l; angle = Math.atan2(b[1] - a[1], b[0] - a[0]) }
  }
  const c = Math.cos(angle), s = Math.sin(angle)
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
  for (const [x, y] of ring) {
    const u = x * c + y * s, v = -x * s + y * c
    minU = Math.min(minU, u); maxU = Math.max(maxU, u)
    minV = Math.min(minV, v); maxV = Math.max(maxV, v)
  }
  const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2
  return {
    cos: c, sin: s,
    center: [cu * c - cv * s, cu * s + cv * c] as [number, number],
    length: maxU - minU,
    width: maxV - minV,
    /** Map a point into box space (u along the long axis, v across). */
    toBox: ([x, y]: [number, number]): [number, number] => [x * c + y * s - cu, -x * s + y * c - cv],
    fromBox: ([u, v]: [number, number]): [number, number] => [(u + cu) * c - (v + cv) * s, (u + cu) * s + (v + cv) * c],
  }
}

/**
 * A hip-style roof: the eave ring is pulled toward a ridge line along the
 * building's long axis by `inset` meters on every side, rising by `rise`.
 * Works on any footprint; on rectangles it is a true hip roof.
 */
export function hipRoof(eave: [number, number][], base: number, rise: number, inset: number): THREE.BufferGeometry {
  const box = orientedBox(eave)
  const halfL = box.length / 2, halfW = box.width / 2
  const su = Math.max(0, halfL - inset) / (halfL || 1)
  const sv = Math.max(0, halfW - inset) / (halfW || 1)
  const top = eave.map((p) => {
    const [u, v] = box.toBox(p)
    return box.fromBox([u * su, v * sv])
  })
  return loft(eave, top, base, base + rise, true)
}

/** Side faces between two rings with equal vertex counts, plus an optional flat cap. */
export function loft(
  a: [number, number][],
  b: [number, number][],
  ya: number,
  yb: number,
  cap: boolean,
): THREE.BufferGeometry {
  const pos: number[] = []
  const n = a.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const p0 = [a[i][0], ya, -a[i][1]], p1 = [a[j][0], ya, -a[j][1]]
    const q0 = [b[i][0], yb, -b[i][1]], q1 = [b[j][0], yb, -b[j][1]]
    pos.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0)
  }
  if (cap && Math.abs(ringArea(b)) > 0.5) {
    const tris = THREE.ShapeUtils.triangulateShape(b.map(([x, y]) => new THREE.Vector2(x, y)), [])
    for (const [i, j, k] of tris) pos.push(b[i][0], yb, -b[i][1], b[j][0], yb, -b[j][1], b[k][0], yb, -b[k][1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  orientUp(g)
  g.computeVertexNormals()
  return g
}

/**
 * Non-indexed triangles from lofts can come out either winding; flip any
 * triangle whose normal points down or toward the ring center so lighting is
 * consistent on roofs.
 */
function orientUp(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const ab = new THREE.Vector3(), ac = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2)
    const nrm = ab.subVectors(b, a).cross(ac.subVectors(c, a))
    if (nrm.y < 0) {
      p.setXYZ(i + 1, c.x, c.y, c.z)
      p.setXYZ(i + 2, b.x, b.y, b.z)
    }
  }
}

/** Extrude a projected ring (with optional holes) from y0 to y1, bevel optional. */
export function prism(
  outer: [number, number][],
  holes: [number, number][][],
  y0: number,
  y1: number,
  bevel = 0,
): THREE.BufferGeometry {
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  const depth = Math.max(0.05, y1 - y0 - bevel * 2)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
    bevelSegments: 1,
  })
  g.applyMatrix4(LAY_FLAT)
  g.translate(0, y0 + bevel, 0)
  return stripToPositionNormal(g)
}

export { merge as mergeParts }

/** Drop uv/other attributes so heterogeneous geometries merge cleanly. */
export function stripToPositionNormal(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(ng.attributes)) {
    if (name !== 'position' && name !== 'normal') ng.deleteAttribute(name)
  }
  if (!ng.getAttribute('normal')) ng.computeVertexNormals()
  if (ng !== g) g.dispose()
  return ng
}
