import * as THREE from 'three'

/**
 * Map-style camera model shared by touch gestures, animations (fly-to, zoom
 * steps, compass) and UI buttons. The camera itself is the source of truth:
 * every operation reads the current orbit state from the camera + target and
 * writes it back, so desktop OrbitControls and this controller never disagree.
 *
 * Orbit parameters follow OrbitControls: `azimuth` is the camera's angle around
 * +Y measured from +Z (0 = camera south of target, so north is up on screen),
 * and `polar` is the angle from +Y (0 = looking straight down).
 */
export interface OrbitState {
  target: THREE.Vector3
  distance: number
  azimuth: number
  polar: number
}

export interface CameraLimits {
  minDistance: number
  maxDistance: number
  minPolar: number
  maxPolar: number
  /** Allowed target area (scene x/z). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

interface Controls {
  target: THREE.Vector3
  enabled: boolean
  update(): boolean | void
}

type Listener = (azimuth: number, polar: number) => void

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Rubber-band resistance for increments that push further past a limit. */
function resistance(over: number, scale: number) {
  return over <= 0 ? 1 : 1 / (1 + over / scale) ** 2
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

class MapCamera {
  private camera: THREE.PerspectiveCamera | null = null
  private controls: Controls | null = null
  private invalidate: () => void = () => {}
  private getSize: () => { width: number; height: number } = () => ({ width: 1, height: 1 })
  limits: CameraLimits = {
    minDistance: 90,
    maxDistance: 5000,
    minPolar: 0.6,
    maxPolar: 1.1,
    bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 },
  }
  /** Default tilt used by "reset" actions (compass, home). */
  defaultPolar = 0.84
  /** The framed overview of the whole campus, set by the scene on resize. */
  home: OrbitState | null = null

  /** True while touch gestures, flings or animations own the camera. */
  get active() {
    return this.holds > 0 || this.anim !== null
  }

  // Scratch objects: no per-frame allocations in the hot paths.
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()
  private tmpC = new THREE.Vector3()
  /** Only for read(); the others hold ground points across read() calls. */
  private tmpRead = new THREE.Vector3()
  private sph = new THREE.Spherical()
  private holds = 0
  private anim: { cancel: () => void } | null = null
  private listeners = new Set<Listener>()
  private lastPublished = { azimuth: NaN, polar: NaN }

  attach(opts: {
    camera: THREE.PerspectiveCamera
    controls: Controls
    invalidate: () => void
    getSize: () => { width: number; height: number }
  }) {
    this.camera = opts.camera
    this.controls = opts.controls
    this.invalidate = opts.invalidate
    this.getSize = opts.getSize
  }

  detach() {
    this.cancelAnimation()
    this.camera = null
    this.controls = null
  }

  get ready() {
    return !!this.camera && !!this.controls
  }

  // ─── State ─────────────────────────────────────────────────────────────

  read(out?: OrbitState): OrbitState {
    const cam = this.camera!, target = this.controls!.target
    this.sph.setFromVector3(this.tmpRead.subVectors(cam.position, target))
    const s = out ?? { target: new THREE.Vector3(), distance: 0, azimuth: 0, polar: 0 }
    s.target.copy(target)
    s.distance = this.sph.radius
    s.azimuth = this.sph.theta
    s.polar = this.sph.phi
    return s
  }

  write(s: OrbitState) {
    const cam = this.camera!, target = this.controls!.target
    target.set(s.target.x, 0, s.target.z)
    this.sph.set(s.distance, s.polar, s.azimuth)
    cam.position.setFromSpherical(this.sph).add(target)
    cam.lookAt(target)
    cam.updateMatrixWorld()
    this.invalidate()
  }

  /** Called every rendered frame by the scene so UI (compass) can follow the bearing. */
  publish() {
    if (!this.ready) return
    const { azimuth, polar } = this.read(this.scratchState)
    if (Math.abs(azimuth - this.lastPublished.azimuth) < 1e-4 && Math.abs(polar - this.lastPublished.polar) < 1e-4) return
    this.lastPublished.azimuth = azimuth
    this.lastPublished.polar = polar
    for (const l of this.listeners) l(azimuth, polar)
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    if (!Number.isNaN(this.lastPublished.azimuth)) l(this.lastPublished.azimuth, this.lastPublished.polar)
    return () => void this.listeners.delete(l)
  }

  private scratchState: OrbitState = { target: new THREE.Vector3(), distance: 0, azimuth: 0, polar: 0 }
  private work: OrbitState = { target: new THREE.Vector3(), distance: 0, azimuth: 0, polar: 0 }

  /** World point on the ground plane under a screen point (CSS px), or null. */
  groundAt(sx: number, sy: number, out: THREE.Vector3): THREE.Vector3 | null {
    const cam = this.camera!
    const { width, height } = this.getSize()
    this.ndc.set((sx / width) * 2 - 1, -(sy / height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, cam)
    return this.raycaster.ray.intersectPlane(this.plane, out)
  }

  // ─── Interaction lifecycle ─────────────────────────────────────────────

  /** A gesture takes the camera: stop animations and pause OrbitControls. */
  begin() {
    this.cancelAnimation()
    this.holds++
    if (this.controls) this.controls.enabled = false
  }

  /** Gesture finished: optionally spring back into limits, then hand back to OrbitControls. */
  end(settle = true) {
    this.holds = Math.max(0, this.holds - 1)
    if (this.holds > 0) return
    if (settle) this.settle()
    else this.release()
  }

  private release() {
    if (this.active || !this.controls) return
    this.controls.enabled = true
    this.controls.update()
    this.invalidate()
  }

  cancelAnimation() {
    this.anim?.cancel()
    this.anim = null
  }

  // ─── Direct manipulation (used inside gestures) ────────────────────────

  /** Drag the map so the ground under (x0,y0) ends up under (x1,y1). */
  panScreen(x0: number, y0: number, x1: number, y1: number) {
    const a = this.groundAt(x0, y0, this.tmpA)
    const b = a && this.groundAt(x1, y1, this.tmpB)
    if (!a || !b) return
    const s = this.read(this.work)
    const dx = a.x - b.x, dz = a.z - b.z
    const k = resistance(this.boundsOverflow(s.target.x + dx, s.target.z + dz) - this.boundsOverflow(s.target.x, s.target.z), 40)
    s.target.x += dx * k
    s.target.z += dz * k
    this.write(s)
  }

  /**
   * Combined pinch / twist / tilt step anchored at a screen point: the ground
   * under (ax, ay) stays under (bx, by) after zooming by `factor` (distance
   * multiplier) and rotating by `dAzimuth`. Tilt (`dPolar`) pivots on the target.
   */
  transform(opts: { factor?: number; dAzimuth?: number; dPolar?: number; ax: number; ay: number; bx: number; by: number; anchor?: boolean }) {
    const { factor = 1, dAzimuth = 0, dPolar = 0, ax, ay, bx, by, anchor = true } = opts
    const before = anchor ? this.groundAt(ax, ay, this.tmpC) : null
    const s = this.read(this.work)
    if (factor !== 1) s.distance = this.softDistance(s.distance, factor)
    s.azimuth += dAzimuth
    if (dPolar) s.polar = this.softPolar(s.polar, dPolar)
    this.write(s)
    if (before) {
      const after = this.groundAt(bx, by, this.tmpB)
      if (after) {
        s.target.x += before.x - after.x
        s.target.z += before.z - after.z
        this.write(s)
      }
    }
  }

  private softDistance(d: number, factor: number) {
    const { minDistance: lo, maxDistance: hi } = this.limits
    let next = d * factor
    // Past a limit, further zoom in that direction meets growing resistance.
    if (next > hi && factor > 1) next = d * factor ** resistance(Math.log(d / hi), 0.12)
    if (next < lo && factor < 1) next = d * factor ** resistance(Math.log(lo / d), 0.12)
    return next
  }

  private softPolar(p: number, dp: number) {
    const { minPolar: lo, maxPolar: hi } = this.limits
    if ((p > hi && dp > 0) || (p < lo && dp < 0)) dp *= resistance(p > hi ? p - hi : lo - p, 0.08)
    return Math.min(Math.PI / 2 - 0.05, Math.max(0.05, p + dp))
  }

  private boundsOverflow(x: number, z: number) {
    const b = this.limits.bounds
    return Math.max(0, b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ)
  }

  // ─── Animations ────────────────────────────────────────────────────────

  /**
   * Run `step(eased, previousEased)` every animation frame for `duration` ms.
   * Holds the camera for the duration; reduced motion jumps to the end.
   */
  private run(duration: number, ease: (t: number) => number, step: (k: number, prev: number) => void, done?: () => void) {
    this.cancelAnimation()
    if (this.controls) this.controls.enabled = false
    if (reducedMotion() || duration <= 0) {
      step(1, 0)
      this.anim = null
      done ? done() : this.release()
      return
    }
    const start = performance.now()
    let prev = 0
    let raf = 0
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration)
      const k = ease(t)
      step(k, prev)
      prev = k
      if (t < 1) raf = requestAnimationFrame(tick)
      else {
        this.anim = null
        done ? done() : this.release()
      }
    }
    this.anim = { cancel: () => cancelAnimationFrame(raf) }
    raf = requestAnimationFrame(tick)
  }

  /** Zoom by `factor` (distance multiplier) keeping the ground under (sx, sy) fixed. */
  zoomStep(factor: number, sx?: number, sy?: number, duration = 280) {
    if (!this.ready) return
    const { width, height } = this.getSize()
    const x = sx ?? width / 2, y = sy ?? height / 2
    const { minDistance, maxDistance } = this.limits
    const d0 = this.read(this.work).distance
    const total = Math.min(maxDistance, Math.max(minDistance, d0 * factor)) / d0
    this.run(duration, easeOutCubic, (k, prev) => {
      const f = total ** k / total ** prev
      this.transform({ factor: f, ax: x, ay: y, bx: x, by: y })
    })
  }

  /** Animate to an absolute orbit state (any subset), interpolating along a gentle arc. */
  animateTo(to: Partial<OrbitState>, duration = 900, done?: () => void) {
    if (!this.ready) return
    const from = this.read()
    const target = to.target ? new THREE.Vector3(to.target.x, 0, to.target.z) : from.target.clone()
    const d1 = to.distance ?? from.distance
    const az1 = from.azimuth + wrapAngle((to.azimuth ?? from.azimuth) - from.azimuth)
    const p1 = to.polar ?? from.polar
    // Pull back mid-flight when travelling far relative to the view size.
    const travel = from.target.distanceTo(target)
    const bump = Math.min(0.8, travel / (2.5 * Math.max(from.distance, d1)))
    const s: OrbitState = { target: new THREE.Vector3(), distance: 0, azimuth: 0, polar: 0 }
    this.run(
      duration,
      easeInOutCubic,
      (k) => {
        s.target.lerpVectors(from.target, target, k)
        s.distance = Math.exp(Math.log(from.distance) + (Math.log(d1) - Math.log(from.distance)) * k) * (1 + bump * Math.sin(Math.PI * k))
        s.azimuth = from.azimuth + (az1 - from.azimuth) * k
        s.polar = from.polar + (p1 - from.polar) * k
        this.write(s)
      },
      done,
    )
  }

  /**
   * Fly so that `point` ends up at screen position (sx, sy) at the given
   * distance, keeping the current bearing and restoring the default tilt.
   */
  flyTo(point: THREE.Vector3, opts: { distance: number; sx?: number; sy?: number; duration?: number }) {
    if (!this.ready) return
    const { width, height } = this.getSize()
    const sx = opts.sx ?? width / 2, sy = opts.sy ?? height / 2
    const cur = this.read()
    const end: OrbitState = { target: point.clone().setY(0), distance: opts.distance, azimuth: cur.azimuth, polar: this.defaultPolar }
    // Solve for the target that puts `point` under (sx, sy): evaluate the end
    // pose on a scratch camera and shift by the residual (two passes converge).
    const cam = this.camera!.clone()
    const probe = new THREE.Vector3()
    for (let i = 0; i < 2; i++) {
      this.sph.set(end.distance, end.polar, end.azimuth)
      cam.position.setFromSpherical(this.sph).add(end.target)
      cam.lookAt(end.target)
      cam.updateMatrixWorld()
      this.ndc.set((sx / width) * 2 - 1, -(sy / height) * 2 + 1)
      this.raycaster.setFromCamera(this.ndc, cam)
      if (!this.raycaster.ray.intersectPlane(this.plane, probe)) break
      end.target.x += point.x - probe.x
      end.target.z += point.z - probe.z
    }
    this.animateTo(end, opts.duration ?? 950)
  }

  /** Back to north-up and the default tilt, around the current centre. */
  resetBearing() {
    this.animateTo({ azimuth: 0, polar: this.defaultPolar }, 450)
  }

  /** Back to the framed overview of the whole campus. */
  goHome() {
    if (this.home) this.animateTo(this.home, 900)
  }

  // ─── Momentum & settling ───────────────────────────────────────────────

  /**
   * Keep gliding after a fling. Velocity is in screen px/ms; it decays with a
   * ~325 ms time constant (iOS scroll feel), then the camera settles.
   */
  fling(x: number, y: number, vx: number, vy: number) {
    if (!this.ready || Math.hypot(vx, vy) < 0.15) return this.settle()
    this.cancelAnimation()
    if (this.controls) this.controls.enabled = false
    let last = performance.now()
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const dt = Math.min(48, now - last)
      last = now
      const decay = Math.exp(-dt / 325)
      vx *= decay
      vy *= decay
      // Fling past the bounds: brake hard so it doesn't sail away.
      if (this.boundsOverflow(this.controls!.target.x, this.controls!.target.z) > 0) {
        vx *= 0.75
        vy *= 0.75
      }
      this.panScreen(x, y, x + vx * dt, y + vy * dt)
      if (Math.hypot(vx, vy) > 0.02) raf = requestAnimationFrame(tick)
      else {
        this.anim = null
        this.settle()
      }
    }
    this.anim = { cancel: () => cancelAnimationFrame(raf) }
    raf = requestAnimationFrame(tick)
  }

  /** Spring back inside the pan bounds, zoom range and tilt range, if outside. */
  settle() {
    if (!this.ready) return
    const s = this.read()
    const { bounds: b, minDistance, maxDistance, minPolar, maxPolar } = this.limits
    const to: OrbitState = {
      target: new THREE.Vector3(
        THREE.MathUtils.clamp(s.target.x, b.minX, b.maxX),
        0,
        THREE.MathUtils.clamp(s.target.z, b.minZ, b.maxZ),
      ),
      distance: THREE.MathUtils.clamp(s.distance, minDistance, maxDistance),
      azimuth: s.azimuth,
      polar: THREE.MathUtils.clamp(s.polar, minPolar, maxPolar),
    }
    const off =
      to.target.distanceTo(s.target) > 0.01 || Math.abs(to.distance - s.distance) > 0.01 || Math.abs(to.polar - s.polar) > 1e-4
    if (!off) return this.release()
    const from = { ...s, target: s.target.clone() }
    const cur: OrbitState = { target: new THREE.Vector3(), distance: 0, azimuth: s.azimuth, polar: 0 }
    this.run(280, easeOutCubic, (k) => {
      cur.target.lerpVectors(from.target, to.target, k)
      cur.distance = from.distance + (to.distance - from.distance) * k
      cur.polar = from.polar + (to.polar - from.polar) * k
      this.write(cur)
    })
  }
}

export const mapCamera = new MapCamera()
