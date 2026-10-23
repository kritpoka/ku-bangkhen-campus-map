import type { MapCamera } from './camera/mapCamera'

/**
 * The UI shell's handle on the map camera. It has no three.js dependency, so
 * the shell (header, search, panels) can load and render before the 3D scene
 * chunk arrives; the scene connects the real controller when it mounts.
 */
type Listener = (azimuth: number, polar: number) => void

let impl: MapCamera | null = null
const listeners = new Set<Listener>()
const readyListeners = new Set<() => void>()
let last: [number, number] | null = null

export const mapApi = {
  connect(camera: MapCamera) {
    impl = camera
    readyListeners.forEach((f) => f())
  },
  disconnect() {
    impl = null
  },
  /** True once the scene is mounted and the campus is framed. */
  get ready() {
    return !!impl?.ready && !!impl.home
  },
  onReady(f: () => void) {
    readyListeners.add(f)
    return () => void readyListeners.delete(f)
  },
  /** Current camera distance (m); Infinity before the scene is ready. */
  distance() {
    return impl?.ready ? impl.read().distance : Infinity
  },
  zoomStep: (factor: number) => impl?.zoomStep(factor),
  goHome: () => impl?.goHome(),
  resetBearing: () => impl?.resetBearing(),
  /** Fly so scene point (x, z) ends up at screen point (sx, sy). */
  flyTo: (x: number, z: number, opts: { distance: number; sx?: number; sy?: number }) => impl?.flyToXZ(x, z, opts),
  /** Called by the camera whenever bearing/tilt change (drives the compass). */
  notify(azimuth: number, polar: number) {
    last = [azimuth, polar]
    listeners.forEach((l) => l(azimuth, polar))
  },
  subscribe(l: Listener) {
    listeners.add(l)
    if (last) l(last[0], last[1])
    return () => void listeners.delete(l)
  },
}
