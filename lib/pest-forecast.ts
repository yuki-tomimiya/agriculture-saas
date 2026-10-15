import offices from '@/data/pest-forecast-offices.json'
import { prefectureByCode } from '@/lib/places/catalog'

export const MAFF_PEST_LIST_URL = offices.maffListUrl

export type PestForecastOffice = {
  prefectureName: string
  officeName: string
  url: string
  checkedOn: string
  officePageVerified: boolean
}

export function forecastOffice(prefectureCode: string | null | undefined): PestForecastOffice | null {
  const prefecture = prefectureByCode(prefectureCode)
  if (!prefecture) return null
  return offices.offices.find((office) => office.prefectureName === prefecture.name) ?? null
}
