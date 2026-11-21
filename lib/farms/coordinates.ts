export type FarmCoordinates = { latitude: number; longitude: number }

// 台帳 I24。市区町村の代表点の端に離島の余りを持たせた運用の範囲。
export const JAPAN_COORDINATE_BOUNDS = { south: 20, north: 46, west: 122, east: 154 } as const
export const JAPAN_LOCATION_ERROR = '日本の中の地点を選んでください'

/** 未設定の座標は許し、設定されている値は同じ範囲で確かめる。 */
export function isWithinJapanBounds(point: { latitude?: number | null; longitude?: number | null }): boolean {
  const { latitude, longitude } = point
  const { south, north, west, east } = JAPAN_COORDINATE_BOUNDS
  return (latitude == null || (Number.isFinite(latitude) && latitude >= south && latitude <= north)) &&
    (longitude == null || (Number.isFinite(longitude) && longitude >= west && longitude <= east))
}

export function roundFarmCoordinates(point: FarmCoordinates): FarmCoordinates {
  return {
    latitude: Number(point.latitude.toFixed(5)),
    longitude: Number(point.longitude.toFixed(5)),
  }
}

export function readFarmCoordinates(latitude: unknown, longitude: unknown): FarmCoordinates | null {
  const coordinate = (value: unknown) => typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  const lat = coordinate(latitude)
  const lon = coordinate(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { latitude: lat, longitude: lon }
}
