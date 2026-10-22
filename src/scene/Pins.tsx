import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Landmark } from '../data/types'
import { toScene } from '../lib/geo'
import { pinBridge } from './pinBridge'

/**
 * How a pin is drawn. A pin is either a label (chip + stem + dot) or just a
 * dot; 'hidden' only applies off-screen or under floating UI.
 * Mirrored by the data-mode CSS in src/ui/PinLayer.tsx.
 */
export type PinMode = 'label' | 'dot' | 'hidden'

// Label geometry in CSS px (keep in sync with src/ui/PinLayer.tsx).
const CHIP_H = 32
const STEM_H = 14
const LABEL_PAD = 44 // icon + gaps + horizontal padding
const LABEL_GAP = 4 // breathing room between neighbouring labels
/** Touch radius around a dot (CSS px); dots are small, fingers are not. */
const DOT_HIT_RADIUS = 24

/**
 * Label budget by zoom, as a fraction of the distance that frames the whole
 * campus: at the overview only featured landmarks get labels (max 10); zoomed
 * in, everything may be labelled as long as labels don't collide.
 */
function labelBudget(zoom: number): { max: number; others: boolean } {
  if (zoom > 0.6) return { max: 10, others: false }
  if (zoom > 0.3) return { max: 18, others: true }
  return { max: Infinity, others: true }
}

const FONT = '600 12.5px "IBM Plex Sans Thai", system-ui, sans-serif'

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * 7
  measureCtx.font = FONT
  return measureCtx.measureText(text).width
}

/** The text a map label shows. */
export const labelText = (l: Landmark, lang: 'th' | 'en') => (l.shortName ?? l.name)[lang]

/**
 * Projects landmark anchors to the screen and decides which get labels: by
 * priority (selected, featured, others) within the zoom's label budget, and
 * never overlapping another label. Everything else is a dot. Runs only when
 * the camera, viewport, language or selection changes.
 */
export function PinProjector({ landmarks, heights }: { landmarks: Landmark[]; heights: Map<string, number> }) {
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null

  useEffect(() => {
    pinBridge.invalidate = invalidate
    pinBridge.touch()
    // Web fonts change label widths; re-run once they are ready.
    let live = true
    document.fonts?.ready.then(() => live && pinBridge.touch())
    return () => {
      live = false
      pinBridge.invalidate = () => {}
    }
  }, [invalidate])

  const s = useMemo(
    () => ({
      anchors: landmarks.map((l) => {
        const [x, z] = toScene(l.coordinates.lng, l.coordinates.lat)
        return new THREE.Vector3(x, (heights.get(l.id) ?? 0) + 2, z)
      }),
      v: new THREE.Vector3(),
      lastMatrix: new THREE.Matrix4(),
      lastSize: '',
      widths: new Float32Array(landmarks.length),
      widthsKey: '',
      order: landmarks.map((_, i) => i),
      rects: new Float32Array(landmarks.length * 4),
      screen: new Float32Array(landmarks.length * 2),
      modes: landmarks.map((): PinMode => 'hidden'),
    }),
    [landmarks, heights],
  )

  // Tap targets for the touch gesture handler (pins also have their own buttons for mouse/keyboard).
  useEffect(() => {
    pinBridge.hitTest = (x, y) => {
      let best: string | null = null
      let bestD = DOT_HIT_RADIUS
      landmarks.forEach((l, i) => {
        const mode = s.modes[i]
        if (mode === 'hidden') return
        const sx = s.screen[i * 2], sy = s.screen[i * 2 + 1]
        if (mode === 'label') {
          const w = s.widths[i]
          if (x >= sx - w / 2 && x <= sx + w / 2 && y >= sy - STEM_H - CHIP_H && y <= sy + 6) {
            best = l.id
            bestD = -1
          }
        }
        const d = Math.hypot(x - sx, y - sy)
        if (d < bestD) {
          best = l.id
          bestD = d
        }
      })
      return best
    }
    return () => {
      pinBridge.hitTest = () => null
    }
  }, [landmarks, s])

  useFrame(({ camera }) => {
    // useFrame runs before the renderer refreshes matrices; use this frame's pose.
    camera.updateMatrixWorld()
    const sizeKey = `${size.width}x${size.height}`
    if (!pinBridge.dirty && sizeKey === s.lastSize && camera.matrixWorld.equals(s.lastMatrix)) return
    pinBridge.dirty = false
    s.lastSize = sizeKey
    s.lastMatrix.copy(camera.matrixWorld)

    const { lang, selectedId, insets } = pinBridge
    const widthsKey = `${lang}|${document.fonts?.status}`
    if (s.widthsKey !== widthsKey) {
      s.widthsKey = widthsKey
      landmarks.forEach((l, i) => (s.widths[i] = textWidth(labelText(l, lang)) + LABEL_PAD))
    }
    const rank = (i: number) => (landmarks[i].id === selectedId ? 0 : landmarks[i].featured ? 1 : 2)
    s.order.sort((a, b) => rank(a) - rank(b) || a - b)

    const target = controls?.target
    const zoom = target ? camera.position.distanceTo(target) / pinBridge.fitDistance : 1
    const budget = labelBudget(zoom)

    const { v, rects, screen, modes } = s
    let placed = 0
    const overlaps = (x0: number, y0: number, x1: number, y1: number) => {
      for (let k = 0; k < placed; k++) {
        const o = k * 4
        if (x0 < rects[o + 2] && x1 > rects[o] && y0 < rects[o + 3] && y1 > rects[o + 1]) return true
      }
      return false
    }

    for (const i of s.order) {
      v.copy(s.anchors[i]).project(camera)
      const sx = (v.x * 0.5 + 0.5) * size.width
      const sy = (-v.y * 0.5 + 0.5) * size.height
      screen[i * 2] = sx
      screen[i * 2 + 1] = sy
      const off =
        v.z > 1 || sx < insets.left || sx > size.width - insets.right || sy < insets.top || sy > size.height - insets.bottom
      modes[i] = off ? 'hidden' : 'dot'
      if (off) continue

      const selected = landmarks[i].id === selectedId
      const eligible = selected || ((landmarks[i].featured || budget.others) && placed < budget.max)
      if (!eligible) continue
      const w = s.widths[i] + LABEL_GAP
      const x0 = sx - w / 2, y0 = sy - STEM_H - CHIP_H - LABEL_GAP, x1 = sx + w / 2
      // The chip must be fully visible: inside the viewport and clear of floating UI.
      const EDGE = 6
      if (y0 < insets.top || x0 < insets.left + EDGE || x1 > size.width - insets.right - EDGE) continue
      if (selected || !overlaps(x0, y0, x1, sy)) {
        const o = placed * 4
        rects[o] = x0; rects[o + 1] = y0; rects[o + 2] = x1; rects[o + 3] = sy
        placed++
        modes[i] = 'label'
      }
    }

    // Write straight to the DOM.
    landmarks.forEach((l, i) => {
      const el = pinBridge.elements.get(l.id)
      if (!el) return
      el.style.transform = `translate3d(${screen[i * 2].toFixed(1)}px, ${screen[i * 2 + 1].toFixed(1)}px, 0)`
      if (el.dataset.mode !== modes[i]) {
        el.dataset.mode = modes[i]
        el.inert = modes[i] === 'hidden'
      }
      // Labels stack above dots; the selected pin above everything.
      el.style.zIndex = String(l.id === selectedId ? 3 : modes[i] === 'label' ? 2 : 1)
    })
  })

  return null
}
