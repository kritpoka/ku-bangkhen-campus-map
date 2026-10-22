import { useMemo } from 'react'
import { buildings, campusBoundary, green, roads, sport, water } from '../data/osm'
import { extrudedPolygons, flatPolygons, linesOf, ribbons } from './geometry'
import { buildingHeight } from './heights'
import { palette } from './palette'
import type { Feature } from 'geojson'

const ROAD_WIDTH = { main: 9, minor: 5.5, path: 2.2 } as const

/** The OSM-derived base map: ground, campus plate, green, water, roads, buildings. */
export function BaseLayers() {
  const geo = useMemo(() => {
    const byInside = <T extends Feature>(fs: T[], inside: boolean) =>
      fs.filter((f) => (f.properties as { inside: boolean }).inside === inside)

    const roadLines = (cls: 'main' | 'minor' | 'path', inside: boolean) =>
      byInside(roads.features, inside)
        .filter((f) => f.properties.class === cls && f.properties.service !== 'parking_aisle')
        .flatMap((f) => linesOf(f.geometry))

    const waterAreas = water.features.filter((f) => f.geometry.type !== 'LineString')
    const canals = water.features.filter((f) => f.geometry.type === 'LineString')

    return {
      plate: flatPolygons([campusBoundary], 0.02),
      green: flatPolygons(green.features, 0.05),
      sport: flatPolygons(sport.features, 0.08),
      water: flatPolygons(waterAreas, 0.1),
      canals: ribbons(canals.flatMap((f) => linesOf(f.geometry)), 6, 0.1),
      roadsIn: ribbons([...roadLines('main', true), ...roadLines('minor', true)], ROAD_WIDTH.minor, 0.15),
      pathsIn: ribbons(roadLines('path', true), ROAD_WIDTH.path, 0.13),
      roadsOut: ribbons(
        [...roadLines('main', false), ...roadLines('minor', false)],
        ROAD_WIDTH.minor,
        0.15,
      ),
      buildingsIn: extrudedPolygons(byInside(buildings.features, true), buildingHeight),
      buildingsOut: extrudedPolygons(byInside(buildings.features, false), buildingHeight),
    }
  }, [])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshLambertMaterial color={palette.groundOutside} />
      </mesh>
      <mesh geometry={geo.plate} receiveShadow>
        <meshLambertMaterial color={palette.campusPlate} />
      </mesh>
      <mesh geometry={geo.green} receiveShadow>
        <meshLambertMaterial color={palette.lawn} />
      </mesh>
      <mesh geometry={geo.sport} receiveShadow>
        <meshLambertMaterial color={palette.pitch} />
      </mesh>
      <mesh geometry={geo.water}>
        <meshLambertMaterial color={palette.water} />
      </mesh>
      <mesh geometry={geo.canals}>
        <meshLambertMaterial color={palette.water} />
      </mesh>
      <mesh geometry={geo.roadsOut} receiveShadow>
        <meshLambertMaterial color={palette.roadOutside} />
      </mesh>
      <mesh geometry={geo.roadsIn} receiveShadow>
        <meshLambertMaterial color={palette.road} />
      </mesh>
      <mesh geometry={geo.pathsIn} receiveShadow>
        <meshLambertMaterial color={palette.path} />
      </mesh>
      <mesh geometry={geo.buildingsOut} castShadow receiveShadow>
        <meshLambertMaterial color={palette.buildingOutside} />
      </mesh>
      <mesh geometry={geo.buildingsIn} castShadow receiveShadow>
        <meshLambertMaterial color={palette.building} />
      </mesh>
    </group>
  )
}
