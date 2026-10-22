import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { pinBridge } from '../scene/pinBridge'
import { LanguageToggle } from './LanguageToggle'

export function Header() {
  const { t } = useTranslation()
  const ref = useRef<HTMLElement>(null)
  // Keep map pins out from under the floating header.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      pinBridge.insets.top = el.getBoundingClientRect().bottom
      pinBridge.touch()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <header ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl bg-white/90 px-3 py-2 shadow-lg shadow-ku-900/5 backdrop-blur">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 shrink-0" />
        <div className="min-w-0">
          {/* leading-normal: Thai tone marks get clipped by truncate at tighter line heights. */}
          <h1 className="truncate text-[15px] leading-normal font-semibold text-ku-800">
            <span className="sm:hidden">{t('app.shortTitle')}</span>
            <span className="hidden sm:inline">{t('app.title')}</span>
          </h1>
          <p className="truncate text-xs leading-normal text-slate-500">{t('app.subtitle')}</p>
        </div>
      </div>
      <div className="pointer-events-auto ml-auto">
        <LanguageToggle />
      </div>
    </header>
  )
}
