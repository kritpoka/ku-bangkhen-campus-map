import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { landmarks } from '../data/landmarks'
import type { Category } from '../data/types'
import { buildIndex, search, type SearchItem, type SearchResult } from '../lib/search'

/** Extra searchable items (e.g. shuttle stops) registered by other features. */
const extraItems: SearchItem[] = []
export function registerSearchItems(items: SearchItem[]) {
  extraItems.push(...items)
}

/** Landmarks (+ registered extras) as search items, with category labels in both languages. */
function useIndex() {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const th = i18n.getFixedT('th'), en = i18n.getFixedT('en')
    const items: SearchItem[] = [
      ...landmarks.map((l) => ({
        id: l.id,
        kind: 'landmark' as const,
        category: l.category,
        name: l.name,
        shortName: l.shortName,
        aliases: l.searchAliases,
        categoryLabels: [th(`category.${l.category}`), en(`category.${l.category}`)],
        featured: l.featured,
      })),
      ...extraItems,
    ]
    return buildIndex(items)
  }, [i18n])
}

/** Results for a query within the visible categories; empty query → featured suggestions. */
export function useSearchResults(query: string, categories: Set<Category> | null): { results: SearchResult[]; suggested: boolean } {
  const index = useIndex()
  return useMemo(() => {
    if (query.trim()) return { results: search(index, query, { categories, limit: 8 }), suggested: false }
    const featured = index
      .filter((e) => e.item.featured && (!categories || categories.has(e.item.category)))
      .slice(0, 8)
      .map((e) => ({ item: e.item, score: 0 }))
    return { results: featured, suggested: true }
  }, [index, query, categories])
}
