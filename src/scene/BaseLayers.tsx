import { useMemo } from 'react'
import type { Feature } from 'geojson'
import { buildings, campusBoundary, green, roads, sport, water } from '../data/osm'
import { dashes, extrudedPolygons, flatPolygons, linesOf, mergeParts, offsetRing, openCCW, polygonsOf, prism, ribbons } from './geometry'
import { buildingHeight } from './heights'
import { modelledBuildingIds, modelledSportIds } from './modelSpecs'
import { colorByFacing, materials } from './materials'
import { palette } from './palette'

const ROAD_WIDTH = { main: 9, minor: 5.5, path: 2.2 } as const

/** The OSM-derived base map: ground, campus plate, green, water, roads, plain buildings. */
export function BaseLayers() {
  const geo = useMemo(() => {
    const inside = <T extends Feature>(fs: T[], v: boolean) =>
      fs.filter((f) => (f.properties as { inside: boolean }).inside === v)

    const roadLines = (cls: 'main' | 'minor' | 'path', isIn: boolean) =>
      inside(roads.features, isIn)
        .filter((f) => f.properties.class === cls && f.properties.service !== 'parking_aisle')
        .flatMap((f) => linesOf(f.geometry))

    const parks = green.features.filter((f) => f.properties.leisure === 'park' || f.properties.natural === 'wood')
    const lawns = green.features.filter((f) => !parks.includes(f))
    const sportPlain = sport.features.filter((f) => !modelledSportIds.has(f.properties.id))
    const pools = sportPlain.filter((f) => f.properties.leisure === 'swimming_pool')
    const pitches = sportPlain.filter((f) => f.properties.leisure !== 'swimming_pool')
    // Athletics pitches get a running track drawn around them.
    const tracks = pitches
      .filter((f) => /athletics/.test(f.properties.sport ?? ''))
      .flatMap((f) =>
        polygonsOf(f.geometry).map((rings) => {
          const ring = openCCW(rings[0])
          return prism(offsetRing(ring, 8), [ring], 0, 0.07)
        }),
      )

    const plainBuildings = buildings.features.filter((f) => !modelledBuildingIds.has(f.properties.id))
    const mainIn = roadLines('main', true)
    const mainOut = roadLines('main', false)

    return {
      plate: flatPolygons([campusBoundary], 0.02),
      lawn: flatPolygons(lawns, 0.05),
      park: flatPolygons(parks, 0.06),
      pitch: flatPolygons(pitches, 0.09),
      track: mergeParts(tracks),
      pool: flatPolygons(pools, 0.1),
      water: flatPolygons(water.features.filter((f) => f.geometry.type !== 'LineString'), 0.1),
      canals: ribbons(
        water.features.filter((f) => f.geometry.type === 'LineString').flatMap((f) => linesOf(f.geometry)),
        6,
        0.1,
      ),
      roadsOut: ribbons([...mainOut, ...roadLines('minor', false)], ROAD_WIDTH.minor, 0.15),
      mainOut: ribbons(mainOut, ROAD_WIDTH.main + 3, 0.14),
      roadsIn: ribbons([...mainIn, ...roadLines('minor', true)], ROAD_WIDTH.minor, 0.16),
      mainIn: ribbons(mainIn, ROAD_WIDTH.main, 0.15),
      dashes: dashes([...mainIn, ...mainOut], 0.35, 3, 4, 0.2),
      paths: ribbons(roadLines('path', true), ROAD_WIDTH.path, 0.13),
      buildingsIn: colorByFacing(
        extrudedPolygons(inside(plainBuildings, true), buildingHeight),
        palette.building,
        palette.buildingRoof,
      ),
      buildingsOut: colorByFacing(
        extrudedPolygons(inside(plainBuildings, false), buildingHeight),
        palette.buildingOutside,
        palette.buildingRoof,
      ),
    }
  }, [])

  // Flat layers, bottom to top. They skip depth writes, so this order is what you see.
  const flatLayers = [
    ['ground', null, materials.groundOutside],
    ['plate', geo.plate, materials.campusPlate],
    ['lawn', geo.lawn, materials.lawn],
    ['park', geo.park, materials.park],
    ['track', geo.track, materials.track],
    ['pitch', geo.pitch, materials.pitch],
    ['water', geo.water, materials.water],
    ['canals', geo.canals, materials.water],
    ['pool', geo.pool, materials.pool],
    ['mainOut', geo.mainOut, materials.roadOutside],
    ['roadsOut', geo.roadsOut, materials.roadOutside],
    ['paths', geo.paths, materials.path],
    ['mainIn', geo.mainIn, materials.road],
    ['roadsIn', geo.roadsIn, materials.road],
    ['dashes', geo.dashes, materials.dash],
  ] as const

  return (
    <group>
      {flatLayers.map(([key, geometry, material], i) =>
        geometry ? (
          <mesh key={key} geometry={geometry} material={material} renderOrder={i - 100} receiveShadow />
        ) : (
          <mesh key={key} rotation-x={-Math.PI / 2} material={material} renderOrder={i - 100} receiveShadow>
            <planeGeometry args={[9000, 9000]} />
          </mesh>
        ),
      )}
      <mesh geometry={geo.buildingsOut} castShadow receiveShadow material={materials.building} />
      <mesh geometry={geo.buildingsIn} castShadow receiveShadow material={materials.building} />
    </group>
  )
}
