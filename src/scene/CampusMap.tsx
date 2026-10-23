import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { campusBoundary } from '../data/osm'
import { landmarks } from '../data/landmarks'
import { BaseLayers } from './BaseLayers'
import { LandmarkModels, buildLandmarkModels } from './LandmarkModels'
import { PinProjector } from './Pins'
import { ShuttleLayer } from './ShuttleLayer'
import { StopProjector } from './StopProjector'
import { pinBridge } from './pinBridge'
import { stopBridge } from './stopBridge'
import { mapCamera } from './camera/mapCamera'
import { Trees } from './Trees'
import { palette } from './palette'
import { pinHeights } from './pinAnchors'
import { polygonsOf } from './geometry'

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
    return () => mapCamera.detach()
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
  const light = useRef<THREE.DirectionalLight>(null)
  const lastHalf = useRef(0)
  const lastTarget = useRef(new THREE.Vector3(NaN, NaN, NaN))
  const { camera, invalidate } = useThree()
  useFrame(() => {
    const l = light.current, c = controls.current
    if (!l || !c) return
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
      castShadow
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-near={10}
      shadow-camera-far={3500}
      shadow-bias={-0.0003}
      shadow-normalBias={0.15}
      shadow-radius={1}
    />
  )
}

function Scene({ shuttleOn, activeLine }: CampusMapProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const models = useMemo(() => buildLandmarkModels(), [])
  const heights = useMemo(() => pinHeights(landmarks, models.tops), [models])

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <hemisphereLight args={['#ffffff', '#d4ddd6', 1.73]} />
      <Sun controls={controls} />
      <BaseLayers />
      <Trees shadows />
      <LandmarkModels models={models} />
      <PinProjector landmarks={landmarks} heights={heights} />
      {shuttleOn && <ShuttleLayer activeLine={activeLine} />}
      {shuttleOn && <StopProjector />}
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
    </>
  )
}

interface CampusMapProps {
  shuttleOn: boolean
  activeLine: string | null
}

export function CampusMap(props: CampusMapProps) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      frameloop="demand"
      dpr={[1, isCoarse ? 1.5 : 2]}
      camera={{ fov: VFOV, near: 4, far: 20000, position: [0, 2000, 2000] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
    >
      <Scene {...props} />
    </Canvas>
  )
}
