import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { landmarkById, landmarks } from './data/landmarks'
import type { Landmark } from './data/types'
import { toScene } from './lib/geo'
import { mapApi } from './scene/mapApi'
import { MapSkeleton } from './ui/MapSkeleton'

// three.js + the scene + OSM data load as a separate chunk after the UI shell.
const CampusMap = lazy(() => import('./scene/CampusMap').then((m) => ({ default: m.CampusMap })))
import { pinBridge } from './scene/pinBridge'
import { Attribution } from './ui/Attribution'
import { BottomSheet, placeSnaps } from './ui/BottomSheet'
import { CARD_MARGIN, CARD_WIDTH, DetailCard } from './ui/DetailCard'
import { Header } from './ui/Header'
import { MapControls } from './ui/MapControls'
import { MobileSearch } from './ui/MobileSearch'
import { visibleCategories, type ChipId } from './ui/filters'
import { useHistoryFlag } from './ui/useHistoryFlag'
import type { SearchResult } from './lib/search'
import { PinLayer } from './ui/PinLayer'
import { DESKTOP_QUERY, useMediaQuery } from './ui/useMediaQuery'
import { useSelection } from './ui/useSelection'
import { shuttleLines, shuttleStopById, shuttleStops } from './data/shuttle'
import { stopBridge } from './scene/stopBridge'
import { StopLayer } from './ui/StopLayer'
import { LEGEND_WIDTH, LineChips, LineSheet, ShuttleLegendCard, StopCard, StopSheet } from './ui/ShuttlePanels'
import './ui/shuttleSearch'

/** Camera distance (m) when focusing a place; closer views are kept. */
const FOCUS_DISTANCE = { desktop: 460, mobile: 560 }

export default function App() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [selectedId, select] = useSelection()
  const selected = selectedId ? landmarkById.get(selectedId) ?? null : null
  const mapRef = useRef<HTMLDivElement>(null)
  const sheetHeight = useRef(0)
  const searchBarHeight = useRef(0)
  const [chips, setChips] = useState<Set<ChipId>>(() => new Set())
  const categories = useMemo(() => visibleCategories(chips), [chips])
  const [searchOpen, openSearch, closeSearch] = useHistoryFlag('ku-map:search')

  // Category filters hide non-matching pins (the selected place always stays).
  useEffect(() => {
    pinBridge.visible = categories ? new Set(landmarks.filter((l) => categories.has(l.category)).map((l) => l.id)) : null
    pinBridge.touch()
  }, [categories])

  // ─── Shuttle overlay ───────────────────────────────────────────────────
  const [shuttleOn, setShuttleOn] = useState(false)
  const [activeLine, setActiveLine] = useState<string | null>(null)
  const [stopId, setStopId] = useState<string | null>(null)
  const stop = stopId ? shuttleStopById.get(stopId) ?? null : null

  useEffect(() => {
    const line = shuttleLines.find((l) => l.id === activeLine)
    stopBridge.visible = !shuttleOn
      ? new Set()
      : new Set(shuttleStops.filter((s) => !s.offMap && (!line || line.stops.includes(s.id))).map((s) => s.id))
    stopBridge.touch()
  }, [shuttleOn, activeLine])

  const toggleShuttle = useCallback(() => {
    if (shuttleOn) {
      setActiveLine(null)
      setStopId(null)
    }
    setShuttleOn(!shuttleOn)
  }, [shuttleOn])

  const flyToPoint = useCallback((lng: number, lat: number, distance: number) => {
    const [x, z] = toScene(lng, lat)
    mapApi.flyTo(x, z, { distance: Math.min(mapApi.distance(), distance) })
  }, [])

  // A stop and a place are never both open.
  const selectStop = useCallback(
    (id: string | null, fly = false) => {
      if (id) {
        select(null)
        setShuttleOn(true)
        const s = shuttleStopById.get(id)
        if (fly && s) flyToPoint(s.coordinates.lng, s.coordinates.lat, 520)
      }
      setStopId(id)
    },
    [select, flyToPoint],
  )
  const selectPlace = useCallback(
    (id: string | null) => {
      if (id) setStopId(null)
      select(id)
    },
    [select],
  )

  const pick = useCallback(
    (r: SearchResult) => {
      if (r.item.kind === 'landmark') selectPlace(r.item.id)
      else selectStop(r.item.id, true)
    },
    [selectPlace, selectStop],
  )

  // Picking the Transport chip turns the shuttle overlay on.
  const onChips = useCallback(
    (next: Set<ChipId>) => {
      if (next.has('transport') && !chips.has('transport')) setShuttleOn(true)
      setChips(next)
    },
    [chips],
  )

  /** What a tap/click at a map point selects: a shuttle stop (overlay on), else a pin, else nothing. */
  const tapAt = useCallback(
    (x: number, y: number) => {
      const s = shuttleOn ? stopBridge.hitTest(x, y) : null
      if (s) return selectStop(s)
      setStopId(null)
      selectPlace(pinBridge.hitTest(x, y))
    },
    [shuttleOn, selectStop, selectPlace],
  )

  // Fly so the place sits in the middle of the map area left uncovered by the card / sheet.
  const focus = useCallback(
    (l: Landmark) => {
      const [x, z] = toScene(l.coordinates.lng, l.coordinates.lat)
      const { innerWidth: w, innerHeight: h } = window
      const current = mapApi.distance()
      if (isDesktop) {
        mapApi.flyTo(x, z, {
          distance: Math.min(current, FOCUS_DISTANCE.desktop),
          sx: (w - CARD_WIDTH - CARD_MARGIN * 2) / 2,
          sy: h * 0.56,
        })
      } else {
        const top = pinBridge.insets.top
        const bottom = h - (sheetHeight.current || placeSnaps(h)[1])
        mapApi.flyTo(x, z, {
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
    const go = () => (mapApi.ready ? focus(selected) : (raf = requestAnimationFrame(go)))
    go()
    return () => cancelAnimationFrame(raf)
  }, [selected, focus])

  // Which mobile bottom surface is showing: a place, a stop, a line, or the search bar.
  const mobileLine = !isDesktop && !selected && !stop && activeLine ? activeLine : null
  const sheetOpen = !isDesktop && (!!selected || !!stop || !!mobileLine)
  const rightCard = isDesktop && (!!selected || !!stop)

  // Keep pins and stops out from under the card (desktop), sheets or search bar (mobile).
  useEffect(() => {
    pinBridge.insets.right = rightCard ? CARD_WIDTH + CARD_MARGIN * 2 : 0
    pinBridge.insets.left = isDesktop && shuttleOn ? LEGEND_WIDTH + 16 : 0
    if (isDesktop) pinBridge.insets.bottom = 0
    else if (!sheetOpen) pinBridge.insets.bottom = searchBarHeight.current
    pinBridge.touch()
    stopBridge.touch()
  }, [isDesktop, rightCard, sheetOpen, shuttleOn])

  const onSearchBarHeight = useCallback(
    (px: number) => {
      searchBarHeight.current = px
      if (!sheetOpen) {
        pinBridge.insets.bottom = px
        pinBridge.touch()
        stopBridge.touch()
      }
    },
    [sheetOpen],
  )

  const onSheetHeight = useCallback((px: number) => {
    sheetHeight.current = px
    pinBridge.insets.bottom = px
    pinBridge.touch()
    stopBridge.touch()
  }, [])

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
      if (moved < 5) tapAt(...local(e))
    }
    const onHover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return
      const [x, y] = local(e)
      el.style.cursor = (shuttleOn && stopBridge.hitTest(x, y)) || pinBridge.hitTest(x, y) ? 'pointer' : ''
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onHover)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onHover)
    }
  }, [tapAt, shuttleOn])

  // Escape closes the desktop card (the sheet handles its own).
  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (stopId) setStopId(null)
      else select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, select, stopId])

  const close = useCallback(() => select(null), [select])
  const refocus = useCallback(() => selected && focus(selected), [selected, focus])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* touch-none: the page never scrolls or browser-zooms while touching the map. */}
      <div
        ref={mapRef}
        className="absolute inset-0 touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
      >
        <Suspense fallback={<MapSkeleton />}>
          {/* Touch gestures attach inside the scene chunk (they drive the camera controller). */}
          <CampusMap shuttleOn={shuttleOn} activeLine={activeLine} gestureTarget={mapRef} onTap={tapAt} />
        </Suspense>
        <PinLayer landmarks={landmarks} selectedId={selectedId} onSelect={selectPlace} />
        {shuttleOn && <StopLayer selectedId={stopId} onSelect={(id) => selectStop(id)} />}
      </div>
      <Header isDesktop={isDesktop} chips={chips} onChips={onChips} categories={categories} onPick={pick} />
      <MapControls
        className={`absolute z-20 transition-[right] duration-200 motion-reduce:transition-none ${
          isDesktop ? 'top-1/2 -translate-y-1/2' : 'top-[84px]'
        }`}
        style={{ right: rightCard ? CARD_WIDTH + CARD_MARGIN * 2 : isDesktop ? 16 : 12 }}
        shuttleOn={shuttleOn}
        onToggleShuttle={toggleShuttle}
      />
      {isDesktop && shuttleOn && (
        <ShuttleLegendCard activeLine={activeLine} onLine={setActiveLine} onStop={(id) => selectStop(id, true)} onClose={toggleShuttle} />
      )}
      {isDesktop && stop && !selected && <StopCard stopId={stop.id} activeLine={activeLine} onLine={setActiveLine} onClose={() => setStopId(null)} />}
      {!isDesktop && stop && !selected && (
        <StopSheet stopId={stop.id} activeLine={activeLine} onLine={setActiveLine} onClose={() => setStopId(null)} onHeight={onSheetHeight} />
      )}
      {mobileLine && <LineSheet lineId={mobileLine} onClose={() => setActiveLine(null)} onStop={(id) => selectStop(id, true)} onHeight={onSheetHeight} />}
      {selected &&
        (isDesktop ? (
          <DetailCard landmark={selected} onClose={close} onFocus={refocus} />
        ) : (
          <BottomSheet landmark={selected} onClose={close} onFocus={refocus} onHeight={onSheetHeight} />
        ))}
      {!isDesktop && !sheetOpen && (
        <MobileSearch
          aboveChips={shuttleOn ? <LineChips activeLine={activeLine} onLine={setActiveLine} /> : undefined}
          expanded={searchOpen}
          onExpand={openSearch}
          onCollapse={closeSearch}
          chips={chips}
          onChips={onChips}
          categories={categories}
          onPick={pick}
          onHeight={onSearchBarHeight}
        />
      )}
      {isDesktop && <Attribution />}
    </div>
  )
}
