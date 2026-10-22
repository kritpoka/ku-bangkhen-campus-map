import { Crosshair, ExternalLink, ImageOff, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Landmark, LandmarkImage } from '../data/types'
import type { Lang } from '../i18n'
import { categoryStyle } from './categories'

/** Resolve a data-file image URL: absolute URLs as-is, local paths against the site base. */
export function imageSrc(img: LandmarkImage): string {
  return /^https?:\/\//.test(img.url) ? img.url : `${import.meta.env.BASE_URL}${img.url.replace(/^\//, '')}`
}

const iconButton =
  'flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-ku-50 hover:text-ku-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600'

interface Props {
  landmark: Landmark
  titleId: string
  onClose: () => void
  onFocus: () => void
}

/** Header of a place card: category, names and actions. */
export function PlaceHeader({ landmark, titleId, onClose, onFocus }: Props) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  const other: Lang = lang === 'th' ? 'en' : 'th'
  const { color, icon: Icon } = categoryStyle[landmark.category]
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${landmark.coordinates.lat},${landmark.coordinates.lng}`
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        <Icon className="size-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-normal font-semibold tracking-wide uppercase" style={{ color }}>
          {t(`category.${landmark.category}`)}
        </p>
        <h2 id={titleId} lang={lang} className="text-[17px] leading-snug font-semibold text-slate-900">
          {landmark.name[lang]}
        </h2>
        <p lang={other} className="text-[13px] leading-normal text-slate-500">
          {landmark.name[other]}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={onFocus} className={iconButton} aria-label={t('panel.focus')} title={t('panel.focus')}>
          <Crosshair className="size-4" aria-hidden />
        </button>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className={iconButton}
          aria-label={`${t('panel.openInMaps')} ${t('panel.openInMapsHint')}`}
          title={t('panel.openInMaps')}
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
        <button type="button" onClick={onClose} className={iconButton} aria-label={t('panel.close')} title={t('panel.close')}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Body of a place card: photos with attribution, description, facts, sources. */
export function PlaceBody({ landmark }: { landmark: Landmark }) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  const { lat, lng } = landmark.coordinates
  return (
    <div className="space-y-4">
      <Photos landmark={landmark} />
      <p lang={lang} className="text-[14.5px] leading-relaxed text-slate-700">
        {landmark.description[lang]}
      </p>
      <dl className="divide-y divide-slate-100 rounded-xl bg-slate-50/70 px-3 text-[13.5px]">
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-slate-500">{t('panel.category')}</dt>
          <dd className="text-right font-medium text-slate-800">{t(`category.${landmark.category}`)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-slate-500">{t('panel.coordinates')}</dt>
          <dd className="text-right font-medium text-slate-800 tabular-nums">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </dd>
        </div>
      </dl>
      {landmark.sources.length > 0 && (
        <details className="group text-[12.5px] text-slate-500">
          <summary className="cursor-pointer rounded font-medium text-slate-600 select-none hover:text-ku-700 focus-visible:outline-2 focus-visible:outline-ku-600">
            {t('panel.sources')} ({landmark.sources.length})
          </summary>
          <ul className="mt-2 space-y-1 break-all">
            {landmark.sources.map((src) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-ku-700 hover:underline">
                  {prettyUrl(src)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function prettyUrl(u: string) {
  try {
    const url = new URL(u)
    return decodeURIComponent(url.hostname.replace(/^www\./, '') + url.pathname).replace(/\/$/, '')
  } catch {
    return u
  }
}

/** Swipeable photo strip with per-photo attribution, or a styled placeholder. */
function Photos({ landmark }: { landmark: Landmark }) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  const [index, setIndex] = useState(0)
  const images = landmark.images
  const { color, icon: Icon } = categoryStyle[landmark.category]

  if (images.length === 0) {
    return (
      <div
        className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-2xl text-center"
        style={{ background: `linear-gradient(135deg, ${color}14, ${color}2e)` }}
      >
        <span className="relative">
          <Icon className="size-9 opacity-70" style={{ color }} aria-hidden />
          <ImageOff className="absolute -right-2 -bottom-1 size-4 rounded-full bg-white p-0.5 text-slate-400" aria-hidden />
        </span>
        <p className="text-[13px] font-medium text-slate-600">{t('panel.noPhoto')}</p>
        <p className="max-w-[16rem] text-[12px] leading-normal text-slate-500">{t('panel.noPhotoHint')}</p>
      </div>
    )
  }

  const current = images[Math.min(index, images.length - 1)]
  return (
    <figure className="space-y-1.5">
      <div
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl [scrollbar-width:none]"
        aria-label={t('panel.photos')}
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {images.map((img, i) => (
          <img
            key={img.url}
            src={imageSrc(img)}
            alt={`${landmark.name[lang]} — ${t('panel.photoCount', { index: i + 1, count: images.length })}`}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full shrink-0 snap-center rounded-2xl bg-slate-100 object-cover"
          />
        ))}
      </div>
      <figcaption className="flex items-start justify-between gap-2 text-[11.5px] leading-normal text-slate-500">
        <span>
          {t('panel.photoBy', { author: current.author })} ·{' '}
          {t('panel.license', { license: current.license })}
          {current.sourceUrl && (
            <>
              {' · '}
              <a href={current.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ku-700">
                {t('panel.source')}
              </a>
            </>
          )}
        </span>
        {images.length > 1 && (
          <span className="shrink-0 tabular-nums" aria-hidden>
            {index + 1}/{images.length}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
