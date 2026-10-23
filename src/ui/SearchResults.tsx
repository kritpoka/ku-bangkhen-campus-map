import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '../i18n'
import type { SearchResult } from '../lib/search'
import { categoryStyle } from './categories'

interface Props {
  id: string
  results: SearchResult[]
  query: string
  suggested: boolean
  activeIndex: number
  onPick: (r: SearchResult) => void
  onHover?: (i: number) => void
}

export const optionId = (listId: string, i: number) => `${listId}-opt-${i}`

/** Listbox of search results (icon, name, category); keyboard focus stays in the input. */
export function SearchResults({ id, results, query, suggested, activeIndex, onPick, onHover }: Props) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'th') as Lang
  const other: Lang = lang === 'th' ? 'en' : 'th'

  if (!suggested && results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-8 text-center" role="status">
        <SearchX className="size-7 text-slate-400" aria-hidden />
        <p className="text-[14px] leading-normal font-medium text-slate-700">{t('search.empty', { query })}</p>
        <p className="text-[12.5px] leading-normal text-slate-500">{t('search.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div>
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase" aria-live="polite">
        {suggested ? t('search.suggested') : t('search.count', { count: results.length })}
      </p>
      <ul id={id} role="listbox" aria-label={suggested ? t('search.suggested') : t('search.results')} className="pb-1">
        {results.map((r, i) => {
          const { color, icon: Icon } = categoryStyle[r.item.category]
          // Stops: the stop's own name as the title; "Shuttle stop E12" underneath.
          const title = r.item.kind === 'stop' && r.item.shortName ? r.item.shortName : r.item.name
          const active = i === activeIndex
          return (
            <li
              key={r.item.id}
              id={optionId(id, i)}
              role="option"
              aria-selected={active}
              onPointerDown={(e) => e.preventDefault()} // keep focus in the input
              onClick={() => onPick(r)}
              onPointerEnter={() => onHover?.(i)}
              className={`mx-1 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${active ? 'bg-ku-50' : 'hover:bg-slate-50'}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }} aria-hidden>
                <Icon className="size-4" strokeWidth={2.3} />
              </span>
              <span className="min-w-0 flex-1">
                <span lang={lang} className="block text-[14px] leading-normal font-medium text-slate-900">
                  {title[lang]}
                </span>
                <span className="block truncate text-[12px] leading-normal text-slate-500">
                  {r.item.kind === 'stop' ? `${t('search.stop')} ${r.item.badge ?? ''}` : t(`category.${r.item.category}`)}
                  <span lang={other}> · {title[other]}</span>
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
