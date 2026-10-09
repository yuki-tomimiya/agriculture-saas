import type { DayNormal } from '@/lib/weather-normals'

/** 農研機構 野菜茶業研究所「野菜の種類別作型一覧（2009年度版）」研究資料第5号（2010年）p.6 */
export const CLIMATE_REGION_SOURCE = {
  publisher: '農研機構 野菜茶業研究所',
  name: '野菜の種類別作型一覧（2009年度版）',
  detail: '研究資料第5号（2010年）p.6',
  url: 'https://www.naro.go.jp/PUBLICITY_REPORT/publication/archive/files/yacya_shiryou_5.pdf',
} as const

/**
 * 境目からこの℃以内は「境目あたり」と言う。
 * ⚙ 区分の幅が約3℃なので、±1.5℃だと真ん中まで境目になる。±1.0℃にした。
 */
export const CLIMATE_REGION_EDGE_C = 1

const EDGES = [
  { at: 9, low: '寒地', high: '寒冷地' },
  { at: 12, low: '寒冷地', high: '温暖地' },
  { at: 15, low: '温暖地', high: '暖地' },
  { at: 18, low: '暖地', high: '亜熱帯' },
] as const

export function meanAnnualTemp(normals: Iterable<Pick<DayNormal, 'tempMean'>>): number | null {
  let sum = 0
  let count = 0
  for (const row of normals) {
    if (row.tempMean == null || !Number.isFinite(row.tempMean)) continue
    sum += row.tempMean
    count += 1
  }
  if (count < 300) return null
  return sum / count
}

export function climateRegionSentence(meanC: number): string {
  const shown = (Math.round(meanC * 10) / 10).toFixed(1)
  const nearest = EDGES.map((edge) => ({ ...edge, distance: Math.abs(meanC - edge.at) })).sort(
    (a, b) => a.distance - b.distance
  )[0]
  const tail = `（年平均気温 ${shown}℃・10年平均（推計））`
  if (nearest && nearest.distance <= CLIMATE_REGION_EDGE_C) {
    return `この農場は、農研機構の地域区分では${nearest.high}と${nearest.low}の境目あたりです${tail}。地域の境目は明確ではなく、年平均気温は目安です。`
  }
  const name =
    meanC < 9 ? '寒地' : meanC < 12 ? '寒冷地' : meanC < 15 ? '温暖地' : meanC < 18 ? '暖地' : '亜熱帯'
  return `この農場は、農研機構の地域区分では${name}の目安です${tail}。地域の境目は明確ではなく、年平均気温は目安です。`
}
