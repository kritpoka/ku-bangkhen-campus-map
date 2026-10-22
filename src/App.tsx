import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { CampusMap } from './scene/CampusMap'
import { Header } from './ui/Header'
import { Attribution } from './ui/Attribution'
import { PinLayer } from './ui/PinLayer'
import { landmarks } from './data/landmarks'

export default function App() {
  const { t } = useTranslation()
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={<p className="p-6 text-sm text-ku-700">{t('app.loading')}</p>}>
          <CampusMap />
        </Suspense>
      </div>
      <PinLayer landmarks={landmarks} />
      <Header />
      <Attribution />
    </div>
  )
}
