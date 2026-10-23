import type { Landmark } from '../data/types'

/** The text a map label shows: the short name when there is one. */
export const labelText = (l: Landmark, lang: 'th' | 'en') => (l.shortName ?? l.name)[lang]
