import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t('lang.toggle')}
      className="flex rounded-full bg-white/90 p-1 shadow-lg shadow-ku-900/5 backdrop-blur"
    >
      {LANGUAGES.map((lng) => {
        const active = i18n.resolvedLanguage === lng
        return (
          <button
            key={lng}
            type="button"
            lang={lng}
            aria-pressed={active}
            onClick={() => i18n.changeLanguage(lng)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600 ${
              active ? 'bg-ku-600 text-white' : 'text-slate-600 hover:text-ku-700'
            }`}
          >
            {t(`lang.${lng}`)}
          </button>
        )
      })}
    </div>
  )
}
