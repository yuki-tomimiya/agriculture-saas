export type FarmCoordinates = { latitude: number; longitude: number }

export function readFarmCoordinates(latitude: unknown, longitude: unknown): FarmCoordinates | null {
  const coordinate = (value: unknown) => typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  const lat = coordinate(latitude)
  const lon = coordinate(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { latitude: lat, longitude: lon }
}
