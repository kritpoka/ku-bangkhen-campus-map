import { useTranslation } from 'react-i18next'

export function Attribution({ className = 'pointer-events-auto absolute bottom-1 left-1 z-10' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-md bg-white/75 px-1.5 py-0.5 text-[10px] text-slate-600 backdrop-blur ${className}`}>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ku-600"
      >
        {t('attribution.osm')}
      </a>
    </div>
  )
}
