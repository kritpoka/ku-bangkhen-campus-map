import { mapCamera } from './mapCamera'

/**
 * Google Maps–style touch gestures for the map, built on Pointer Events.
 *
 *   1 finger drag ............ pan, with fling momentum on release
 *   2 finger pinch ........... zoom about the finger midpoint
 *   2 finger twist ........... rotate about the midpoint (after a clear ~12° twist)
 *   2 fingers up/down together tilt (only when both move vertically the same way)
 *   double-tap ............... zoom in one step at the tap
 *   2 finger tap ............. zoom out one step
 *   double-tap, hold, drag ... one-handed zoom (drag down = in, up = out)
 *   single tap ............... onTap, fired only once it can't be a pan or a double-tap
 *
 * Only touch pointers are handled; mouse and pen fall through to OrbitControls.
 * Touch events are stopped in the capture phase on the map container, so
 * pins and OrbitControls never see them.
 */

// Thresholds (CSS px, ms, radians).
const TOUCH_SLOP = 8 // movement before a press becomes a pan
const TAP_MAX_MS = 300
const DOUBLE_TAP_MS = 280 // max gap between taps; also the single-tap delay
const DOUBLE_TAP_DIST = 32
const QUICK_ZOOM_SLOP = 8
const QUICK_ZOOM_RATE = 0.0085 // zoom factor per px (exponential)
const TWO_TAP_MAX_MS = 260
const TWO_TAP_SLOP = 12
const ZOOM_START = 0.045 // |log(span / startSpan)| before pinch zoom engages
const ROTATE_START = (12 * Math.PI) / 180
const TILT_START = 12 // px both fingers must move vertically, same direction
const TILT_RATE = 0.0055 // radians per px
const VELOCITY_WINDOW_MS = 90
const ZOOM_STEP = 0.5 // distance multiplier for one zoom-in step

interface Pt {
  x: number
  y: number
  sx: number
  sy: number
  t: number
}

type Mode = 'idle' | 'press' | 'pan' | 'secondPress' | 'quickZoom' | 'multi' | 'done'

export interface TouchGestureOptions {
  /** Called for a confirmed single tap (container-relative CSS px). */
  onTap?: (x: number, y: number) => void
}

export function attachTouchGestures(el: HTMLElement, opts: TouchGestureOptions): () => void {
  const pts = new Map<number, Pt>()
  let mode: Mode = 'idle'
  let lastTap: { x: number; y: number; t: number } | null = null
  let tapTimer = 0
  let suppressClicksUntil = 0
  const samples: { t: number; x: number; y: number }[] = []
  const multi = {
    startT: 0,
    startSpan: 0,
    startAngle: 0,
    lastSpan: 0,
    lastAngle: 0,
    lastMidX: 0,
    lastMidY: 0,
    zooming: false,
    rotating: false,
    tilting: false,
  }
  let quick = { x: 0, y: 0, lastY: 0 }
  let stoppedMotion = false

  const local = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const two = () => {
    const [a, b] = [...pts.values()]
    return {
      a,
      b,
      span: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    }
  }

  const startMulti = (t: number) => {
    const g = two()
    Object.assign(multi, {
      startT: t,
      startSpan: g.span,
      startAngle: g.angle,
      lastSpan: g.span,
      lastAngle: g.angle,
      lastMidX: g.mx,
      lastMidY: g.my,
      zooming: false,
      rotating: false,
      tilting: false,
    })
  }

  const cancelPendingTap = () => {
    clearTimeout(tapTimer)
    tapTimer = 0
  }

  // ─── Pointer handlers (capture phase) ─────────────────────────────────

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    e.stopPropagation()
    e.preventDefault()
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic or already-released pointers can't be captured; the map covers the screen anyway.
    }
    const { x, y } = local(e)
    // Event timestamps, not handler time: a janky frame must not break double-taps or flings.
    const now = e.timeStamp

    if (pts.size >= 2) return // ignore a third finger
    pts.set(e.pointerId, { x, y, sx: x, sy: y, t: now })
    if (pts.size === 1) {
      // Touching a gliding map just stops it (and must not count as a tap).
      stoppedMotion = mapCamera.active
      mapCamera.begin()
    }

    if (pts.size === 1) {
      samples.length = 0
      samples.push({ t: now, x, y })
      if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_DIST) {
        // Second tap of a double-tap (or the start of a one-handed zoom).
        cancelPendingTap()
        mode = 'secondPress'
        quick = { x: lastTap.x, y: lastTap.y, lastY: y }
      } else {
        mode = 'press'
      }
    } else {
      // A second finger: whatever one-finger gesture was starting is over.
      cancelPendingTap()
      lastTap = null
      mode = 'multi'
      startMulti(now)
    }
  }

  const onMove = (e: PointerEvent) => {
    const p = pts.get(e.pointerId)
    if (!p) return
    e.stopPropagation()
    const { x, y } = local(e)
    const px = p.x, py = p.y
    p.x = x
    p.y = y

    switch (mode) {
      case 'press':
        if (Math.hypot(x - p.sx, y - p.sy) > TOUCH_SLOP) {
          mode = 'pan'
          mapCamera.panScreen(p.sx, p.sy, x, y)
        }
        break
      case 'pan': {
        mapCamera.panScreen(px, py, x, y)
        const now = e.timeStamp
        samples.push({ t: now, x, y })
        while (samples.length > 2 && now - samples[0].t > VELOCITY_WINDOW_MS) samples.shift()
        break
      }
      case 'secondPress':
        if (Math.abs(y - p.sy) > QUICK_ZOOM_SLOP) mode = 'quickZoom'
        break
      case 'quickZoom': {
        // Drag down zooms in, up zooms out, about the double-tap point.
        const f = Math.exp(-(y - quick.lastY) * QUICK_ZOOM_RATE)
        quick.lastY = y
        mapCamera.transform({ factor: f, ax: quick.x, ay: quick.y, bx: quick.x, by: quick.y })
        break
      }
      case 'multi':
        if (pts.size === 2) multiMove()
        break
    }
  }

  const multiMove = () => {
    const g = two()
    const zoomTotal = Math.abs(Math.log(g.span / multi.startSpan))
    const twist = Math.abs(Math.atan2(Math.sin(g.angle - multi.startAngle), Math.cos(g.angle - multi.startAngle)))

    // Engage each component once it clearly starts; then follow it 1:1 from
    // that point on (no jump). Tilt is exclusive with zoom/rotate.
    if (!multi.zooming && !multi.tilting && zoomTotal > ZOOM_START) {
      multi.zooming = true
      multi.lastSpan = g.span
    }
    if (!multi.rotating && !multi.tilting && twist > ROTATE_START) {
      multi.rotating = true
      multi.lastAngle = g.angle
    }
    if (!multi.tilting && !multi.zooming && !multi.rotating) {
      const dya = g.a.y - g.a.sy, dyb = g.b.y - g.b.sy
      const dxa = g.a.x - g.a.sx, dxb = g.b.x - g.b.sx
      const sameDir = Math.sign(dya) === Math.sign(dyb)
      const vertical = Math.abs(dya) > 1.5 * Math.abs(dxa) && Math.abs(dyb) > 1.5 * Math.abs(dxb)
      if (sameDir && vertical && Math.abs(dya) > TILT_START && Math.abs(dyb) > TILT_START) {
        multi.tilting = true
        multi.lastMidY = g.my
      }
    }

    if (multi.tilting) {
      // Fingers up = tilt toward the horizon (more 3D), like Google Maps.
      mapCamera.transform({ dPolar: -(g.my - multi.lastMidY) * TILT_RATE, ax: 0, ay: 0, bx: 0, by: 0, anchor: false })
    } else {
      const factor = multi.zooming ? multi.lastSpan / g.span : 1
      const dAz = multi.rotating ? Math.atan2(Math.sin(g.angle - multi.lastAngle), Math.cos(g.angle - multi.lastAngle)) : 0
      // Two-finger drag also pans: the ground under the old midpoint follows the new one.
      mapCamera.transform({ factor, dAzimuth: dAz, ax: multi.lastMidX, ay: multi.lastMidY, bx: g.mx, by: g.my })
    }
    multi.lastSpan = g.span
    multi.lastAngle = g.angle
    multi.lastMidX = g.mx
    multi.lastMidY = g.my
  }

  const onUp = (e: PointerEvent) => {
    const p = pts.get(e.pointerId)
    if (!p) return
    e.stopPropagation()
    const now = e.timeStamp
    suppressClicksUntil = performance.now() + 700
    const { x, y } = local(e)

    if (mode === 'multi' && pts.size === 2) {
      const g = two()
      const quickTap =
        now - multi.startT < TWO_TAP_MAX_MS &&
        Math.hypot(g.a.x - g.a.sx, g.a.y - g.a.sy) < TWO_TAP_SLOP &&
        Math.hypot(g.b.x - g.b.sx, g.b.y - g.b.sy) < TWO_TAP_SLOP
      pts.delete(e.pointerId)
      if (quickTap) {
        // Keep holding the camera until the other finger lifts; the zoom animates meanwhile.
        mode = 'done'
        mapCamera.zoomStep(1 / ZOOM_STEP, g.mx, g.my)
      } else {
        // One finger stays down: continue as a pan from here (Google Maps behaviour).
        const rest = [...pts.values()][0]
        rest.sx = rest.x
        rest.sy = rest.y
        samples.length = 0
        mode = 'pan'
      }
      return
    }

    pts.delete(e.pointerId)
    if (pts.size > 0) return

    switch (mode) {
      case 'press':
        if (now - p.t < TAP_MAX_MS && !stoppedMotion) {
          // Maybe the first tap of a double-tap: wait before treating it as a tap.
          lastTap = { x, y, t: now }
          cancelPendingTap()
          tapTimer = window.setTimeout(() => {
            tapTimer = 0
            lastTap = null
            opts.onTap?.(x, y)
          }, DOUBLE_TAP_MS)
        }
        mapCamera.end()
        break
      case 'secondPress':
        lastTap = null
        mapCamera.end(false)
        mapCamera.zoomStep(ZOOM_STEP, quick.x, quick.y)
        break
      case 'pan': {
        const first = samples[0], last = samples[samples.length - 1]
        const dt = last && first ? last.t - first.t : 0
        const fresh = last && now - last.t < 60 // finger paused before lifting = no fling
        mapCamera.end(false)
        if (fresh && dt > 10) mapCamera.fling(x, y, (last.x - first.x) / dt, (last.y - first.y) / dt)
        else mapCamera.settle()
        break
      }
      default:
        mapCamera.end()
    }
    mode = 'idle'
  }

  const onCancel = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return
    pts.delete(e.pointerId)
    if (pts.size === 0) {
      mode = 'idle'
      mapCamera.end()
    }
  }

  // Taps are delivered through onTap; swallow the browser's synthetic click
  // after touches so pins don't also fire (keyboard clicks have detail 0).
  const onClick = (e: MouseEvent) => {
    if (performance.now() < suppressClicksUntil && e.detail !== 0) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // iOS Safari: block page pinch-zoom / bounce while gesturing on the map.
  const preventGesture = (e: Event) => e.preventDefault()

  if (import.meta.env.DEV) {
    // Inspection hook for the automated gesture tests.
    ;(window as unknown as { __kuGesture: unknown }).__kuGesture = { mode: () => mode, pointers: () => pts.size, multi }
  }

  el.addEventListener('pointerdown', onDown, { capture: true, passive: false })
  el.addEventListener('pointermove', onMove, { capture: true })
  el.addEventListener('pointerup', onUp, { capture: true })
  el.addEventListener('pointercancel', onCancel, { capture: true })
  el.addEventListener('click', onClick, { capture: true })
  document.addEventListener('gesturestart', preventGesture, { passive: false })
  document.addEventListener('gesturechange', preventGesture, { passive: false })
  document.addEventListener('gestureend', preventGesture, { passive: false })

  return () => {
    cancelPendingTap()
    el.removeEventListener('pointerdown', onDown, { capture: true })
    el.removeEventListener('pointermove', onMove, { capture: true })
    el.removeEventListener('pointerup', onUp, { capture: true })
    el.removeEventListener('pointercancel', onCancel, { capture: true })
    el.removeEventListener('click', onClick, { capture: true })
    document.removeEventListener('gesturestart', preventGesture)
    document.removeEventListener('gesturechange', preventGesture)
    document.removeEventListener('gestureend', preventGesture)
  }
}
