import { LayoutGrid, type LucideIcon } from 'lucide-react'
import type { Category } from '../data/types'
import { categoryStyle } from './categories'

/** Filter chips and the categories each one shows. */
export const CHIPS = [
  { id: 'faculty', categories: ['faculty'] },
  { id: 'food', categories: ['food'] },
  { id: 'sport', categories: ['sport'] },
  { id: 'library', categories: ['library'] },
  { id: 'admin', categories: ['admin'] },
  // Gates are how you get in and out, so they count as transport too.
  { id: 'transport', categories: ['transport', 'gate'] },
  { id: 'landmark', categories: ['landmark', 'gate'] },
] as const satisfies readonly { id: string; categories: readonly Category[] }[]

export type ChipId = (typeof CHIPS)[number]['id']

export const chipStyle = (id: ChipId | 'all'): { color: string; icon: LucideIcon } =>
  id === 'all' ? { color: '#006664', icon: LayoutGrid } : categoryStyle[id === 'transport' ? 'transport' : id]

/** Categories visible for a chip selection; null means everything (the "all" state). */
export function visibleCategories(active: Set<ChipId>): Set<Category> | null {
  if (active.size === 0) return null
  const out = new Set<Category>()
  for (const chip of CHIPS) if (active.has(chip.id)) chip.categories.forEach((c) => out.add(c))
  return out
}
