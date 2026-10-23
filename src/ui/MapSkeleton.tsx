import { useTranslation } from 'react-i18next'

/**
 * Shown while the 3D scene chunk loads: a soft campus-shaped silhouette with a
 * shimmer and a status line, so the page never looks blank. The header and
 * search are already usable.
 */
export function MapSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#f1f5f1]" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 200 160" className="w-[min(60vw,320px)] animate-pulse motion-reduce:animate-none" aria-hidden>
          <path d="M40 30 L118 14 L160 60 L150 140 L66 150 L22 96 Z" fill="#dfeadf" />
          <path d="M70 50h30v18H70zM110 70h22v26h-22zM62 92h26v20H62zM96 108h30v16H96z" fill="#c9dccb" />
          <path d="M118 14 L120 150" stroke="#ffffff" strokeWidth="4" />
          <path d="M22 96 L150 112" stroke="#ffffff" strokeWidth="4" />
        </svg>
        <p className="flex items-center gap-2 text-[14px] leading-normal font-medium text-ku-700">
          <span className="size-2 animate-ping rounded-full bg-ku-600 motion-reduce:animate-none" aria-hidden />
          {t('app.loading')}
        </p>
      </div>
    </div>
  )
}
