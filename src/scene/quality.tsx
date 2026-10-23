import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEBUG, perf } from '../lib/perf'
import { mapCamera } from './camera/mapCamera'

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
/** Resolution at rest: full device sharpness (phones up to 3x, desktops up to 2x). */
export const REST_DPR = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, COARSE ? 3 : 2)
/** Resolution while the map moves: phones drop to this; desktops keep full resolution unless frames are slow. */
const MOTION_DPR = COARSE ? Math.min(REST_DPR, 1.25) : REST_DPR
const MOTION_DPR_MIN = COARSE ? 0.75 : 1
/** Average display-frame interval (ms) above which the motion resolution steps down (≈ under 50 fps). */
const SLOW_FRAME = 20
/** How soon after the last moving frame the full-resolution frame is drawn (ms). */
const REST_AFTER = 40

/** Whether the camera is moving this frame (gesture, fling, fly-to, desktop drag/damping). */
export const motion = { moving: false }

/**
 * The current render resolution. The Canvas `dpr` prop reads it, because
 * react-three-fiber re-applies that prop on every re-render.
 */
export const resolution = {
  dpr: REST_DPR,
  apply: (_d: number) => {},
  /** Cap the resolution (automated tests on software GL). */
  cap(d: number) {
    perf.dprCap = d
    this.apply(Math.min(this.dpr, d))
  },
}

/**
 * Adaptive resolution. Rendering is on demand, so a sharp still image costs
 * nothing once drawn: at rest the map renders at REST_DPR. While the camera
 * moves it renders at MOTION_DPR, and a frame-time monitor steps that down
 * if the browser can't keep up with the display (the lower value is kept for
 * later gestures). About
 * 40 ms after motion ends, one frame is drawn at full resolution.
 * Also publishes `motion.moving` for other per-frame work (shadows).
 */
export function AdaptiveResolution() {
  const camera = useThree((s) => s.camera)
  const setDpr = useThree((s) => s.setDpr)
  const invalidate = useThree((s) => s.invalidate)
  const st = useMemo(
    () => ({ last: new THREE.Matrix4(), lastMove: 0, motionDpr: MOTION_DPR, sum: 0, n: 0, poll: 0, rest: false }),
    [],
  )

  useEffect(() => {
    resolution.apply = (d) => {
      resolution.dpr = Math.min(d, perf.dprCap)
      setDpr(resolution.dpr)
    }
    // A new cap from the debug overlay applies at the next frame.
    const off = perf.subscribe(() => {
      if (resolution.dpr !== Math.min(REST_DPR, perf.dprCap) && !motion.moving) {
        st.rest = true
        invalidate()
      }
    })
    return () => {
      off()
      resolution.apply = () => {}
      cancelAnimationFrame(st.poll)
    }
  }, [setDpr, st, invalidate])

  useFrame(() => {
    // Resolution changes resize (and so clear) the canvas; doing them here, at
    // the start of a frame, means the same frame redraws it: no blank flash.
    if (st.rest) {
      st.rest = false
      motion.moving = perf.stats.moving = false
      resolution.apply(REST_DPR)
    }
    camera.updateMatrixWorld()
    const moved = !camera.matrixWorld.equals(st.last)
    st.last.copy(camera.matrixWorld)
    if (!moved && !mapCamera.active) return
    st.lastMove = performance.now()
    if (motion.moving) return
    motion.moving = perf.stats.moving = true
    st.n = st.sum = 0
    resolution.apply(st.motionDpr)

    // While moving, a rAF loop (a) measures whether the browser keeps up with
    // the display: rAF slows down when the GPU or main thread falls behind,
    // while render frames only follow input; and (b) ends motion.
    let prev = performance.now()
    const tick = (now: number) => {
      const dt = now - prev
      prev = now
      if (now - st.lastMove > REST_AFTER && !mapCamera.active) {
        st.rest = true // switched to full resolution at the start of the next frame
        invalidate()
        return
      }
      if (dt < 100) {
        st.sum += dt
        st.n++
      }
      if (st.n >= 30) {
        const avg = st.sum / st.n
        perf.stats.rafMs = avg
        if (avg > SLOW_FRAME && st.motionDpr > MOTION_DPR_MIN) {
          st.motionDpr = Math.max(MOTION_DPR_MIN, st.motionDpr - 0.25)
          resolution.apply(st.motionDpr)
        }
        st.n = st.sum = 0
      }
      st.poll = requestAnimationFrame(tick)
    }
    st.poll = requestAnimationFrame(tick)
  })

  return null
}

/**
 * Records per-frame stats into `perf.stats`: CPU time (scene updates + render submission), DPR, draw calls, triangles.
 * Must be mounted first in the scene so its useFrame runs before the others.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const st = useMemo(() => ({ start: 0 }), [])

  useFrame(() => {
    st.start = performance.now()
  })

  useEffect(() => {
    const px = new Uint8Array(4)
    scene.onAfterRender = () => {
      if (perf.syncGpu) {
        const ctx = gl.getContext()
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
      }
      const s = perf.stats
      s.cpuMs = performance.now() - st.start
      s.cpuTotal += s.cpuMs
      s.calls = gl.info.render.calls
      s.triangles = gl.info.render.triangles
      s.dpr = gl.getPixelRatio()
      s.frames++
    }
    if (import.meta.env.DEV || DEBUG) (window as unknown as { __kuPerf: typeof perf }).__kuPerf = perf
    return () => {
      scene.onAfterRender = () => {}
    }
  }, [gl, scene, st])

  return null
}
