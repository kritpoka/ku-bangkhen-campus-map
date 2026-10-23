import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { linesByStop, shuttleStops, type ShuttleStop } from '../data/shuttle'
import type { Lang } from '../i18n'
import { stopBridge } from '../scene/stopBridge'

/** Shuttle stop dots over the map. Positions/visibility come from StopProjector. */
export function StopLayer({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  useEffect(() => {
    stopBridge.selectedId = selectedId
    stopBridge.touch()
  }, [selectedId])
  return (
    <div className="pointer-events-none absolute inset-0 z-[9] overflow-hidden">
      {shuttleStops
        .filter((s) => !s.offMap)
        .map((s) => (
          <Stop key={s.id} stop={s} lang={lang} selected={s.id === selectedId} onSelect={onSelect} />
        ))}
    </div>
  )
}

const Stop = memo(function Stop({ stop, lang, selected, onSelect }: { stop: ShuttleStop; lang: Lang; selected: boolean; onSelect: (id: string) => void }) {
  const { t } = useTranslation()
  const lines = linesByStop.get(stop.id) ?? []
  const ring = lines.length === 1 ? lines[0].color : lines.length > 1 ? '#27313d' : '#94a3b8'
  const label = `${t('shuttle.stop')} ${stop.code ?? ''} ${stop.name[lang]}${
    lines.length ? ` — ${lines.map((l) => l.name[lang]).join(', ')}` : ''
  }`
  return (
    <div
      ref={(el) => {
        if (el) {
          stopBridge.elements.set(stop.id, el)
          stopBridge.touch()
        } else stopBridge.elements.delete(stop.id)
      }}
      data-mode="hidden"
      inert
      className="absolute top-0 left-0 transition-opacity duration-150 will-change-transform data-[mode=hidden]:opacity-0 motion-reduce:transition-none"
    >
      {/* Pointer-transparent like pins; tap/click selection goes through stopBridge.hitTest. */}
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={() => onSelect(stop.id)}
        className="group -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
      >
        <span
          className={`block rounded-full bg-white shadow-sm transition-transform group-focus-visible:ring-2 group-focus-visible:ring-ku-600 group-focus-visible:ring-offset-1 ${
            selected ? 'size-4 scale-125' : 'size-3'
          }`}
          style={{ boxShadow: `inset 0 0 0 ${selected ? 4 : 3}px ${ring}, 0 1px 3px rgb(0 0 0 / 0.25)` }}
        />
      </button>
    </div>
  )
})
