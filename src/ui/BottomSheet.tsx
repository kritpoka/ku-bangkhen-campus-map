import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Landmark } from '../data/types'
import { PlaceBody, PlaceHeader } from './PlaceDetails'

type Snap = 'peek' | 'full'

/** Top of the fully expanded sheet (px from the viewport top), leaving the header visible. */
const FULL_TOP = 76
const peekHeight = (vh: number) => Math.round(Math.min(vh * 0.44, 380))
const FLICK = 0.5 // px/ms

interface Props {
  landmark: Landmark
  onClose: () => void
  onFocus: () => void
  /** Visible sheet height (px) once it settles, so the map can keep pins and fly-to targets clear. */
  onHeight: (px: number) => void
}

/**
 * Mobile place sheet: peeks at ~44% height, drags up to full, flicks or drags
 * down to collapse/close. The handle and header are the drag zone; the body
 * scrolls when expanded.
 */
export function BottomSheet({ landmark, onClose, onFocus, onHeight }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const [vh, setVh] = useState(() => window.innerHeight)
  const [snap, setSnap] = useState<Snap>('peek')
  const [drag, setDrag] = useState<number | null>(null) // visible height while dragging
  const [entered, setEntered] = useState(false)
  const track = useRef<{ y: number; h: number; samples: { t: number; y: number }[]; moved: boolean } | null>(null)

  const full = vh - FULL_TOP
  const peek = peekHeight(vh)
  const snapHeight = snap === 'full' ? full : peek
  const visible = drag ?? (entered ? snapHeight : 0)

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // New place: start at the peek height, sliding in from the bottom.
  useEffect(() => {
    setSnap('peek')
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [landmark.id])

  useEffect(() => {
    if (drag === null) onHeight(entered ? snapHeight : 0)
  }, [drag, entered, snapHeight, onHeight])

  const settle = useCallback(
    (h: number, velocity: number) => {
      // Flicks win; otherwise go to the nearest resting height.
      if (velocity < -FLICK) return setSnap('full')
      if (velocity > FLICK) return snap === 'full' && h > peek * 0.6 ? setSnap('peek') : onClose()
      if (h < peek * 0.55) return onClose()
      setSnap(Math.abs(h - full) < Math.abs(h - peek) ? 'full' : 'peek')
    },
    [full, peek, snap, onClose],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    track.current = { y: e.clientY, h: snapHeight, samples: [{ t: performance.now(), y: e.clientY }], moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const tr = track.current
    if (!tr) return
    const dy = e.clientY - tr.y
    if (!tr.moved && Math.abs(dy) < 6) return
    tr.moved = true
    const now = performance.now()
    tr.samples.push({ t: now, y: e.clientY })
    while (tr.samples.length > 2 && now - tr.samples[0].t > 90) tr.samples.shift()
    // Past full height, resist like a rubber band.
    let h = tr.h - dy
    if (h > full) h = full + (h - full) / 3
    setDrag(Math.max(0, h))
  }
  const onPointerUp = () => {
    const tr = track.current
    track.current = null
    if (!tr) return
    if (!tr.moved) {
      // A tap on the handle/header toggles between peek and full.
      setSnap((s) => (s === 'full' ? 'peek' : 'full'))
      return
    }
    const a = tr.samples[0], b = tr.samples[tr.samples.length - 1]
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0
    const h = drag ?? snapHeight
    setDrag(null)
    settle(h, v)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={`pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_32px_-8px_rgba(0,43,42,0.25)] ring-1 ring-black/5 ${
        drag === null ? 'transition-transform duration-300 ease-out motion-reduce:transition-none' : ''
      }`}
      style={{ height: full, transform: `translateY(${full - visible}px)` }}
    >
      <div
        className="cursor-grab touch-none px-4 pt-2 pb-3 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={() => setSnap((s) => (s === 'full' ? 'peek' : 'full'))}
          aria-expanded={snap === 'full'}
          aria-label={snap === 'full' ? t('panel.collapse') : t('panel.expand')}
          className="mx-auto mb-2 flex h-5 w-16 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ku-600"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>
        <PlaceHeader landmark={landmark} titleId={titleId} onClose={onClose} onFocus={onFocus} />
      </div>
      <div
        key={landmark.id}
        className={`flex-1 overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
          snap === 'full' && drag === null ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
      >
        <PlaceBody landmark={landmark} />
      </div>
    </section>
  )
}
