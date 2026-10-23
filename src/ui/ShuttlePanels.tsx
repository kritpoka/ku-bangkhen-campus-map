import { Bus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shuttleLines, shuttleStopById } from '../data/shuttle'
import type { Lang } from '../i18n'
import { LineDetails, LineList, LineSwatch, ShuttleSources, StopDetails } from './ShuttleInfo'
import { SHEET_TOP, Sheet, useViewportHeight } from './Sheet'

interface LegendProps {
  activeLine: string | null
  onLine: (id: string | null) => void
  onStop: (id: string) => void
  onClose: () => void
}

/** Width of the desktop legend card (px); pins keep clear of it. */
export const LEGEND_WIDTH = 340

/** Desktop legend card (bottom-left): lines, the active line's details, sources. */
export function ShuttleLegendCard({ activeLine, onLine, onStop, onClose }: LegendProps) {
  const { t } = useTranslation()
  const line = shuttleLines.find((l) => l.id === activeLine)
  return (
    <section
      aria-label={t('shuttle.title')}
      className="pointer-events-auto absolute bottom-6 left-4 z-20 flex max-h-[calc(100%-180px)] w-[340px] flex-col rounded-3xl bg-white/97 shadow-2xl shadow-ku-900/15 ring-1 ring-black/5 backdrop-blur"
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

/** Mobile: line chips shown above the bottom search bar while the overlay is on. */
export function LineChips({ activeLine, onLine }: { activeLine: string | null; onLine: (id: string | null) => void }) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  return (
    <div role="group" aria-label={t('shuttle.title')} className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {shuttleLines.map((l) => {
        const active = l.id === activeLine
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={active}
            onClick={() => onLine(active ? null : l.id)}
            className="pointer-events-auto flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/95 px-3 text-[13px] leading-normal font-semibold whitespace-nowrap text-slate-800 shadow-sm ring-1 ring-black/8 focus-visible:outline-2 focus-visible:outline-ku-600"
            style={active ? { backgroundColor: l.color, color: '#fff' } : undefined}
          >
            <LineSwatch line={l} className={active ? 'opacity-0' : ''} />
            {l.name[lang]}
          </button>
        )
      })}
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

/** Desktop stop card at the right (same slot as the place card). */
export function StopCard({ stopId, activeLine, onLine, onClose }: { stopId: string; activeLine: string | null; onLine: (id: string | null) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const stop = shuttleStopById.get(stopId)!
  return (
    <aside aria-labelledby={titleId} aria-label={t('shuttle.stop')} className="pointer-events-auto absolute top-[132px] right-4 z-30 w-[380px] animate-[card-in_220ms_ease-out] rounded-3xl bg-white/97 p-4 shadow-2xl shadow-ku-900/15 ring-1 ring-black/5 backdrop-blur motion-reduce:animate-none">
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
