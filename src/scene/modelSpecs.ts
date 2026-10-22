/**
 * How each featured landmark is modelled. Rendering hints only; the content
 * (names, descriptions) lives in src/data/landmarks.ts.
 *
 * `buildings` are OSM building ids from src/data/osm/buildings.json. Those
 * footprints are removed from the plain-block layer and rebuilt in the given
 * style. Heights use OSM building:levels when present, else `levels`.
 */
export type BuildingStyle = 'modern' | 'hip' | 'thai' | 'hall' | 'pavilion' | 'canopy'

export type ModelSpec =
  | { kind: 'building'; style: BuildingStyle; buildings: string[]; levels?: number }
  | { kind: 'stadium'; stadium: string; pitch: string }
  | { kind: 'pool'; deck: string; pools: string[] }
  | { kind: 'monument'; facing: string }
  /** A gateway across the road nearest the landmark's coordinates; width in meters. */
  | { kind: 'gate'; width: number }

export const landmarkModels: Record<string, ModelSpec> = {
  auditorium: { kind: 'building', style: 'thai', buildings: ['way/259685345'], levels: 3 },
  'hexagonal-pavilion': { kind: 'building', style: 'pavilion', buildings: ['way/259496890'] },
  'chakrabandh-pensiri': { kind: 'building', style: 'hall', buildings: ['way/157198880'], levels: 3 },
  'golden-jubilee': { kind: 'building', style: 'modern', buildings: ['way/403121488'], levels: 10 },
  library: { kind: 'building', style: 'modern', buildings: ['way/336752159'] },
  'fac-agriculture': { kind: 'building', style: 'hip', buildings: ['way/138193948', 'way/397523109'], levels: 3 },
  'fac-engineering': { kind: 'building', style: 'modern', buildings: ['way/94170891'] },
  'fac-science': { kind: 'building', style: 'modern', buildings: ['way/146461741', 'way/239146929'] },
  // No levels in OSM; ~8 storeys judged from the Commons photo of the building.
  'fac-business': { kind: 'building', style: 'modern', buildings: ['way/544276176'], levels: 8 },
  'canteen-1': { kind: 'building', style: 'canopy', buildings: ['way/389998960'] },
  'ku-avenue': { kind: 'building', style: 'modern', buildings: ['way/389998800'], levels: 2 },
  'lecture-hall-1': { kind: 'building', style: 'modern', buildings: ['way/173271563'] },
  'gate-ngamwongwan-1': { kind: 'gate', width: 22 },
  stadium: { kind: 'stadium', stadium: 'way/1313552698', pitch: 'way/115810001' },
  'swimming-pool': {
    kind: 'pool',
    deck: 'way/157198906',
    pools: ['way/530953467', 'way/530953468', 'way/530953469', 'way/1382485510', 'way/1382485511'],
  },
  // Statues face away from the Kasetrathikarn Institute building behind them.
  'three-founders': { kind: 'monument', facing: 'way/259504600' },
}

/** OSM footprints owned by a detailed model, so the base layer can skip them. */
export const modelledBuildingIds = new Set(
  Object.values(landmarkModels).flatMap((m) =>
    m.kind === 'building' ? m.buildings : m.kind === 'pool' ? [m.deck] : [],
  ),
)

/** Sport areas drawn by a detailed model instead of the flat sport layer. */
export const modelledSportIds = new Set(
  Object.values(landmarkModels).flatMap((m) =>
    m.kind === 'stadium' ? [m.stadium, m.pitch] : m.kind === 'pool' ? m.pools : [],
  ),
)
