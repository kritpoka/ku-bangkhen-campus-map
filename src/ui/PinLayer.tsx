import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Landmark } from '../data/types'
import type { Lang } from '../i18n'
import { pinBridge } from '../scene/pinBridge'
import { categoryStyle } from './categories'

interface PinLayerProps {
  landmarks: Landmark[]
  selectedId?: string | null
  onSelect?: (id: string) => void
}

/**
 * Landmark pins as plain DOM over the canvas. Position and display mode
 * (data-mode = label | icon | hidden) are written by PinProjector, so this
 * component only re-renders for language or selection changes.
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
  const name = landmark.name[lang]
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
      <button
        type="button"
        onClick={() => onSelect?.(landmark.id)}
        aria-label={name}
        aria-pressed={selected}
        className="group pointer-events-auto flex -translate-x-1/2 -translate-y-full cursor-pointer flex-col items-center outline-none select-none"
      >
        <span
          className={`flex h-8 items-center gap-1.5 rounded-full bg-white/95 p-1 shadow-md shadow-ku-900/15 ring-1 ring-black/5 transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ku-600 group-data-[mode=label]/pin:pr-3 motion-reduce:transition-none ${
            selected ? 'ring-2 ring-ku-600' : ''
          }`}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
          </span>
          {/* leading-normal: tighter line heights clip stacked Thai tone marks under truncate. */}
          <span
            lang={lang}
            className="hidden max-w-[11rem] truncate text-[12.5px] leading-normal font-semibold text-slate-800 group-data-[mode=label]/pin:block"
          >
            {name}
          </span>
        </span>
        <span className="h-3 w-0.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <span className="size-2 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} aria-hidden />
      </button>
    </div>
  )
})
