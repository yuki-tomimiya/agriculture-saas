import pointData from '@/data/municipality-points.json'
import type { FarmCoordinates } from '@/lib/farms/coordinates'

const points: Readonly<Record<string, readonly number[]>> = pointData.points
export const MUNICIPALITY_POINT_SOURCE = {
  text: pointData.source,
  url: pointData.sourceUrl,
  license: pointData.license,
  licenseUrl: pointData.licenseUrl,
}

export function municipalityMapCenter(code: string): FarmCoordinates | null {
  if (!Object.hasOwn(points, code)) return null
  const [latitude, longitude] = points[code]
  return { latitude, longitude }
}

export function prefectureMapCenter(code: string): FarmCoordinates | null {
  if (!/^\d{2}$/.test(code)) return null
  const offices = Object.entries(points).filter(([municipality]) => municipality.startsWith(code))
  if (!offices.length) return null
  // 離島などの点がある県でも、広域の表示位置は役場座標の中央値を使う。
  const median = (index: number) => {
    const sorted = offices.map(([, point]) => point[index]).sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[middle]) / 2
  }
  return { latitude: median(0), longitude: median(1) }
}
