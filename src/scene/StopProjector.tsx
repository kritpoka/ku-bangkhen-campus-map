import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { shuttleStops } from '../data/shuttle'
import { toScene } from '../lib/geo'
import { pinBridge } from './pinBridge'
import { stopBridge } from './stopBridge'

const HIT_RADIUS = 18 // CSS px

/** Projects shuttle stops to the screen and writes their DOM positions (no React re-renders). */
export function StopProjector() {
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const s = useMemo(
    () => ({
      stops: shuttleStops.filter((st) => !st.offMap),
      anchors: [] as THREE.Vector3[],
      screen: new Float32Array(shuttleStops.length * 2),
      shown: new Uint8Array(shuttleStops.length),
      v: new THREE.Vector3(),
      lastMatrix: new THREE.Matrix4(),
      lastW: 0,
      lastH: 0,
      // Last written position / mode per element, so unchanged values aren't rewritten.
      wx: new Float32Array(shuttleStops.length).fill(NaN),
      wy: new Float32Array(shuttleStops.length).fill(NaN),
      wmode: [] as string[],
      wel: [] as (HTMLElement | undefined)[],
    }),
    [],
  )
  if (s.anchors.length === 0) {
    s.anchors = s.stops.map((st) => {
      const [x, z] = toScene(st.coordinates.lng, st.coordinates.lat)
      return new THREE.Vector3(x, 1, z)
    })
  }

  useEffect(() => {
    stopBridge.invalidate = invalidate
    stopBridge.hitTest = (x, y) => {
      let best: string | null = null
      let bestD = HIT_RADIUS
      s.stops.forEach((st, i) => {
        if (!s.shown[i]) return
        const d = Math.hypot(x - s.screen[i * 2], y - s.screen[i * 2 + 1])
        if (d < bestD) {
          best = st.id
          bestD = d
        }
      })
      return best
    }
    stopBridge.touch()
    return () => {
      stopBridge.invalidate = () => {}
      stopBridge.hitTest = () => null
    }
  }, [invalidate, s])

  useFrame(({ camera }) => {
    camera.updateMatrixWorld()
    const resized = size.width !== s.lastW || size.height !== s.lastH
    if (!stopBridge.dirty && !resized && camera.matrixWorld.equals(s.lastMatrix)) return
    stopBridge.dirty = false
    s.lastW = size.width
    s.lastH = size.height
    s.lastMatrix.copy(camera.matrixWorld)
    const { insets } = pinBridge
    for (let i = 0; i < s.stops.length; i++) {
      const st = s.stops[i]
      s.v.copy(s.anchors[i]).project(camera)
      const x = (s.v.x * 0.5 + 0.5) * size.width
      const y = (-s.v.y * 0.5 + 0.5) * size.height
      s.screen[i * 2] = x
      s.screen[i * 2 + 1] = y
      const show =
        stopBridge.visible.has(st.id) &&
        s.v.z < 1 &&
        x > insets.left && x < size.width - insets.right && y > insets.top && y < size.height - insets.bottom
      s.shown[i] = show ? 1 : 0
      const el = stopBridge.elements.get(st.id)
      if (!el) continue
      if (s.wel[i] !== el) {
        s.wel[i] = el // new element: write everything
        s.wmode[i] = ''
        s.wx[i] = s.wy[i] = NaN
      }
      const mode = show ? 'shown' : 'hidden'
      if (s.wmode[i] !== mode) {
        s.wmode[i] = el.dataset.mode = mode
        el.inert = !show
      }
      // Hidden stops aren't moved; shown ones only when they actually moved.
      if (show && !(Math.abs(x - s.wx[i]) <= 0.05 && Math.abs(y - s.wy[i]) <= 0.05)) { // NaN = never written
        s.wx[i] = x
        s.wy[i] = y
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
    }
  })
  return null
}
