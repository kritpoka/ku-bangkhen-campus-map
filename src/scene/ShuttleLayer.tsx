import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { shuttleLines } from '../data/shuttle'
import { project } from '../lib/geo'
import { withCampusFade } from './campusFade'

/**
 * Shuttle routes as flat ribbons above the roads. Lines that share a road are
 * drawn as concentric stripes (widest first), like the official map's
 * side-by-side lines, over a white casing. Widths grow with camera distance
 * in the vertex shader, so lines keep a readable on-screen width at every zoom.
 * The active line is drawn last at full strength; the others dim.
 */
const WIDTH: Record<string, number> = { '5': 9, '3': 6, '1': 3.2 } // m at the reference distance
const CASING = 3
const Y = 0.3
const REF_DISTANCE = 600 // camera distance (m) at which widths are as listed

/**
 * Centreline ribbon: every vertex sits on the line; `aSide` holds the unit
 * miter offset (east, north) scaled by half-width, applied in the shader.
 */
function centerRibbon(lines: [number, number][][], halfWidth: number): THREE.BufferGeometry {
  const pos: number[] = [], side: number[] = [], idx: number[] = []
  for (const line of lines) {
    const pts = line.filter((p, i) => i === 0 || Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) > 0.05)
    if (pts.length < 2) continue
    const start = pos.length / 3
    pts.forEach((cur, i) => {
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
      let ax = cur[0] - prev[0], ay = cur[1] - prev[1], bx = next[0] - cur[0], by = next[1] - cur[1]
      const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1
      ax /= la; ay /= la; bx /= lb; by /= lb
      if (i === 0) { ax = bx; ay = by }
      if (i === pts.length - 1) { bx = ax; by = ay }
      let nx = -(ay + by), ny = ax + bx
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl; ny /= nl
      const m = halfWidth / Math.max(nx * -ay + ny * ax, 0.5)
      // Square caps: push the end vertices out along the line by half a width,
      // so separate polylines meet without gaps once widened in the shader.
      const cap = i === 0 ? -halfWidth : i === pts.length - 1 ? halfWidth : 0
      const dx = i === 0 ? bx : ax, dy = i === 0 ? by : ay
      for (const s of [1, -1]) {
        pos.push(cur[0], Y, -cur[1])
        side.push(nx * m * s + dx * cap, ny * m * s + dy * cap)
      }
      if (i > 0) {
        const a = start + (i - 1) * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    })
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  if (g.boundingSphere) g.boundingSphere.radius += 200 // widened in the shader
  return g
}

/**
 * Pieces of a continuous route to draw: each road stretch once (a loop can pass
 * a road twice, e.g. both directions of a two-way road), split at U-turns so a
 * ribbon never folds back on itself. Square caps close the joins.
 */
function drawRuns(route: [number, number][]): [number, number][][] {
  const k = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  const seen = new Set<string>()
  const runs: [number, number][][] = []
  let run: [number, number][] = []
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i]
    const edge = [k(a), k(b)].sort().join('|')
    const repeat = seen.has(edge)
    if (repeat || (i >= 2 && k(route[i - 2]) === k(b))) {
      if (run.length > 1) runs.push(run)
      run = []
    }
    if (repeat) continue
    seen.add(edge)
    if (run.length === 0) run.push(a)
    run.push(b)
  }
  if (run.length > 1) runs.push(run)
  return runs
}

const widthScale = { value: 1 }

function lineMaterial(color: THREE.ColorRepresentation) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  return withCampusFade(
    m,
    (shader) => {
      shader.uniforms.uWidthScale = widthScale
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aSide;\nuniform float uWidthScale;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += vec3(aSide.x, 0.0, -aSide.y) * uWidthScale;')
    },
    '-shuttle',
  )
}

export function ShuttleLayer({ activeLine }: { activeLine: string | null }) {
  const invalidate = useThree((st) => st.invalidate)
  const controls = useThree((st) => st.controls) as { target?: THREE.Vector3 } | null
  useEffect(() => invalidate(), [activeLine, invalidate])

  // Wider lines when zoomed out (≈ constant screen width), never thinner than the reference.
  useFrame(({ camera }) => {
    const t = controls?.target
    if (!t) return
    widthScale.value = THREE.MathUtils.clamp(camera.position.distanceTo(t) / REF_DISTANCE, 0.7, 4.5)
  })

  const drawn = useMemo(() => {
    const lines = shuttleLines.filter((l) => l.path.length > 0)
    lines.sort((a, b) => (WIDTH[b.id] ?? 4) - (WIDTH[a.id] ?? 4))
    return lines.map((l) => {
      const proj = drawRuns(l.path.map(([lng, lat]) => project(lng, lat)))
      const w = WIDTH[l.id] ?? 4
      return {
        id: l.id,
        casing: centerRibbon(proj, (w + CASING) / 2),
        line: centerRibbon(proj, w / 2),
        casingMat: lineMaterial('#ffffff'),
        lineMat: lineMaterial(l.color),
      }
    })
  }, [])

  return (
    <group>
      {drawn.map((d, i) => {
        const active = activeLine === d.id
        const dim = activeLine !== null && !active
        d.casingMat.opacity = dim ? 0.3 : 0.95
        d.lineMat.opacity = dim ? 0.2 : 1
        // All casings first (beneath every line), then lines widest → narrowest so
        // shared roads show concentric stripes. The active line goes on top.
        return (
          <group key={d.id}>
            <mesh geometry={d.casing} material={d.casingMat} renderOrder={active ? -42 : -70 + i} frustumCulled={false} />
            <mesh geometry={d.line} material={d.lineMat} renderOrder={active ? -41 : -60 + i} frustumCulled={false} />
          </group>
        )
      })}
    </group>
  )
}
