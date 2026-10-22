import { Suspense, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { landmarkById, landmarks } from './data/landmarks'
import type { Landmark } from './data/types'
import { toScene } from './lib/geo'
import { mapCamera } from './scene/camera/mapCamera'
import { attachTouchGestures } from './scene/camera/touchGestures'
import { CampusMap } from './scene/CampusMap'
import { pinBridge } from './scene/pinBridge'
import { Attribution } from './ui/Attribution'
import { BottomSheet } from './ui/BottomSheet'
import { CARD_MARGIN, CARD_WIDTH, DetailCard } from './ui/DetailCard'
import { Header } from './ui/Header'
import { MapControls } from './ui/MapControls'
import { PinLayer } from './ui/PinLayer'
import { DESKTOP_QUERY, useMediaQuery } from './ui/useMediaQuery'
import { useSelection } from './ui/useSelection'

/** Camera distance (m) when focusing a place; closer views are kept. */
const FOCUS_DISTANCE = { desktop: 460, mobile: 560 }

export default function App() {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [selectedId, select] = useSelection()
  const selected = selectedId ? landmarkById.get(selectedId) ?? null : null
  const mapRef = useRef<HTMLDivElement>(null)
  const sheetHeight = useRef(0)

  // Fly so the place sits in the middle of the map area left uncovered by the card / sheet.
  const focus = useCallback(
    (l: Landmark) => {
      const [x, z] = toScene(l.coordinates.lng, l.coordinates.lat)
      const { innerWidth: w, innerHeight: h } = window
      const current = mapCamera.ready ? mapCamera.read().distance : Infinity
      if (isDesktop) {
        mapCamera.flyTo(new THREE.Vector3(x, 0, z), {
          distance: Math.min(current, FOCUS_DISTANCE.desktop),
          sx: (w - CARD_WIDTH - CARD_MARGIN * 2) / 2,
          sy: h * 0.56,
        })
      } else {
        const top = pinBridge.insets.top
        const bottom = h - (sheetHeight.current || Math.min(h * 0.44, 380))
        mapCamera.flyTo(new THREE.Vector3(x, 0, z), {
          distance: Math.min(current, FOCUS_DISTANCE.mobile),
          sx: w / 2,
          sy: top + (bottom - top) * 0.62,
        })
      }
    },
    [isDesktop],
  )

  // Fly whenever the selection changes (including a ?place= deep link once the map is ready).
  useEffect(() => {
    if (!selected) return
    let raf = 0
    const go = () => (mapCamera.ready && mapCamera.home ? focus(selected) : (raf = requestAnimationFrame(go)))
    go()
    return () => cancelAnimationFrame(raf)
  }, [selected, focus])

  // Keep pins out from under the card (desktop) or sheet (mobile).
  useEffect(() => {
    pinBridge.insets.right = isDesktop && selected ? CARD_WIDTH + CARD_MARGIN * 2 : 0
    if (!selected || isDesktop) pinBridge.insets.bottom = 0
    pinBridge.touch()
  }, [isDesktop, selected])

  const onSheetHeight = useCallback((px: number) => {
    sheetHeight.current = px
    pinBridge.insets.bottom = px
    pinBridge.touch()
  }, [])

  // Touch: Google Maps–style gestures. A tap selects the pin under it, or clears the selection.
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    return attachTouchGestures(el, { onTap: (x, y) => select(pinBridge.hitTest(x, y)) })
  }, [select])

  // Mouse: a click (not a drag) selects the pin under the cursor, or clears the
  // selection on empty map. Hovering a pin shows a pointer cursor.
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    let down: { x: number; y: number } | null = null
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top] as const
    }
    const onDown = (e: PointerEvent) => {
      down = e.pointerType === 'mouse' && e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerType !== 'mouse') return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved < 5) select(pinBridge.hitTest(...local(e)))
    }
    const onHover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return
      el.style.cursor = pinBridge.hitTest(...local(e)) ? 'pointer' : ''
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onHover)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onHover)
    }
  }, [select])

  // Escape closes the desktop card (the sheet handles its own).
  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, select])

  const close = useCallback(() => select(null), [select])
  const refocus = useCallback(() => selected && focus(selected), [selected, focus])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* touch-none: the page never scrolls or browser-zooms while touching the map. */}
      <div
        ref={mapRef}
        className="absolute inset-0 touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
      >
        <Suspense fallback={<p className="p-6 text-sm text-ku-700">{t('app.loading')}</p>}>
          <CampusMap />
        </Suspense>
        <PinLayer landmarks={landmarks} selectedId={selectedId} onSelect={select} />
      </div>
      <Header />
      <MapControls
        className={`absolute z-20 transition-[right] duration-200 motion-reduce:transition-none ${
          isDesktop ? 'top-1/2 -translate-y-1/2' : 'top-[84px]'
        }`}
        style={{ right: isDesktop && selected ? CARD_WIDTH + CARD_MARGIN * 2 : isDesktop ? 16 : 12 }}
      />
      {selected &&
        (isDesktop ? (
          <DetailCard landmark={selected} onClose={close} onFocus={refocus} />
        ) : (
          <BottomSheet landmark={selected} onClose={close} onFocus={refocus} onHeight={onSheetHeight} />
        ))}
      <Attribution />
    </div>
  )
}
