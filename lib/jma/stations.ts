import { readFileSync } from 'fs'
import path from 'path'
import { STATION_FAR_KM, STATION_NEAR_ELEV_M, STATION_NEAR_KM } from '@/lib/jma/thresholds'

export type JmaStation = {
  precNo: number
  /** s = 気象官署、a = アメダス */
  kind: 's' | 'a'
  blockNo: string
  name: string
  lat: number
  lon: number
  elevationM: number
}

export type StationCatalog = {
  fetchedOn: string
  sourceUrl: string
  stations: JmaStation[]
}

export type StationPick = {
  station: JmaStation
  distanceKm: number
  elevationDiffM: number | null
  /** 20km 以内、かつ標高差が分かるときは 100m 以内 */
  near: boolean
  /** 40km より遠ければ使わない */
  usable: boolean
}

const CATALOG_PATH = path.join(process.cwd(), 'data', 'jma-stations.json')

let cached: StationCatalog | null = null

export function loadStationCatalog(): StationCatalog {
  if (cached) return cached
  const raw = readFileSync(CATALOG_PATH, 'utf8')
  cached = JSON.parse(raw) as StationCatalog
  return cached
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function pickNearestStation(
  lat: number,
  lon: number,
  farmElevationM: number | null,
  stations: JmaStation[] = loadStationCatalog().stations
): StationPick | null {
  let best: StationPick | null = null
  for (const station of stations) {
    const distance = distanceKm(lat, lon, station.lat, station.lon)
    if (best && distance >= best.distanceKm) continue
    const elevationDiffM =
      farmElevationM == null ? null : Math.round(Math.abs(farmElevationM - station.elevationM))
    const elevOk = elevationDiffM == null || elevationDiffM <= STATION_NEAR_ELEV_M
    best = {
      station,
      distanceKm: distance,
      elevationDiffM,
      near: distance <= STATION_NEAR_KM && elevOk,
      usable: distance <= STATION_FAR_KM,
    }
  }
  return best
}

export function formatKm(km: number): string {
  const rounded = Math.round(km * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** 度と分（小数）を十進度にする */
export function dmsToDeg(degrees: string, minutes: string): number {
  const sign = Number(degrees) < 0 ? -1 : 1
  return Number(degrees) + sign * (Number(minutes) / 60)
}
