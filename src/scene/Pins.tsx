import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Landmark } from '../data/types'
import { toScene } from '../lib/geo'
import { pinBridge } from './pinBridge'

/** How a pin is drawn after decluttering. Mirrored in PinLayer's CSS. */
export type PinMode = 'label' | 'icon' | 'hidden'

// Pin geometry in CSS px (keep in sync with src/ui/PinLayer.tsx).
const CHIP_H = 32
const STEM_H = 22
const ICON_W = 32
const LABEL_PAD = 46 // icon + gaps + right padding
const LABEL_MAX = 176
/** Icons may overlap other icons a little before the lower-priority one hides. */
const ICON_SHRINK = 0.55

const FONT = '600 12.5px "IBM Plex Sans Thai", system-ui, sans-serif'

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * 7
  measureCtx.font = FONT
  return measureCtx.measureText(text).width
}

/**
 * Projects landmark anchors to the screen and declutters them: by priority
 * (selected, featured, others) each pin gets a label if it fits, otherwise an
 * icon if that fits, otherwise it hides. Runs only when the camera, viewport,
 * language or selection changes.
 */
export function PinProjector({ landmarks, heights }: { landmarks: Landmark[]; heights: Map<string, number> }) {
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

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
        return new THREE.Vector3(x, (heights.get(l.id) ?? 0) + 3, z)
      }),
      v: new THREE.Vector3(),
      lastMatrix: new THREE.Matrix4(),
      lastSize: '',
      widths: new Float32Array(landmarks.length),
      widthsKey: '',
      order: landmarks.map((_, i) => i),
      rects: new Float32Array(landmarks.length * 4),
      kinds: new Uint8Array(landmarks.length),
      screen: new Float32Array(landmarks.length * 2),
      modes: landmarks.map((): PinMode => 'hidden'),
    }),
    [landmarks, heights],
  )

  useFrame(({ camera }) => {
    // useFrame runs before the renderer refreshes matrices; use this frame's pose.
    camera.updateMatrixWorld()
    const sizeKey = `${size.width}x${size.height}`
    if (!pinBridge.dirty && sizeKey === s.lastSize && camera.matrixWorld.equals(s.lastMatrix)) return
    pinBridge.dirty = false
    s.lastSize = sizeKey
    s.lastMatrix.copy(camera.matrixWorld)

    const { lang, selectedId } = pinBridge
    const widthsKey = `${lang}|${document.fonts?.status}`
    if (s.widthsKey !== widthsKey) {
      s.widthsKey = widthsKey
      landmarks.forEach((l, i) => (s.widths[i] = Math.min(LABEL_MAX, textWidth(l.name[lang])) + LABEL_PAD))
    }
    const rank = (i: number) => (landmarks[i].id === selectedId ? 0 : landmarks[i].featured ? 1 : 2)
    s.order.sort((a, b) => rank(a) - rank(b) || a - b)

    const { v, rects, kinds, screen, modes } = s
    let placed = 0
    // kinds[k]: 1 = label box, 0 = icon box. Nothing may overlap a label.
    const overlaps = (x0: number, y0: number, x1: number, y1: number, isIcon: boolean) => {
      for (let k = 0; k < placed; k++) {
        const o = k * 4
        let a0 = rects[o], b0 = rects[o + 1], a1 = rects[o + 2], b1 = rects[o + 3]
        if (isIcon && kinds[k] === 0) {
          const cx = (a0 + a1) / 2, cy = (b0 + b1) / 2
          const hw = ((a1 - a0) * ICON_SHRINK) / 2, hh = ((b1 - b0) * ICON_SHRINK) / 2
          a0 = cx - hw; a1 = cx + hw; b0 = cy - hh; b1 = cy + hh
        }
        if (x0 < a1 && x1 > a0 && y0 < b1 && y1 > b0) return true
      }
      return false
    }
    const place = (x0: number, y0: number, x1: number, y1: number, kind: number) => {
      const o = placed * 4
      rects[o] = x0; rects[o + 1] = y0; rects[o + 2] = x1; rects[o + 3] = y1
      kinds[placed++] = kind
    }

    for (const i of s.order) {
      v.copy(s.anchors[i]).project(camera)
      const sx = (v.x * 0.5 + 0.5) * size.width
      const sy = (-v.y * 0.5 + 0.5) * size.height
      screen[i * 2] = sx
      screen[i * 2 + 1] = sy
      const { insets } = pinBridge
      const off =
        v.z > 1 ||
        sx < insets.left - LABEL_MAX / 2 ||
        sx > size.width - insets.right + LABEL_MAX / 2 ||
        sy - STEM_H - CHIP_H < insets.top ||
        sy > size.height - insets.bottom + 40
      modes[i] = off ? 'hidden' : 'icon'
    }
    // Per priority tier: labels first, then icons for that tier's leftovers
    // (never over a label). So every featured pin gets at least an icon
    // before any ordinary pin gets a label.
    for (const tier of [0, 1]) {
      const inTier = (i: number) => (rank(i) <= 1 ? 0 : 1) === tier
      for (const i of s.order) {
        if (!inTier(i) || modes[i] === 'hidden') continue
        const sx = screen[i * 2], sy = screen[i * 2 + 1], w = s.widths[i]
        const top = sy - STEM_H - CHIP_H
        if (landmarks[i].id === selectedId || !overlaps(sx - w / 2, top, sx + w / 2, sy, false)) {
          place(sx - w / 2, top, sx + w / 2, sy, 1)
          modes[i] = 'label'
        }
      }
      for (const i of s.order) {
        if (!inTier(i) || modes[i] !== 'icon') continue
        const sx = screen[i * 2], sy = screen[i * 2 + 1]
        const top = sy - STEM_H - CHIP_H
        if (overlaps(sx - ICON_W / 2, top, sx + ICON_W / 2, sy, true)) modes[i] = 'hidden'
        else place(sx - ICON_W / 2, top, sx + ICON_W / 2, sy, 0)
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
      // Labels stack above icons; the selected pin above everything.
      el.style.zIndex = String(l.id === selectedId ? 3 : modes[i] === 'label' ? 2 : 1)
    })
  })

  return null
}
