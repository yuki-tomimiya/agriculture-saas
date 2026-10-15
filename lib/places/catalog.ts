import catalog from '@/data/municipalities.json'
import precNos from '@/data/jma-prec-no.json'

export type Municipality = {
  code: string
  prefectureCode: string
  prefectureName: string
  name: string
}

export const PLACE_PROMPT =
  '都道府県と市区町村を選んでください（県の発生予察や、これからの地域の情報に使います）'

export const MUNICIPALITIES = catalog.municipalities as Municipality[]

const prefectureMap = new Map<string, string>()
for (const row of MUNICIPALITIES) {
  if (!prefectureMap.has(row.prefectureCode)) prefectureMap.set(row.prefectureCode, row.prefectureName)
}

export const PREFECTURES = [...prefectureMap.entries()]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code))

export function prefectureByCode(code: string | null | undefined): { code: string; name: string } | null {
  if (!code) return null
  const name = prefectureMap.get(code)
  return name ? { code, name } : null
}

export function municipalityByCode(code: string | null | undefined): Municipality | null {
  if (!code) return null
  return MUNICIPALITIES.find((row) => row.code === code) ?? null
}

export function municipalitiesIn(prefectureCode: string): Municipality[] {
  return MUNICIPALITIES.filter((row) => row.prefectureCode === prefectureCode)
}

/** 気象庁の都府県・地方の番号。北海道の地方はすべて北海道。南極は一覧に入れていない。 */
export function prefectureCodeForPrecNo(precNo: number): string | null {
  const area = precNos.areas.find((row) => row.precNo === precNo)
  if (!area) return null
  const name = area.name.endsWith('地方') ? '北海道' : area.name
  return PREFECTURES.find((row) => row.name === name)?.code ?? null
}

export function parseFarmPlace(body: {
  prefectureCode?: unknown
  municipalityCode?: unknown
}): { prefectureCode: string; municipalityCode: string } | { error: string } {
  const prefectureCode = typeof body.prefectureCode === 'string' ? body.prefectureCode : ''
  const municipalityCode = typeof body.municipalityCode === 'string' ? body.municipalityCode : ''
  if (!prefectureByCode(prefectureCode)) return { error: '都道府県を選んでください' }
  const municipality = municipalityByCode(municipalityCode)
  if (!municipality || municipality.prefectureCode !== prefectureCode) {
    return { error: '市区町村を選んでください' }
  }
  return { prefectureCode, municipalityCode }
}
