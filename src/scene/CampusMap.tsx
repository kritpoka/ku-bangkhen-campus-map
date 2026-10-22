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
/** Default view direction: from the south-south-east, about 50° above the horizon. */
const VIEW_DIR = new THREE.Vector3(Math.sin(0.35), 1.15, Math.cos(0.35)).normalize()
const VFOV = 32

/** Distance at which the whole campus fits the viewport at the given aspect. */
export function fitDistance(aspect: number) {
  const v = THREE.MathUtils.degToRad(VFOV)
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect)
  // The campus is diamond-shaped, so its bounding box corners are empty. On
  // portrait screens, fill the width and let the top and bottom tips crop
  // slightly rather than shrinking the whole campus to a speck.
  const r = CAMPUS.radius * (aspect < 1 ? 0.6 : 0.78)
  return r / Math.sin(Math.min(v, h) / 2)
}

const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, size, invalidate, get } = useThree()
  const fitted = useRef(false)

  // Frame the campus on first load and whenever the viewport aspect changes a lot.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const d = fitDistance(size.width / size.height)
    c.maxDistance = d * 1.35
    if (!fitted.current) {
      c.target.copy(CAMPUS.center)
      camera.position.copy(CAMPUS.center).addScaledVector(VIEW_DIR, d)
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
      view(x: number, z: number, d: number, az = 0.35, polar = 0.9) {
        const c = controls.current
        if (!c) return
        c.target.set(x, 0, z)
        camera.position.set(x + d * Math.sin(polar) * Math.sin(az), d * Math.cos(polar), z + d * Math.sin(polar) * Math.cos(az))
        c.update()
        invalidate()
      },
    }
  }, [camera, controls, invalidate, size.width, size.height, get])

  // Keep the target over campus. Runs only while rendering (frameloop="demand").
  useFrame(() => {
    const c = controls.current
    if (!c) return
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
 * lit roofs land at ~1.0 (true palette colors) and shade at ~0.7. Three's
 * Lambert divides light by PI, hence hemisphere 0.7π and sun 0.3π / sin(elev).
 */
const SUN = new THREE.Vector3(-1, 1.1, 0.15).normalize()

function Sun({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const lastHalf = useRef(0)
  const { camera } = useThree()
  useFrame(() => {
    const l = light.current, c = controls.current
    if (!l || !c) return
    const t = c.target
    l.target.position.copy(t)
    l.position.copy(t).addScaledVector(SUN, 1500)
    l.target.updateMatrixWorld()
    // Tighter shadow box when zoomed in = sharper shadows for the same map size.
    const dist = camera.position.distanceTo(t)
    const half = THREE.MathUtils.clamp(dist * 0.7, 220, 1300)
    if (Math.abs(half - lastHalf.current) / half > 0.08) {
      const cam = l.shadow.camera
      cam.left = cam.bottom = -half
      cam.right = cam.top = half
      cam.updateProjectionMatrix()
      lastHalf.current = half
    }
  })
  const mapSize = isCoarse ? 2048 : 4096
  return (
    <directionalLight
      ref={light}
      intensity={1.3}
      color="#fffaf0"
      castShadow
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-near={10}
      shadow-camera-far={3500}
      shadow-bias={-0.0003}
      shadow-normalBias={0.15}
      shadow-radius={2.5}
    />
  )
}

function Scene() {
  const controls = useRef<OrbitControlsImpl>(null)
  const models = useMemo(() => buildLandmarkModels(), [])
  const heights = useMemo(() => pinHeights(landmarks, models.tops), [models])

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <hemisphereLight args={['#ffffff', '#d4ddd6', 2.2]} />
      <Sun controls={controls} />
      <BaseLayers />
      <Trees shadows />
      <LandmarkModels models={models} />
      <PinProjector landmarks={landmarks} heights={heights} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.09}
        minDistance={90}
        maxPolarAngle={1.22}
        screenSpacePanning={false}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
      <CameraRig controls={controls} />
    </>
  )
}

export function CampusMap() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      frameloop="demand"
      dpr={[1, isCoarse ? 1.5 : 2]}
      camera={{ fov: VFOV, near: 4, far: 20000, position: [0, 2000, 2000] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
    >
      <Scene />
    </Canvas>
  )
}
