import { ArrowLeft, Search, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '../data/types'
import type { SearchResult } from '../lib/search'
import { Attribution } from './Attribution'
import { FilterChips } from './FilterChips'
import { SearchResults, optionId } from './SearchResults'
import { SHEET_TOP, Sheet, useViewportHeight } from './Sheet'
import type { ChipId } from './filters'
import { useSearchResults } from './useSearch'

interface Props {
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  chips: Set<ChipId>
  onChips: (next: Set<ChipId>) => void
  categories: Set<Category> | null
  onPick: (r: SearchResult) => void
  /** Height of the collapsed bar (px), so pins stay clear of it. */
  onHeight: (px: number) => void
}

/**
 * Mobile search, Google Maps style: a search pill (with filter chips above
 * it) at the bottom of the screen; tapping it expands a full-height sheet with
 * the input, chips and results.
 */
export function MobileSearch({ expanded, onExpand, onCollapse, chips, onChips, categories, onPick, onHeight }: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const vh = useViewportHeight()
  const bar = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const { results, suggested } = useSearchResults(query, categories)

  useEffect(() => setActive(-1), [results])

  useLayoutEffect(() => {
    const el = bar.current
    if (!el || expanded) return
    const ro = new ResizeObserver(() => onHeight(window.innerHeight - el.getBoundingClientRect().top))
    ro.observe(el)
    return () => ro.disconnect()
  }, [expanded, onHeight])

  // Focus the input when the sheet opens (after its slide-in starts).
  useEffect(() => {
    if (!expanded) return
    const id = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 60)
    return () => window.clearTimeout(id)
  }, [expanded])

  if (!expanded) {
    return (
      <div ref={bar} className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <FilterChips active={chips} onChange={onChips} className="pointer-events-auto px-3 pb-2" />
        <div className="px-3">
          <button
            type="button"
            onClick={onExpand}
            className="pointer-events-auto flex h-12 w-full items-center gap-2.5 rounded-full bg-white px-4 text-left shadow-lg shadow-ku-900/15 ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600"
          >
            <Search className="size-[18px] text-slate-500" aria-hidden />
            <span className="text-[15px] leading-normal text-slate-500">{t('search.placeholder')}</span>
          </button>
        </div>
        <Attribution className="pointer-events-auto mx-3 mt-1.5 inline-block" />
      </div>
    )
  }

  const pick = (r: SearchResult) => {
    input.current?.blur()
    setQuery('')
    onPick(r)
  }
  return (
    <Sheet
      snaps={[vh - SHEET_TOP]}
      snap={0}
      onSnap={() => {}}
      onClose={onCollapse}
      label={t('search.label')}
      expandLabel={t('search.label')}
      collapseLabel={t('search.close')}
      header={
        <div className="space-y-3">
          <div className="flex h-12 items-center gap-1 rounded-2xl bg-slate-100 pr-1 pl-1 focus-within:ring-2 focus-within:ring-ku-600">
            <button
              type="button"
              onClick={onCollapse}
              aria-label={t('search.close')}
              className="flex size-10 items-center justify-center rounded-full text-slate-600 focus-visible:outline-2 focus-visible:outline-ku-600"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-label={t('search.label')}
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(listId, active) : undefined}
              enterKeyHint="search"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0] && !suggested) pick(results[Math.max(0, active)])
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] leading-normal text-slate-900 outline-none placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  input.current?.focus()
                }}
                aria-label={t('search.clear')}
                className="flex size-9 items-center justify-center rounded-full text-slate-500 focus-visible:outline-2 focus-visible:outline-ku-600"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <FilterChips active={chips} onChange={onChips} className="-mx-4 px-4" />
        </div>
      }
    >
      <SearchResults id={listId} results={results} query={query} suggested={suggested} activeIndex={active} onPick={pick} />
    </Sheet>
  )
}
