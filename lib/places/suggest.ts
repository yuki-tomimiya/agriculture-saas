import { formatKm, pickNearestStation } from '@/lib/jma/stations'
import { prefectureByCode, prefectureCodeForPrecNo } from '@/lib/places/catalog'

export type PlaceSuggestion = {
  prefectureCode: string
  prefectureName: string
  stationName: string
  distanceKm: string
}

/** 緯度・経度にいちばん近い気象庁の観測所の都府県番号から、県の候補を出す。市区町村は出さない。 */
export function suggestPrefecture(latitude: number, longitude: number): PlaceSuggestion | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const pick = pickNearestStation(latitude, longitude, null)
  if (!pick) return null
  const prefectureCode = prefectureCodeForPrecNo(pick.station.precNo)
  const prefecture = prefectureByCode(prefectureCode)
  if (!prefecture) return null
  return {
    prefectureCode: prefecture.code,
    prefectureName: prefecture.name,
    stationName: pick.station.name,
    distanceKm: formatKm(pick.distanceKm),
  }
}
