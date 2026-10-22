/**
 * One-time build script: fetch Kasetsart University (Bangkhen) geometry from
 * OpenStreetMap via Overpass and write cleaned GeoJSON layers to src/data/osm/.
 *
 *   npm run fetch-osm
 *
 * The app never calls Overpass at runtime. Re-run this script when you want to
 * pick up newer OSM edits, then commit the regenerated files.
 *
 * Data © OpenStreetMap contributors, available under the ODbL.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import osmtogeojson from 'osmtogeojson'
import * as turf from '@turf/turf'
import { derive } from './derive-osm.ts'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Polygon,
} from 'geojson'

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'
/**
 * Ways whose union forms the interactive campus area:
 * - 38001215: main campus, amenity=university, name=มหาวิทยาลัยเกษตรศาสตร์
 * - 589752219: Faculty of Veterinary Medicine parcel (across Phahonyothin Rd)
 * - 589752221: Faculty of Veterinary Technology parcel (adjacent to the above)
 * The first id is the main campus; the scene origin is its centroid.
 */
const CAMPUS_WAY_IDS = [38001215, 589752219, 589752221]
/** Context ring around the campus that is rendered faded (meters). */
const CONTEXT_MARGIN_M = 350
/** ~11 cm precision is plenty for a campus map and keeps files small. */
const COORD_DECIMALS = 6

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'osm')

async function overpass(query: string): Promise<unknown> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // overpass-api.de rejects requests without a descriptive User-Agent.
        'User-Agent': 'ku-campus-map-build-script/0.1',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ data: query }),
    })
    if (res.ok) return res.json()
    console.warn(`Overpass returned ${res.status} (attempt ${attempt}/3)`)
    await new Promise((r) => setTimeout(r, 5000 * attempt))
  }
  throw new Error('Overpass request failed after 3 attempts')
}

const round = (n: number) => Number(n.toFixed(COORD_DECIMALS))

function roundCoords<G extends Geometry>(g: G): G {
  const walk = (c: unknown): unknown =>
    typeof (c as number[])[0] === 'number'
      ? (c as number[]).map(round)
      : (c as unknown[]).map(walk)
  return { ...g, coordinates: walk((g as { coordinates: unknown }).coordinates) } as G
}

type Tags = Record<string, string>

function pick(tags: Tags, keys: string[]): Tags {
  const out: Tags = {}
  for (const k of keys) if (tags[k] !== undefined) out[k] = tags[k]
  return out
}

function osmId(f: Feature): string {
  return String(f.id ?? (f.properties as { id?: string })?.id ?? '')
}

function tagsOf(f: Feature): Tags {
  const p = f.properties as { tags?: Tags } & Tags
  return p.tags ?? p
}

async function main() {
  console.log('Fetching campus boundary…')
  const boundaryRaw = await overpass(
    `[out:json][timeout:60];way(id:${CAMPUS_WAY_IDS.join(',')});out geom;`,
  )
  const parts = (osmtogeojson(boundaryRaw) as FeatureCollection).features.filter(
    (f): f is Feature<Polygon> => f.geometry.type === 'Polygon',
  )
  const main = parts.find((f) => osmId(f) === `way/${CAMPUS_WAY_IDS[0]}`)
  if (!main || parts.length !== CAMPUS_WAY_IDS.length) {
    throw new Error(`Expected ${CAMPUS_WAY_IDS.length} campus polygons, got ${parts.length}`)
  }
  const boundary = turf.union(turf.featureCollection(parts)) as Feature<Polygon | MultiPolygon>

  const center = turf.centroid(main).geometry.coordinates
  const contextPoly = turf.buffer(boundary, CONTEXT_MARGIN_M, { units: 'meters' })!
  const [w, s, e, n] = turf.bbox(contextPoly)
  const bboxStr = `${s},${w},${n},${e}`

  console.log('Fetching buildings, roads, water and green areas…')
  const raw = await overpass(`[out:json][timeout:180];
(
  way["building"](${bboxStr});
  relation["building"](${bboxStr});
  way["highway"](${bboxStr});
  way["natural"="water"](${bboxStr});
  relation["natural"="water"](${bboxStr});
  way["waterway"~"^(canal|river|stream|ditch|drain)$"](${bboxStr});
  way["landuse"~"^(reservoir|basin|grass|forest|recreation_ground|meadow|village_green|orchard|farmland|plant_nursery)$"](${bboxStr});
  way["leisure"~"^(park|garden|pitch|stadium|track|swimming_pool|sports_centre)$"](${bboxStr});
  relation["leisure"~"^(park|garden|pitch|stadium|sports_centre)$"](${bboxStr});
  way["natural"~"^(wood|scrub|grassland)$"](${bboxStr});
  node["natural"="tree"](${bboxStr});
);
out geom;`)
  const all = osmtogeojson(raw) as FeatureCollection

  const isInside = (f: Feature) => {
    try {
      const pt =
        f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
          ? turf.along(f as Feature<LineString>, turf.length(f as Feature<LineString>) / 2)
          : turf.pointOnFeature(f)
      return turf.booleanPointInPolygon(pt, boundary)
    } catch {
      return false
    }
  }

  const buildings: Feature[] = []
  const roads: Feature[] = []
  const water: Feature[] = []
  const green: Feature[] = []
  const sport: Feature[] = []
  const trees: Feature[] = []

  for (const f of all.features) {
    const tags = tagsOf(f)
    const id = osmId(f)
    const g = f.geometry
    if (!g) continue
    const isArea = g.type === 'Polygon' || g.type === 'MultiPolygon'
    const isLine = g.type === 'LineString' || g.type === 'MultiLineString'
    if (g.type === 'Point') {
      if (tags.natural === 'tree') {
        trees.push({
          type: 'Feature',
          geometry: roundCoords(g),
          properties: { id, inside: turf.booleanPointInPolygon(g.coordinates, boundary), ...pick(tags, ['name', 'species', 'leaf_type']) },
        })
      }
      continue
    }

    // Clip context features to the buffered campus so the scene has a soft edge.
    let geom: Geometry | null = g
    if (isArea || isLine) {
      const clipped = turf.bboxClip(f as Feature<Polygon | LineString>, [w, s, e, n])
      geom = clipped.geometry
      const empty =
        !geom ||
        (geom.type === 'Polygon' && geom.coordinates.length === 0) ||
        (geom.type === 'LineString' && geom.coordinates.length < 2)
      if (empty) continue
    }
    const base = { id, inside: isInside(f) }
    const feature = (props: Record<string, unknown>): Feature => ({
      type: 'Feature',
      geometry: roundCoords(geom!),
      properties: { ...base, ...props },
    })

    if (tags.building && isArea) {
      if (tags.building === 'roof' && !base.inside) continue
      buildings.push(
        feature(pick(tags, ['building', 'building:levels', 'height', 'min_height', 'roof:shape', 'name', 'name:en'])),
      )
    } else if (tags.highway && isLine) {
      let cls = roadClass(tags.highway)
      if (!cls) continue
      // Campus spine roads are tagged highway=service in OSM; treat the named ones as main.
      if (cls === 'minor' && base.inside && tags.name && !tags.service) cls = 'main'
      if (tags.tunnel === 'yes' || tags.highway === 'proposed') continue
      roads.push(
        feature({ class: cls, ...pick(tags, ['highway', 'service', 'name', 'name:en', 'lanes', 'oneway', 'bridge', 'layer']) }),
      )
    } else if ((tags.natural === 'water' || tags.landuse === 'reservoir' || tags.landuse === 'basin') && isArea) {
      water.push(feature(pick(tags, ['name', 'name:en', 'water'])))
    } else if (tags.waterway && isLine) {
      water.push(feature(pick(tags, ['waterway', 'name', 'name:en', 'width'])))
    } else if (
      isArea &&
      (tags.leisure === 'pitch' ||
        tags.leisure === 'stadium' ||
        tags.leisure === 'track' ||
        tags.leisure === 'swimming_pool' ||
        tags.leisure === 'sports_centre')
    ) {
      sport.push(feature(pick(tags, ['leisure', 'sport', 'surface', 'name', 'name:en'])))
    } else if (isArea && (tags.landuse || tags.leisure || tags.natural)) {
      green.push(feature(pick(tags, ['landuse', 'leisure', 'natural', 'name', 'name:en'])))
    }
  }

  const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features })
  const meta = {
    source: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL-1.0',
    fetchedAt: new Date().toISOString(),
    campusWayIds: CAMPUS_WAY_IDS,
    origin: { lng: round(center[0]), lat: round(center[1]) },
    bbox: [w, s, e, n].map(round),
    counts: {
      buildings: buildings.length,
      roads: roads.length,
      water: water.length,
      green: green.length,
      sport: sport.length,
      osmTrees: trees.length,
    },
  }

  await mkdir(OUT_DIR, { recursive: true })
  const write = (name: string, data: unknown) =>
    writeFile(join(OUT_DIR, name), JSON.stringify(data) + '\n')
  const boundaryClean: Feature<Polygon | MultiPolygon> = {
    type: 'Feature',
    geometry: roundCoords(boundary.geometry),
    properties: {
      ids: CAMPUS_WAY_IDS.map((i) => `way/${i}`),
      name: 'มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตบางเขน',
      'name:en': 'Kasetsart University, Bangkhen Campus',
    },
  }
  await Promise.all([
    write('boundary.json', boundaryClean),
    write('buildings.json', fc(buildings)),
    write('roads.json', fc(roads)),
    write('water.json', fc(water)),
    write('green.json', fc(green)),
    write('sport.json', fc(sport)),
    write('trees-osm.json', fc(trees)),
    writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n'),
  ])
  console.log('Wrote', OUT_DIR, meta.counts)
  await derive()
}

function roadClass(highway: string): 'main' | 'minor' | 'path' | null {
  if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(highway)) return 'main'
  if (/^(residential|unclassified|service|living_street|road)$/.test(highway)) return 'minor'
  if (/^(footway|pedestrian|path|cycleway|steps|track|corridor)$/.test(highway)) return 'path'
  return null
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
