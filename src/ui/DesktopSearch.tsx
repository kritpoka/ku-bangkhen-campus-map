import { Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '../data/types'
import type { SearchResult } from '../lib/search'
import { SearchResults, optionId } from './SearchResults'
import { useSearchResults } from './useSearch'

interface Props {
  categories: Set<Category> | null
  onPick: (r: SearchResult) => void
}

/** Header search with a results dropdown (combobox pattern: ↑/↓, Enter, Esc). */
export function DesktopSearch({ categories, onPick }: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const { results, suggested } = useSearchResults(query, categories)

  useEffect(() => setActive(results.length && !suggested ? 0 : -1), [results, suggested])

  // "/" focuses search, like the reference.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === '/' && !target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (r: SearchResult) => {
    onPick(r)
    setOpen(false)
    setQuery('')
    input.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (results.length ? (i + 1) % results.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1))
    } else if (e.key === 'Enter') {
      const r = results[active] ?? (suggested ? undefined : results[0])
      if (r) {
        e.preventDefault()
        pick(r)
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      if (query) setQuery('')
      else {
        setOpen(false)
        input.current?.blur()
      }
    }
  }

  const expanded = open && (results.length > 0 || !suggested)
  return (
    <div className="relative w-full max-w-[460px]" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="flex h-12 items-center gap-2 rounded-2xl bg-white/95 px-3.5 shadow-lg shadow-ku-900/5 ring-1 ring-black/5 backdrop-blur focus-within:ring-2 focus-within:ring-ku-600">
        <Search className="size-[18px] shrink-0 text-slate-500" aria-hidden />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label={t('search.label')}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(listId, active) : undefined}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] leading-normal text-slate-900 outline-none placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              input.current?.focus()
            }}
            aria-label={t('search.clear')}
            className="flex size-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-ku-600"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : (
          <kbd className="rounded-md border border-slate-200 px-1.5 text-[11px] text-slate-500" aria-hidden>
            /
          </kbd>
        )}
      </div>
      {expanded && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-[min(60vh,440px)] overflow-y-auto rounded-2xl bg-white py-1 shadow-2xl shadow-ku-900/15 ring-1 ring-black/5">
          <SearchResults id={listId} results={results} query={query} suggested={suggested} activeIndex={active} onPick={pick} onHover={setActive} />
        </div>
      )}
    </div>
  )
}
