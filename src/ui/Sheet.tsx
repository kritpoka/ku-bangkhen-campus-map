import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const FLICK = 0.5 // px/ms
/** Movement (px) before a touch is classed as a vertical drag or a horizontal swipe. */
const LOCK = 8
/** Rubber band past the top snap: the sheet moves this fraction of the finger. */
const RUBBER = 1 / 3
/** Momentum scrolling of the content after a fling (time constant, ms). */
const MOMENTUM_TAU = 325
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
  /** Top part: handle + header. */
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

interface Track {
  id: number
  x0: number
  y0: number
  y: number
  mode: 'pending' | 'drag' | 'off'
  /** Sheet height in finger units (above the top snap it is rubber-banded for display). */
  raw: number
  /** What the last movement did: moved the sheet or scrolled the content. */
  last: 'sheet' | 'scroll'
  samples: { t: number; y: number }[]
}

/**
 * Mobile bottom sheet with snap points, dragged from anywhere on it (Google
 * Maps style). One vertical gesture moves the sheet and scrolls its content:
 * below the top snap, dragging moves the sheet; at the top snap, dragging up
 * scrolls the content, and dragging down scrolls it back to the top and then
 * carries on moving the sheet, without lifting the finger. Horizontal swipes
 * (photo gallery, chip rows) are left to the browser (they're `pan-x`), taps
 * reach buttons as usual, and a drag that starts on a button doesn't press it.
 * On release the sheet snaps by position and velocity; a flick steps one snap,
 * and below the lowest snap it closes.
 *
 * The sheet is `touch-action: none` and scrolls its content itself (with
 * momentum), because native scrolling can't hand a gesture back once started.
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
  const track = useRef<Track | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const momentum = useRef(0)
  const suppressClickUntil = useRef(0)
  const index = Math.min(snap, snaps.length - 1)
  const atTop = index === snaps.length - 1
  const visible = drag ?? (entered ? snaps[index] : 0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (drag === null && entered) onHeight?.(snaps[index])
  }, [drag, entered, index, snaps, onHeight])

  // Content below the top snap always shows from its start.
  useLayoutEffect(() => {
    if (!atTop && body.current) body.current.scrollTop = 0
  }, [atTop])

  const stopMomentum = () => cancelAnimationFrame(momentum.current)
  useEffect(() => stopMomentum, [])

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

  const shown = (raw: number) => (raw > full ? full + (raw - full) * RUBBER : Math.max(0, raw))

  const onPointerDown = (e: React.PointerEvent) => {
    if (track.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    stopMomentum()
    track.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      y: e.clientY,
      mode: 'pending',
      raw: snaps[index],
      last: 'sheet',
      samples: [{ t: e.timeStamp, y: e.clientY }],
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const tr = track.current
    if (!tr || tr.id !== e.pointerId || tr.mode === 'off') return
    if (tr.mode === 'pending') {
      const dx = e.clientX - tr.x0, dy = e.clientY - tr.y0
      if (Math.hypot(dx, dy) < LOCK) return
      if (Math.abs(dx) > Math.abs(dy)) {
        tr.mode = 'off' // horizontal: a gallery / chip row swipe, or nothing
        return
      }
      tr.mode = 'drag'
      tr.y = e.clientY
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    let d = e.clientY - tr.y // > 0: finger moving down
    tr.y = e.clientY
    tr.samples.push({ t: e.timeStamp, y: e.clientY })
    while (tr.samples.length > 2 && e.timeStamp - tr.samples[0].t > 90) tr.samples.shift()
    const el = body.current
    const maxScroll = el ? el.scrollHeight - el.clientHeight : 0
    if (d < 0) {
      // Up: expand the sheet to the top snap, then scroll the content, then rubber-band.
      let up = -d
      if (tr.raw < full) {
        const take = Math.min(up, full - tr.raw)
        tr.raw += take
        up -= take
        tr.last = 'sheet'
      }
      if (up > 0 && el && el.scrollTop < maxScroll - 0.5 && tr.raw <= full) {
        const take = Math.min(up, maxScroll - el.scrollTop)
        el.scrollTop += take
        up -= take
        tr.last = 'scroll'
      }
      if (up > 0) {
        tr.raw += up
        tr.last = 'sheet'
      }
    } else if (d > 0) {
      // Down: undo any rubber band, scroll the content back to its top, then move the sheet.
      if (tr.raw > full) {
        const take = Math.min(d, tr.raw - full)
        tr.raw -= take
        d -= take
      }
      if (d > 0 && el && el.scrollTop > 0) {
        const take = Math.min(d, el.scrollTop)
        el.scrollTop -= take
        d -= take
        tr.last = 'scroll'
      }
      if (d > 0) {
        tr.raw -= d
        tr.last = 'sheet'
      }
    }
    setDrag(shown(tr.raw))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const tr = track.current
    if (!tr || tr.id !== e.pointerId) return
    track.current = null
    if (tr.mode !== 'drag') return
    suppressClickUntil.current = performance.now() + 400
    const a = tr.samples[0], b = tr.samples[tr.samples.length - 1]
    // A finger that paused before lifting isn't a flick; a cancelled gesture never is.
    const fresh = e.type === 'pointerup' && e.timeStamp - b.t < 60
    const v = fresh && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0
    setDrag(null)
    if (tr.last === 'scroll' && tr.raw === full) {
      // The gesture expanded the sheet and went on into the content: stay at the top snap.
      if (!atTop) onSnap(snaps.length - 1)
      return scrollMomentum(-v)
    }
    settle(shown(tr.raw), v)
  }

  /** Keep the content gliding after a fling, decaying like native momentum scrolling. */
  const scrollMomentum = (v0: number) => {
    const el = body.current
    if (!el || Math.abs(v0) < 0.05) return
    let v = v0, t = performance.now()
    const step = (now: number) => {
      const dt = Math.min(32, now - t)
      t = now
      const before = el.scrollTop
      el.scrollTop += v * dt
      v *= Math.exp(-dt / MOMENTUM_TAU)
      if (Math.abs(v) > 0.02 && el.scrollTop !== before) momentum.current = requestAnimationFrame(step)
    }
    momentum.current = requestAnimationFrame(step)
  }

  // A drag that started on a button or link must not press it.
  const onClickCapture = (e: React.MouseEvent) => {
    if (performance.now() < suppressClickUntil.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      aria-label={label}
      data-sheet
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      className={`pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex touch-none flex-col rounded-t-3xl bg-white shadow-[0_-8px_32px_-8px_rgba(0,43,42,0.25)] ring-1 ring-black/5 ${
        drag === null ? 'transition-transform duration-300 ease-out motion-reduce:transition-none' : ''
      } ${className}`}
      style={{ height: full, transform: `translateY(${full - visible}px)` }}
    >
      <div className="px-4 pt-2 pb-3">
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
        ref={body}
        data-sheet-body
        // touch-none here too: touch-action stops at the nearest scroller, so the content
        // must opt out of native scrolling itself (the sheet scrolls it, see above).
        className={`min-h-0 flex-1 touch-none overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
          atTop ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
      >
        {children}
      </div>
    </section>
  )
}
