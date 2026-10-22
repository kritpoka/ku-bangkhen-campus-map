import { useTranslation } from 'react-i18next'
import { LanguageToggle } from './LanguageToggle'

export function Header() {
  const { t } = useTranslation()
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl bg-white/90 px-3 py-2 shadow-lg shadow-ku-900/5 backdrop-blur">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 shrink-0" />
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-[15px] font-semibold text-ku-800">{t('app.title')}</h1>
          <p className="truncate text-xs text-slate-500">{t('app.subtitle')}</p>
        </div>
      </div>
      <div className="pointer-events-auto ml-auto">
        <LanguageToggle />
      </div>
    </header>
  )
}
