import meta from '../data/osm/meta.json'

/** Campus-center origin (centroid of the OSM campus boundary). */
export const ORIGIN = meta.origin

const R = 6378137
const DEG = Math.PI / 180
const COS_LAT0 = Math.cos(ORIGIN.lat * DEG)

/**
 * Project WGS84 lng/lat to local meters around the campus origin
 * (equirectangular; error is negligible across a ~2 km campus).
 * Returns [east, north]. In the 3D scene east = +x and north = -z.
 */
export function project(lng: number, lat: number): [number, number] {
  return [(lng - ORIGIN.lng) * DEG * R * COS_LAT0, (lat - ORIGIN.lat) * DEG * R]
}

/** Scene position (x, z) for a lng/lat. */
export function toScene(lng: number, lat: number): [number, number] {
  const [e, n] = project(lng, lat)
  return [e, -n]
}
