import { Bus, House, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mapApi } from '../scene/mapApi'

/** Bearing (radians) beyond which the compass appears. */
const COMPASS_THRESHOLD = (2 * Math.PI) / 180

const buttonClass =
  'flex size-11 items-center justify-center text-slate-700 transition-colors hover:bg-ku-50 hover:text-ku-700 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ku-600 active:bg-ku-100'

/**
 * Floating map controls: zoom, compass (only when rotated away from north)
 * and home. Positioned by the parent.
 */
export function MapControls({
  className = '',
  style,
  shuttleOn,
  onToggleShuttle,
}: {
  className?: string
  style?: React.CSSProperties
  shuttleOn: boolean
  onToggleShuttle: () => void
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('controls.label')} className={`flex flex-col items-end gap-2 ${className}`} style={style}>
      <Compass />
      <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white/95 shadow-lg shadow-ku-900/10 ring-1 ring-black/5 backdrop-blur">
        <button type="button" className={buttonClass} aria-label={t('controls.zoomIn')} title={t('controls.zoomIn')} onClick={() => mapApi.zoomStep(0.5)}>
          <Plus className="size-5" aria-hidden />
        </button>
        <button type="button" className={buttonClass} aria-label={t('controls.zoomOut')} title={t('controls.zoomOut')} onClick={() => mapApi.zoomStep(2)}>
          <Minus className="size-5" aria-hidden />
        </button>
        <button type="button" className={buttonClass} aria-label={t('controls.home')} title={t('controls.home')} onClick={() => mapApi.goHome()}>
          <House className="size-5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        aria-pressed={shuttleOn}
        aria-label={t('shuttle.toggle')}
        title={t('shuttle.toggle')}
        onClick={onToggleShuttle}
        className={`flex size-11 items-center justify-center rounded-2xl shadow-lg shadow-ku-900/10 ring-1 ring-black/5 backdrop-blur transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600 ${
          shuttleOn ? 'bg-slate-800 text-white' : 'bg-white/95 text-slate-700 hover:bg-ku-50'
        }`}
      >
        <Bus className="size-5" aria-hidden />
      </button>
    </nav>
  )
}

/**
 * Shows which way north is; tapping animates back to north-up and the default
 * tilt. The needle is rotated directly in the DOM so camera moves don't re-render React.
 */
function Compass() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const needle = useRef<SVGSVGElement>(null)

  useEffect(
    () =>
      mapApi.subscribe((azimuth) => {
        const a = Math.atan2(Math.sin(azimuth), Math.cos(azimuth))
        if (needle.current) needle.current.style.transform = `rotate(${a}rad)`
        setVisible(Math.abs(a) > COMPASS_THRESHOLD)
      }),
    [],
  )

  return (
    <button
      type="button"
      onClick={() => mapApi.resetBearing()}
      aria-label={t('controls.compass')}
      title={t('controls.compass')}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`flex size-11 items-center justify-center rounded-full bg-white/95 shadow-lg shadow-ku-900/10 ring-1 ring-black/5 backdrop-blur transition-[opacity,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600 motion-reduce:transition-none ${
        visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'
      }`}
    >
      <svg ref={needle} viewBox="0 0 24 24" className="size-6" aria-hidden>
        <path d="M12 2.5 15.2 12H8.8z" fill="#d33a2c" />
        <path d="M12 21.5 8.8 12h6.4z" fill="#94a3b8" />
        <circle cx="12" cy="12" r="1.6" fill="#fff" />
      </svg>
    </button>
  )
}
