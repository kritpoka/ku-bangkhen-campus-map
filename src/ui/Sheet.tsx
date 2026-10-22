import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const FLICK = 0.5 // px/ms
/** Top of a fully expanded sheet (px from the viewport top), keeping the compact header visible. */
export const SHEET_TOP = 76

export function useViewportHeight() {
  const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vh
}

interface SheetProps {
  /** Resting heights in px, ascending (e.g. peek, half, full). */
  snaps: number[]
  /** Controlled snap index. */
  snap: number
  onSnap: (index: number) => void
  /** Dragging/flicking below the lowest snap calls this (omit for a sheet that can't close). */
  onClose?: () => void
  /** Drag zone: handle + header. Buttons and links inside it stay clickable. */
  header: ReactNode
  children: ReactNode
  /** Visible height once settled, so the map can keep pins and fly-to targets clear. */
  onHeight?: (px: number) => void
  labelledBy?: string
  label?: string
  /** Accessible names for the handle button. */
  expandLabel: string
  collapseLabel: string
  className?: string
}

/**
 * Mobile bottom sheet with snap points. Drag the handle/header, flick to jump
 * a snap, tap the handle to step up (or back down from the top). The body
 * scrolls only at the top snap.
 */
export function Sheet({
  snaps,
  snap,
  onSnap,
  onClose,
  header,
  children,
  onHeight,
  labelledBy,
  label,
  expandLabel,
  collapseLabel,
  className = '',
}: SheetProps) {
  const full = snaps[snaps.length - 1]
  const [drag, setDrag] = useState<number | null>(null)
  const [entered, setEntered] = useState(false)
  const track = useRef<{ y: number; h: number; samples: { t: number; y: number }[]; moved: boolean } | null>(null)
  const index = Math.min(snap, snaps.length - 1)
  const visible = drag ?? (entered ? snaps[index] : 0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (drag === null && entered) onHeight?.(snaps[index])
  }, [drag, entered, index, snaps, onHeight])

  const settle = useCallback(
    (h: number, velocity: number) => {
      // Flicks step one snap; otherwise go to the nearest snap (or close).
      if (velocity < -FLICK) return onSnap(Math.min(snaps.length - 1, index + 1))
      if (velocity > FLICK) {
        if (index === 0 || h < snaps[0] * 0.6) return onClose ? onClose() : onSnap(0)
        return onSnap(index - 1)
      }
      if (h < snaps[0] * 0.55 && onClose) return onClose()
      let best = 0
      snaps.forEach((s, i) => Math.abs(s - h) < Math.abs(snaps[best] - h) && (best = i))
      onSnap(best)
    },
    [snaps, index, onSnap, onClose],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, [role=listbox]')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    track.current = { y: e.clientY, h: snaps[index], samples: [{ t: e.timeStamp, y: e.clientY }], moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const tr = track.current
    if (!tr) return
    const dy = e.clientY - tr.y
    if (!tr.moved && Math.abs(dy) < 6) return
    tr.moved = true
    tr.samples.push({ t: e.timeStamp, y: e.clientY })
    while (tr.samples.length > 2 && e.timeStamp - tr.samples[0].t > 90) tr.samples.shift()
    let h = tr.h - dy
    if (h > full) h = full + (h - full) / 3 // rubber band past the top
    setDrag(Math.max(0, h))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const tr = track.current
    track.current = null
    if (!tr || !tr.moved) return
    const a = tr.samples[0], b = tr.samples[tr.samples.length - 1]
    // A finger that paused before lifting isn't a flick.
    const fresh = e.timeStamp - b.t < 60
    const v = fresh && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0
    const h = drag ?? snaps[index]
    setDrag(null)
    settle(h, v)
  }

  const atTop = index === snaps.length - 1
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      aria-label={label}
      className={`pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_32px_-8px_rgba(0,43,42,0.25)] ring-1 ring-black/5 ${
        drag === null ? 'transition-transform duration-300 ease-out motion-reduce:transition-none' : ''
      } ${className}`}
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
          onClick={() => onSnap(atTop ? Math.max(0, index - 1) : index + 1)}
          aria-expanded={atTop}
          aria-label={atTop ? collapseLabel : expandLabel}
          className="mx-auto mb-2 flex h-5 w-16 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ku-600"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>
        {header}
      </div>
      <div
        className={`min-h-0 flex-1 overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
          atTop && drag === null ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
      >
        {children}
      </div>
    </section>
  )
}
