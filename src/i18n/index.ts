import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import th from './locales/th.json'
import en from './locales/en.json'

export const LANGUAGES = ['th', 'en'] as const
export type Lang = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'ku-map.lang'

function storedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'th' || v === 'en') return v
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return 'th'
}

i18n.use(initReactI18next).init({
  resources: { th: { translation: th }, en: { translation: en } },
  lng: storedLang(),
  fallbackLng: 'th',
  interpolation: { escapeValue: false },
})

function syncDocument(lng: string) {
  document.documentElement.lang = lng
  document.title = i18n.t('app.documentTitle')
}

syncDocument(i18n.language)
i18n.on('languageChanged', (lng) => {
  syncDocument(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // Ignore: the choice just won't persist.
  }
})

export default i18n
