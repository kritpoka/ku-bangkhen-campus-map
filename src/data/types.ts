/** Shared content types. Content lives in the data files; rendering code only reads it. */

export interface Localized {
  th: string
  en: string
}

export const CATEGORIES = ['faculty', 'food', 'sport', 'library', 'admin', 'transport', 'landmark', 'gate'] as const
export type Category = (typeof CATEGORIES)[number]

export interface LandmarkImage {
  /**
   * Full URL, or a path relative to `public/`, e.g. "images/landmarks/library.jpg".
   * Relative paths are resolved against the site base URL at runtime.
   */
  url: string
  author: string
  /** Short license name as the source states it, e.g. "CC BY-SA 4.0". */
  license: string
  /** Page that documents the image and its license. Empty for your own photos. */
  sourceUrl: string
}

/**
 * Where the coordinates came from:
 * - osm: centroid of the cited OSM element (`osmId`)
 * - derived: computed from several OSM elements (explained in `notes`)
 * - manual: checked by hand by the project owner
 */
export type CoordSource = 'osm' | 'derived' | 'manual'

export interface Landmark {
  /** Stable, URL-safe id. Also the file name for a local photo. */
  id: string
  category: Category
  coordinates: { lat: number; lng: number }
  coordSource: CoordSource
  /** e.g. "way/259685345" or "node/891276459". */
  osmId?: string
  name: Localized
  /**
   * Compact name for map labels (labels are never truncated, so keep these
   * short). The full `name` is shown in the detail panel. Defaults to `name`.
   */
  shortName?: Localized
  /** 2–3 short factual sentences per language. */
  description: Localized
  images: LandmarkImage[]
  /** Nicknames, abbreviations and alternate spellings (any language) matched by search. */
  searchAliases?: string[]
  /** Ids from src/data/shuttle.ts. */
  shuttleStopIds?: string[]
  /** Gets a detailed stylized 3D model (see src/scene/modelSpecs.ts). */
  featured?: boolean
  /** Where the facts in `description` come from. */
  sources: string[]
  /** Editorial notes: anything uncertain or worth re-checking. Not shown in the UI. */
  notes?: string
}
