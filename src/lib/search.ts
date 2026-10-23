import type { Category, Localized } from '../data/types'

/** Anything the search box can find (landmarks now, shuttle stops later). */
export interface SearchItem {
  id: string
  kind: 'landmark' | 'stop'
  category: Category
  name: Localized
  shortName?: Localized
  aliases?: string[]
  /** Category labels in both languages, matched weakly ("อาหาร", "food"). */
  categoryLabels?: string[]
  featured?: boolean
  /** Short tag shown with the result (e.g. a shuttle stop code). */
  badge?: string
}

export interface SearchResult {
  item: SearchItem
  score: number
}

/**
 * Normalise for matching: Unicode NFC, lower case, and no spaces or common
 * punctuation. Thai is written without spaces between words, so everything is
 * matched as a substring anywhere; stripping spaces also lets "kuavenue" find
 * "KU Avenue" and "วศ" find "วศ.".
 */
export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[\s.\-·,()'’"/]/g, '')
}

interface Field {
  norm: string
  /** Lower-cased words, for word-prefix matches in Latin text ("fac sci"). */
  words: string[]
  weight: number
}

interface Indexed {
  item: SearchItem
  fields: Field[]
}

const field = (text: string, weight: number): Field => ({
  norm: normalize(text),
  words: text.normalize('NFC').toLowerCase().split(/[\s\-·,()/]+/).filter(Boolean),
  weight,
})

export function buildIndex(items: SearchItem[]): Indexed[] {
  return items.map((item) => ({
    item,
    fields: [
      field(item.name.th, 1),
      field(item.name.en, 1),
      ...(item.shortName ? [field(item.shortName.th, 1), field(item.shortName.en, 1)] : []),
      ...(item.aliases ?? []).map((a) => field(a, 0.9)),
      ...(item.categoryLabels ?? []).map((c) => field(c, 0.4)),
    ],
  }))
}

/** Score one field: exact > prefix > word prefix > substring anywhere. */
function scoreField(f: Field, q: string, qWords: string[]): number {
  if (!f.norm) return 0
  if (f.norm === q) return 100
  if (f.norm.startsWith(q)) return 80
  // Every query word starts some word of the field ("fac sci" → "Faculty of Science").
  if (qWords.length > 0 && qWords.every((w) => f.words.some((fw) => fw.startsWith(w)))) return 65
  if (f.norm.includes(q)) return 45
  return 0
}

/**
 * Search the index. Items whose category isn't in `categories` (when given)
 * are skipped. Results are ranked by best field score, then featured, then
 * shorter names.
 */
export function search(
  index: Indexed[],
  query: string,
  opts: { categories?: Set<Category> | null; limit?: number } = {},
): SearchResult[] {
  const q = normalize(query)
  if (!q) return []
  const qWords = query.normalize('NFC').toLowerCase().split(/\s+/).filter(Boolean)
  const out: SearchResult[] = []
  for (const entry of index) {
    if (opts.categories && !opts.categories.has(entry.item.category)) continue
    let best = 0
    for (const f of entry.fields) {
      // Category labels only count for queries of 2+ characters.
      if (f.weight < 0.5 && q.length < 2) continue
      best = Math.max(best, scoreField(f, q, qWords) * f.weight)
    }
    if (best > 0) out.push({ item: entry.item, score: best + (entry.item.featured ? 3 : 0) })
  }
  out.sort(
    (a, b) =>
      b.score - a.score ||
      (a.item.shortName ?? a.item.name).th.length - (b.item.shortName ?? b.item.name).th.length,
  )
  return out.slice(0, opts.limit ?? 8)
}
