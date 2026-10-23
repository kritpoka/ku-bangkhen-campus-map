import { useSyncExternalStore } from 'react'

/**
 * Rendering stats and debug switches shared by the scene (which writes the
 * stats) and the `?debug=1` overlay (which reads them and flips the switches).
 * No three.js here, so the UI shell can import it.
 */

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** `?debug=1` shows the performance overlay. */
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1'

export interface PerfFlags {
  shadows: boolean
  blur: boolean
  pins: boolean
  stops: boolean
  trees: boolean
}

export const perf = {
  /** Latest numbers (updated by the scene's probe; read a few times a second). */
  stats: {
    /** Average display-frame (rAF) interval during the latest motion (ms): 16.7 = keeping up at 60 Hz. */
    rafMs: 0,
    /** CPU time of the last frame: scene updates + render submission (ms). */
    cpuMs: 0,
    dpr: 1,
    calls: 0,
    triangles: 0,
    moving: false,
    /** Frames rendered since load (on-demand rendering: idle = no frames). */
    frames: 0,
    /** Sum of per-frame CPU times since load (ms), for averages over a span of frames. */
    cpuTotal: 0,
  },
  /**
   * Profiling only: wait for the GPU after each frame (1-pixel readPixels), so
   * cpuMs includes GPU time. Stalls the pipeline, so never on in normal use.
   */
  syncGpu: false,
  /** Upper bound on the render resolution (automated tests on software GL set it low). */
  dprCap: Infinity,
  /** Backdrop blur is off by default on touch devices (see index.css). */
  flags: { shadows: true, blur: !COARSE, pins: true, stops: true, trees: true } as PerfFlags,
  listeners: new Set<() => void>(),
  setFlag(name: keyof PerfFlags, on: boolean) {
    this.flags = { ...this.flags, [name]: on }
    if (name === 'blur') document.documentElement.classList.toggle('no-backdrop-blur', !on)
    this.listeners.forEach((f) => f())
  },
  /** Overlay control: cap the resolution (e.g. 2 instead of a phone's 3) to compare sharpness and cost. */
  setDprCap(d: number) {
    this.dprCap = d
    this.listeners.forEach((f) => f())
  },
  subscribe(f: () => void) {
    this.listeners.add(f)
    return () => void this.listeners.delete(f)
  },
}

if (COARSE && typeof document !== 'undefined') document.documentElement.classList.add('no-backdrop-blur')

/** Debug switches (all on unless flipped in the `?debug=1` overlay). */
export function usePerfFlags() {
  return useSyncExternalStore((f) => perf.subscribe(f), () => perf.flags)
}
