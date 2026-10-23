import { Bus, ExternalLink, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SHUTTLE_SOURCES, linesByStop, shuttleLines, shuttleStopById, type ShuttleLine, type ShuttleStop } from '../data/shuttle'
import type { Lang } from '../i18n'

function useLang(): Lang {
  const { i18n } = useTranslation()
  return (i18n.resolvedLanguage ?? 'th') as Lang
}

export function LineSwatch({ line, className = '' }: { line: ShuttleLine; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-6 shrink-0 rounded-full ${line.path.length ? '' : 'bg-[repeating-linear-gradient(90deg,currentColor_0_4px,transparent_4px_7px)]'} ${className}`}
      style={line.path.length ? { backgroundColor: line.color } : { color: line.color }}
      aria-hidden
    />
  )
}

/** Line list: each row selects/highlights its line. */
export function LineList({ activeLine, onLine }: { activeLine: string | null; onLine: (id: string | null) => void }) {
  const lang = useLang()
  return (
    <ul className="space-y-1">
      {shuttleLines.map((l) => {
        const active = l.id === activeLine
        return (
          <li key={l.id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onLine(active ? null : l.id)}
              className={`flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ku-600 ${
                active ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <LineSwatch line={l} className="mt-[7px]" />
              <span className="min-w-0">
                <span className="block text-[13.5px] leading-normal font-semibold text-slate-800">{l.name[lang]}</span>
                <span className={`text-[12px] leading-normal text-slate-500 ${active ? 'block' : 'line-clamp-1'}`}>{l.summary[lang]}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Hours, buses and ordered stops for one line. */
export function LineDetails({ line, onStop }: { line: ShuttleLine; onStop: (id: string) => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const days = [
    ['weekdays', line.service.weekdays],
    ['saturday', line.service.saturday],
    ['sunday', line.service.sunday],
  ] as const
  return (
    <div className="space-y-3">
      <dl className="divide-y divide-slate-100 rounded-xl bg-slate-50/80 px-3 text-[12.5px]">
        {days.map(([day, svc]) => (
          <div key={day} className="flex justify-between gap-3 py-2">
            <dt className="text-slate-500">{t(`shuttle.days.${day}`)}</dt>
            <dd className="text-right font-medium text-slate-800">
              {svc ? `${svc.hours[lang]} · ${t('shuttle.buses', { count: svc.buses })}` : t('shuttle.noService')}
            </dd>
          </div>
        ))}
      </dl>
      {line.notes && <p className="text-[12px] leading-normal text-slate-500">{line.notes[lang]}</p>}
      {line.stops.length > 0 && (
        <ol className="relative space-y-0.5 pl-5" aria-label={t('shuttle.stopsInOrder')}>
          <span className="absolute top-2 bottom-2 left-[7px] w-0.5 rounded-full" style={{ backgroundColor: line.color }} aria-hidden />
          {line.stops.map((id, i) => {
            const st = shuttleStopById.get(id)
            if (!st) return null
            return (
              <li key={`${id}-${i}`} className="relative">
                <span className="absolute top-[9px] -left-[17px] size-2.5 rounded-full border-2 bg-white" style={{ borderColor: line.color }} aria-hidden />
                {st.offMap ? (
                  <span className="block px-1.5 py-0.5 text-[12.5px] leading-normal text-slate-400">
                    {st.code} · {st.name[lang]} <span className="text-[11px]">({t('shuttle.offMap')})</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStop(id)}
                    className="w-full rounded-md px-1.5 py-0.5 text-left text-[12.5px] leading-normal text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-ku-600"
                  >
                    <span className="font-semibold text-slate-500 tabular-nums">{st.code}</span> · {st.name[lang]}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/** Where the data comes from, its date, and the official live app. */
export function ShuttleSources() {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-[11.5px] leading-normal text-slate-500">
      <p className="flex gap-1.5">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t('shuttle.disclaimer')}</span>
      </p>
      <p>
        {t('shuttle.sources')}{' '}
        <a href={SHUTTLE_SOURCES.routeMap} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ku-700">
          {t('shuttle.routeMap')}
        </a>{' '}
        ·{' '}
        <a href={SHUTTLE_SOURCES.schedule} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ku-700">
          {t('shuttle.schedule')}
        </a>{' '}
        <ExternalLink className="inline size-3" aria-hidden />
      </p>
      <p>{t('shuttle.app')}</p>
    </div>
  )
}

/** Stop details: name, code, and the lines that serve it (tap a line to highlight it). */
export function StopDetails({ stop, activeLine, onLine, onClose, titleId }: { stop: ShuttleStop; activeLine: string | null; onLine: (id: string | null) => void; onClose: () => void; titleId: string }) {
  const { t } = useTranslation()
  const lang = useLang()
  const other: Lang = lang === 'th' ? 'en' : 'th'
  const lines = linesByStop.get(stop.id) ?? []
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-white" aria-hidden>
          <Bus className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-normal font-semibold tracking-wide text-slate-500 uppercase">
            {t('shuttle.stop')} {stop.code}
          </p>
          <h2 id={titleId} lang={lang} className="text-[17px] leading-snug font-semibold text-slate-900">
            {stop.name[lang]}
          </h2>
          <p lang={other} className="text-[13px] leading-normal text-slate-500">
            {stop.name[other]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('panel.close')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ku-600"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-slate-500">{lines.length ? t('shuttle.servedBy') : t('shuttle.noLines')}</p>
        <div className="flex flex-wrap gap-2">
          {lines.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={activeLine === l.id}
              onClick={() => onLine(activeLine === l.id ? null : l.id)}
              className="flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600"
              style={{ backgroundColor: l.color, opacity: activeLine && activeLine !== l.id ? 0.55 : 1 }}
            >
              <Bus className="size-4" aria-hidden />
              {l.name[lang]}
            </button>
          ))}
        </div>
      </div>
      {stop.notes && (
        <p className="text-[12px] leading-normal text-slate-500">
          {stop.coordSource === 'official-map' ? t('shuttle.approxPosition') : t('shuttle.notOfficial')}
        </p>
      )}
    </div>
  )
}
