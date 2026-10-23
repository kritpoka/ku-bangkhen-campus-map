import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { campusBoundary } from '../data/osm'
import { landmarks } from '../data/landmarks'
import { BaseLayers, BuildingBlocks } from './BaseLayers'
import { LandmarkModels, buildLandmarkModels } from './LandmarkModels'
import { PinProjector } from './Pins'
import { ShuttleLayer } from './ShuttleLayer'
import { StopProjector } from './StopProjector'
import { pinBridge } from './pinBridge'
import { stopBridge } from './stopBridge'
import { mapCamera } from './camera/mapCamera'
import { attachTouchGestures } from './camera/touchGestures'
import { mapApi } from './mapApi'
import { Trees } from './Trees'
import { palette } from './palette'
import { pinHeights } from './pinAnchors'
import { polygonsOf } from './geometry'
import { usePerfFlags } from '../lib/perf'
import { AdaptiveResolution, PerfProbe, motion, resolution } from './quality'

/** Campus extent in scene coordinates (x east, z south), from the OSM boundary. */
const CAMPUS = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const rings of polygonsOf(campusBoundary.geometry))
    for (const [e, n] of rings[0]) {
      minX = Math.min(minX, e); maxX = Math.max(maxX, e)
      minZ = Math.min(minZ, -n); maxZ = Math.max(maxZ, -n)
    }
  return {
    minX, maxX, minZ, maxZ,
    center: new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
    radius: Math.hypot(maxX - minX, maxZ - minZ) / 2,
  }
})()

/** Camera target may drift this far (m) past the campus edge. */
const PAN_MARGIN = 120
/** Default view: north up, ~42° above the ground (near-isometric). */
const DEFAULT_ELEVATION = THREE.MathUtils.degToRad(42)
const DEFAULT_POLAR = Math.PI / 2 - DEFAULT_ELEVATION
/** Users may tilt between ~54° (more top-down) and ~28° above the ground. */
const MIN_POLAR = THREE.MathUtils.degToRad(90 - 54)
const MAX_POLAR = THREE.MathUtils.degToRad(90 - 28)
const VFOV = 32

/** Distance at which the whole campus fits the viewport at the given aspect. */
export function fitDistance(aspect: number) {
  const v = THREE.MathUtils.degToRad(VFOV)
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect)
  // The campus is diamond-shaped, so its bounding box corners are empty. On
  // portrait screens, fill the width and let the top and bottom tips crop
  // slightly rather than shrinking the whole campus to a speck.
  const r = CAMPUS.radius * (aspect < 1 ? 0.6 : 0.62)
  return r / Math.sin(Math.min(v, h) / 2)
}

const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, size, invalidate, get } = useThree()
  const fitted = useRef(false)

  // Hand the camera to the shared map-camera controller (touch gestures, animations, UI).
  useEffect(() => {
    const c = controls.current
    if (!c) return
    mapCamera.attach({ camera: camera as THREE.PerspectiveCamera, controls: c, invalidate, getSize: () => get().size })
    mapCamera.defaultPolar = DEFAULT_POLAR
    mapApi.connect(mapCamera)
    return () => {
      mapApi.disconnect()
      mapCamera.detach()
    }
  }, [camera, controls, invalidate, get])

  // Frame the campus on first load; refresh limits whenever the viewport changes.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const d = fitDistance(size.width / size.height)
    c.maxDistance = d * 1.35
    mapCamera.limits = {
      minDistance: c.minDistance,
      maxDistance: c.maxDistance,
      minPolar: MIN_POLAR,
      maxPolar: MAX_POLAR,
      bounds: {
        minX: CAMPUS.minX - PAN_MARGIN,
        maxX: CAMPUS.maxX + PAN_MARGIN,
        minZ: CAMPUS.minZ - PAN_MARGIN,
        maxZ: CAMPUS.maxZ + PAN_MARGIN,
      },
    }
    mapCamera.home = { target: CAMPUS.center.clone(), distance: d, azimuth: 0, polar: DEFAULT_POLAR }
    pinBridge.fitDistance = d
    pinBridge.touch()
    if (!fitted.current) {
      mapCamera.write(mapCamera.home)
      c.update()
      fitted.current = true
    }
    invalidate()
  }, [size.width, size.height, camera, controls, invalidate])

  // Dev-only handle for scripted screenshots: window.__kuMap.view(x, z, distance, azimuth?, polar?).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __kuMap: unknown }).__kuMap = {
      fit: () => fitDistance(size.width / size.height),
      three: get,
      camera: mapCamera,
      pins: pinBridge,
      stops: stopBridge,
      capDpr: (d: number) => resolution.cap(d),
      view(x: number, z: number, d: number, az = 0, polar = DEFAULT_POLAR) {
        mapCamera.write({ target: new THREE.Vector3(x, 0, z), distance: d, azimuth: az, polar })
        controls.current?.update()
      },
    }
  }, [camera, controls, invalidate, size.width, size.height, get])

  // Keep the target over campus (desktop controls; touch gestures rubber-band
  // and settle on their own). Runs only while rendering (frameloop="demand").
  useFrame(() => {
    mapCamera.publish()
    const c = controls.current
    if (!c || mapCamera.active) return
    const t = c.target
    const cx = THREE.MathUtils.clamp(t.x, CAMPUS.minX - PAN_MARGIN, CAMPUS.maxX + PAN_MARGIN)
    const cz = THREE.MathUtils.clamp(t.z, CAMPUS.minZ - PAN_MARGIN, CAMPUS.maxZ + PAN_MARGIN)
    if (cx !== t.x || cz !== t.z || t.y !== 0) {
      c.object.position.x += cx - t.x
      c.object.position.z += cz - t.z
      t.set(cx, 0, cz)
    }
  })
  return null
}

/**
 * Sun direction (toward the light) and a shadow frustum that follows the view.
 * Light from the west so shadows fall to the right of buildings in the default
 * south-facing view, like the reference. Lighting is tuned for no tone mapping:
 * lit roofs land at ~1.0 (true palette colors) and shade at ~0.55, for crisp,
 * readable shadows. Three's Lambert divides light by PI, hence hemisphere
 * 0.55π and sun 0.45π / sin(elev).
 */
const SUN = new THREE.Vector3(-1, 1.1, 0.15).normalize()

function Sun({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const flags = usePerfFlags()
  const light = useRef<THREE.DirectionalLight>(null)
  const lastHalf = useRef(0)
  const lastTarget = useRef(new THREE.Vector3(NaN, NaN, NaN))
  const { camera, invalidate, gl } = useThree()

  // The shadow map is redrawn only at rest (see below), not every frame.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => void (gl.shadowMap.autoUpdate = true)
  }, [gl])

  useFrame(() => {
    const l = light.current, c = controls.current
    if (!l || !c) return
    // While the map moves, keep the sun and its shadow map where they are: the
    // shadows stay correct in world space, and frames skip the shadow pass (13
    // draw calls over every building and tree). At rest it follows the view again.
    if (motion.moving) return
    gl.shadowMap.needsUpdate = true
    const t = c.target
    // This may run before the controls update this frame; if the sun had to
    // move, render one more frame so the resting view gets correct shadows.
    if (!lastTarget.current.equals(t)) {
      lastTarget.current.copy(t)
      invalidate()
    }
    l.target.position.copy(t)
    l.position.copy(t).addScaledVector(SUN, 1500)
    l.target.updateMatrixWorld()
    // Tighter shadow box when zoomed in = sharper shadows for the same map size.
    const dist = camera.position.distanceTo(t)
    const half = THREE.MathUtils.clamp(dist * 0.6, 160, 1300)
    if (Math.abs(half - lastHalf.current) / half > 0.08) {
      const cam = l.shadow.camera
      cam.left = cam.bottom = -half
      cam.right = cam.top = half
      cam.updateProjectionMatrix()
      lastHalf.current = half
      invalidate()
    }
  })
  const mapSize = isCoarse ? 2048 : 4096
  return (
    <directionalLight
      ref={light}
      intensity={1.92}
      color="#fffaf0"
      castShadow={flags.shadows}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-near={10}
      shadow-camera-far={3500}
      shadow-bias={-0.0003}
      shadow-normalBias={0.15}
      shadow-radius={1}
    />
  )
}

/**
 * Build the scene in stages, one per task, so no single main-thread task is
 * long: ground/roads/buildings first, then trees, then detailed landmarks and
 * pins. Each stage yields to the browser before the next.
 */
function useStage(max: number) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (stage >= max) return
    const id = window.setTimeout(() => setStage((s) => s + 1), 0)
    return () => window.clearTimeout(id)
  }, [stage, max])
  return stage
}

/**
 * Compile every material in the scene once the last build stage is in, so
 * objects that start off-screen don't compile shaders mid-gesture when a pan
 * first brings them into view.
 */
function Precompile({ ready }: { ready: boolean }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => void gl.compileAsync(scene, camera).catch(() => {}), 0)
    return () => window.clearTimeout(id)
  }, [ready, gl, scene, camera])
  return null
}

function Scene({ shuttleOn, activeLine }: CampusMapProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const stage = useStage(4)
  const modelsDue = stage >= 4
  const models = useMemo(() => (modelsDue ? buildLandmarkModels() : null), [modelsDue])
  const heights = useMemo(() => (models ? pinHeights(landmarks, models.tops) : null), [models])
  const flags = usePerfFlags()

  return (
    <>
      <PerfProbe />
      <AdaptiveResolution />
      <color attach="background" args={[palette.sky]} />
      <hemisphereLight args={['#ffffff', '#d4ddd6', 1.73]} />
      <Sun controls={controls} />
      <BaseLayers />
      {stage >= 1 && <BuildingBlocks inside />}
      {stage >= 2 && <BuildingBlocks inside={false} />}
      {stage >= 3 && flags.trees && <Trees shadows />}
      {models && <LandmarkModels models={models} />}
      {heights && flags.pins && <PinProjector landmarks={landmarks} heights={heights} />}
      {shuttleOn && <ShuttleLayer activeLine={activeLine} />}
      {shuttleOn && flags.stops && <StopProjector />}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.09}
        minDistance={90}
        minPolarAngle={MIN_POLAR}
        maxPolarAngle={MAX_POLAR}
        screenSpacePanning={false}
        // Desktop only: touch input is handled by camera/touchGestures.ts and never reaches these controls.
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
      />
      <CameraRig controls={controls} />
      <Precompile ready={!!heights} />
    </>
  )
}

interface CampusMapProps {
  shuttleOn: boolean
  activeLine: string | null
  /** Element that receives Google Maps–style touch gestures (the map container). */
  gestureTarget?: React.RefObject<HTMLElement | null>
  onTap?: (x: number, y: number) => void
}

export function CampusMap({ gestureTarget, onTap, ...props }: CampusMapProps) {
  const tapRef = useRef(onTap)
  tapRef.current = onTap
  useEffect(() => {
    const el = gestureTarget?.current
    if (!el) return
    return attachTouchGestures(el, { onTap: (x, y) => tapRef.current?.(x, y) })
  }, [gestureTarget])
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      frameloop="demand"
      dpr={resolution.dpr}
      camera={{ fov: VFOV, near: 4, far: 20000, position: [0, 2000, 2000] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
    >
      <Scene {...props} />
    </Canvas>
  )
}
