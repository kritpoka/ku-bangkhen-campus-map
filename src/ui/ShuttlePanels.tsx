import { Bus, X } from 'lucide-react'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shuttleLines, shuttleStopById } from '../data/shuttle'
import type { Lang } from '../i18n'
import { LineDetails, LineList, LineSwatch, ShuttleSources, StopDetails } from './ShuttleInfo'
import { CONTROLS_RESERVE, LEGEND_WIDTH } from './layout'
import { SHEET_TOP, Sheet, useViewportHeight } from './Sheet'

interface LegendProps {
  activeLine: string | null
  onLine: (id: string | null) => void
  onStop: (id: string) => void
  onClose: () => void
}

/** Desktop legend card (bottom-left): lines, the active line's details, sources. */
export function ShuttleLegendCard({ activeLine, onLine, onStop, onClose }: LegendProps) {
  const { t } = useTranslation()
  const line = shuttleLines.find((l) => l.id === activeLine)
  return (
    <section
      aria-label={t('shuttle.title')}
      style={{ width: LEGEND_WIDTH }}
      className="pointer-events-auto absolute bottom-6 left-4 z-20 flex max-h-[calc(100%-180px)] flex-col rounded-3xl bg-white/97 shadow-2xl shadow-ku-900/15 ring-1 ring-black/5 backdrop-blur"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <Bus className="size-5 text-slate-700" aria-hidden />
        <h2 className="flex-1 text-[15px] leading-normal font-semibold text-slate-900">{t('shuttle.title')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('shuttle.hide')}
          className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-ku-600"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        <LineList activeLine={activeLine} onLine={onLine} />
        {line && <LineDetails line={line} onStop={onStop} />}
        <ShuttleSources />
      </div>
    </section>
  )
}

/**
 * Mobile: line chips shown above the bottom search bar while the overlay is
 * on, ending with a chip that closes the overlay. The scroller is the only
 * pointer-active part (the bar around it is pointer-transparent, so empty
 * space still reaches the map); `touch-action: pan-x` lets a swipe scroll the
 * row, and a swipe never fires a click, so only a tap toggles a chip.
 */
export function LineChips({ activeLine, onLine, onClose }: { activeLine: string | null; onLine: (id: string | null) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  const [atEnd, setAtEnd] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const measure = () => {
    const el = scroller.current
    if (el) setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [lang])
  return (
    <div className="pb-2">
      <div
        ref={scroller}
        role="group"
        aria-label={t('shuttle.title')}
        onScroll={measure}
        data-line-chips
        className={`pointer-events-auto flex w-fit max-w-full touch-pan-x scroll-px-3 gap-2 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          atEnd ? '' : '[mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]'
        }`}
      >
        {shuttleLines.map((l) => {
          const active = l.id === activeLine
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={active}
              onClick={() => onLine(active ? null : l.id)}
              className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/95 px-3 text-[13px] leading-normal font-semibold whitespace-nowrap text-slate-800 shadow-sm ring-1 ring-black/8 focus-visible:outline-2 focus-visible:outline-ku-600"
              style={active ? { backgroundColor: l.color, color: '#fff' } : undefined}
            >
              <LineSwatch line={l} className={active ? 'opacity-0' : ''} />
              {l.name[lang]}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-800/90 px-3 text-[13px] leading-normal font-medium whitespace-nowrap text-white shadow-sm focus-visible:outline-2 focus-visible:outline-ku-600"
        >
          <X className="size-4" aria-hidden />
          {t('shuttle.close')}
        </button>
      </div>
    </div>
  )
}

/** Mobile line sheet (half / full): details + ordered stops + sources. */
export function LineSheet({ lineId, onClose, onStop, onHeight }: { lineId: string; onClose: () => void; onStop: (id: string) => void; onHeight: (px: number) => void }) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  const titleId = useId()
  const vh = useViewportHeight()
  const snaps = useMemo(() => [Math.round(Math.min(vh * 0.45, 400)), vh - SHEET_TOP], [vh])
  const line = shuttleLines.find((l) => l.id === lineId)!
  return (
    <SnapSheet snaps={snaps} onClose={onClose} onHeight={onHeight} titleId={titleId} key={lineId}>
      {{
        header: (
          <div className="flex items-center gap-3">
            <LineSwatch line={line} className="h-2.5 w-8" />
            <h2 id={titleId} className="flex-1 text-[17px] leading-snug font-semibold text-slate-900">
              {t('shuttle.title')} · {line.name[lang]}
            </h2>
            <button type="button" onClick={onClose} aria-label={t('panel.close')} className="flex size-9 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-200 focus-visible:outline-2 focus-visible:outline-ku-600">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ),
        body: (
          <div className="space-y-3">
            <p className="text-[13.5px] leading-relaxed text-slate-700">{line.summary[lang]}</p>
            <LineDetails line={line} onStop={onStop} />
            <ShuttleSources />
          </div>
        ),
      }}
    </SnapSheet>
  )
}

/** Mobile stop sheet. */
export function StopSheet({ stopId, activeLine, onLine, onClose, onHeight }: { stopId: string; activeLine: string | null; onLine: (id: string | null) => void; onClose: () => void; onHeight: (px: number) => void }) {
  const titleId = useId()
  const stop = shuttleStopById.get(stopId)!
  return (
    <SnapSheet snaps={[250]} onClose={onClose} onHeight={onHeight} titleId={titleId} key={stopId}>
      {{ header: <StopDetails stop={stop} activeLine={activeLine} onLine={onLine} onClose={onClose} titleId={titleId} />, body: null }}
    </SnapSheet>
  )
}

/** Desktop stop card at the right (same slot as the place card, left of the map controls). */
export function StopCard({ stopId, width, activeLine, onLine, onClose }: { stopId: string; width: number; activeLine: string | null; onLine: (id: string | null) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const stop = shuttleStopById.get(stopId)!
  return (
    <aside aria-labelledby={titleId} aria-label={t('shuttle.stop')} style={{ right: CONTROLS_RESERVE, width }}
      className="pointer-events-auto absolute top-[132px] z-30 animate-[card-in_220ms_ease-out] rounded-3xl bg-white/97 p-4 shadow-2xl shadow-ku-900/15 ring-1 ring-black/5 backdrop-blur motion-reduce:animate-none">
      <StopDetails stop={stop} activeLine={activeLine} onLine={onLine} onClose={onClose} titleId={titleId} />
    </aside>
  )
}

function SnapSheet({ snaps, onClose, onHeight, titleId, children }: { snaps: number[]; onClose: () => void; onHeight: (px: number) => void; titleId: string; children: { header: React.ReactNode; body: React.ReactNode } }) {
  const { t } = useTranslation()
  const [snap, setSnap] = useState(0)
  return (
    <Sheet snaps={snaps} snap={snap} onSnap={setSnap} onClose={onClose} onHeight={onHeight} labelledBy={titleId} expandLabel={t('panel.expand')} collapseLabel={t('panel.collapse')} header={children.header}>
      {children.body}
    </Sheet>
  )
}
