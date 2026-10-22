import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Landmark } from '../data/types'
import type { Lang } from '../i18n'
import { labelText } from '../scene/Pins'
import { pinBridge } from '../scene/pinBridge'
import { categoryStyle } from './categories'

interface PinLayerProps {
  landmarks: Landmark[]
  selectedId?: string | null
  onSelect?: (id: string) => void
}

/**
 * Landmark pins as plain DOM over the canvas. Position and display mode
 * (data-mode = label | dot | hidden) are written by PinProjector, so this
 * component only re-renders for language or selection changes.
 *
 * Pins are pointer-transparent: mouse and touch input always reaches the map
 * (so dragging or scrolling over a label still pans/zooms), and pointer
 * selection goes through pinBridge.hitTest in App. The buttons remain for
 * keyboard and screen-reader users.
 */
export function PinLayer({ landmarks, selectedId = null, onSelect }: PinLayerProps) {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang

  useEffect(() => {
    pinBridge.lang = lang
    pinBridge.selectedId = selectedId
    pinBridge.touch()
  }, [lang, selectedId])

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {landmarks.map((l) => (
        <Pin key={l.id} landmark={l} lang={lang} selected={l.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

const Pin = memo(function Pin({
  landmark,
  lang,
  selected,
  onSelect,
}: {
  landmark: Landmark
  lang: Lang
  selected: boolean
  onSelect?: (id: string) => void
}) {
  const { color, icon: Icon } = categoryStyle[landmark.category]
  return (
    <div
      ref={(el) => {
        if (el) {
          pinBridge.elements.set(landmark.id, el)
          pinBridge.touch()
        } else {
          pinBridge.elements.delete(landmark.id)
        }
      }}
      data-mode="hidden"
      inert
      className="group/pin absolute top-0 left-0 transition-opacity duration-200 will-change-transform data-[mode=hidden]:opacity-0 motion-reduce:transition-none"
    >
      {/* Anchored at the bottom centre (the dot sits on the landmark). */}
      <button
        type="button"
        onClick={() => onSelect?.(landmark.id)}
        aria-label={landmark.name[lang]}
        aria-pressed={selected}
        className="group absolute bottom-0 left-0 flex -translate-x-1/2 translate-y-[5px] cursor-pointer group-data-[mode=dot]/pin:translate-y-[13px] flex-col items-center outline-none select-none group-data-[mode=dot]/pin:p-[7px]"
      >
        <span
          className={`hidden h-8 items-center gap-1.5 rounded-full bg-white/95 py-1 pr-3 pl-1 shadow-md shadow-ku-900/15 ring-1 ring-black/5 transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ku-600 group-data-[mode=label]/pin:flex motion-reduce:transition-none ${
            selected ? 'ring-2 ring-ku-600' : ''
          }`}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
          </span>
          {/* Never truncated: labels use the short name. leading-normal keeps Thai tone marks intact. */}
          <span lang={lang} className="text-[12.5px] leading-normal font-semibold whitespace-nowrap text-slate-800">
            {labelText(landmark, lang)}
          </span>
        </span>
        <span
          className="hidden h-[14px] w-0.5 rounded-full group-data-[mode=label]/pin:block"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span
          className="block size-3 rounded-full shadow-sm ring-2 ring-white transition-transform group-hover:scale-125 group-focus-visible:ring-ku-600 group-data-[mode=label]/pin:size-2.5 motion-reduce:transition-none"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      </button>
    </div>
  )
})
