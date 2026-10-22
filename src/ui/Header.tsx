import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '../data/types'
import type { SearchResult } from '../lib/search'
import { pinBridge } from '../scene/pinBridge'
import { DesktopSearch } from './DesktopSearch'
import { FilterChips } from './FilterChips'
import { LanguageToggle } from './LanguageToggle'
import type { ChipId } from './filters'

interface Props {
  isDesktop: boolean
  chips: Set<ChipId>
  onChips: (next: Set<ChipId>) => void
  categories: Set<Category> | null
  onPick: (r: SearchResult) => void
}

/**
 * Desktop: logo, search bar and filter chips (like the reference header).
 * Mobile: compact logo + language toggle; search lives at the bottom.
 */
export function Header({ isDesktop, chips, onChips, categories, onPick }: Props) {
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
    <header ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="pointer-events-auto flex h-12 min-w-0 shrink-0 items-center gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-ku-900/5 backdrop-blur">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 shrink-0" />
          <div className="min-w-0">
            {/* leading-normal: Thai tone marks get clipped by truncate at tighter line heights. */}
            <h1 className="truncate text-[15px] leading-normal font-semibold text-ku-800">
              <span className="lg:hidden">{t('app.shortTitle')}</span>
              <span className="hidden lg:inline">{t('app.title')}</span>
            </h1>
            <p className="truncate text-xs leading-normal text-slate-500">{t('app.subtitle')}</p>
          </div>
        </div>
        {isDesktop && (
          <div className="pointer-events-auto flex-1">
            <DesktopSearch categories={categories} onPick={onPick} />
          </div>
        )}
        <div className="pointer-events-auto ml-auto">
          <LanguageToggle />
        </div>
      </div>
      {isDesktop && <FilterChips active={chips} onChange={onChips} className="pointer-events-auto mt-3 -mx-4 px-4 pb-1" />}
    </header>
  )
}
