import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BaseLayers } from './BaseLayers'
import { palette } from './palette'

/** Max distance (m) the camera target may wander from the campus center. */
const PAN_LIMIT = 900

function PanClamp({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  useFrame(() => {
    const c = controls.current
    if (!c) return
    const t = c.target
    const cx = THREE.MathUtils.clamp(t.x, -PAN_LIMIT, PAN_LIMIT)
    const cz = THREE.MathUtils.clamp(t.z, -PAN_LIMIT, PAN_LIMIT)
    if (cx !== t.x || cz !== t.z || t.y !== 0) {
      // Shift camera by the same delta so the view doesn't rotate.
      c.object.position.x += cx - t.x
      c.object.position.z += cz - t.z
      t.set(cx, 0, cz)
    }
  })
  return null
}

export function CampusMap() {
  const controls = useRef<OrbitControlsImpl>(null)
  const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  return (
    <Canvas
      shadows
      dpr={[1, isCoarse ? 1.5 : 2]}
      camera={{ position: [650, 820, 900], fov: 32, near: 5, far: 8000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 1800, 3800]} />
      <hemisphereLight args={['#ffffff', '#cfd8d2', 1.6]} />
      <directionalLight position={[-400, 900, 300]} intensity={1.6} />
      <BaseLayers />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={120}
        maxDistance={2600}
        maxPolarAngle={1.25}
        screenSpacePanning={false}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
      <PanClamp controls={controls} />
    </Canvas>
  )
}
