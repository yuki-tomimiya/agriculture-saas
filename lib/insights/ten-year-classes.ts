import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
import type { LocationArchive } from '@/lib/weather-normals'

/** 気象庁の3階級の決め方を10年に適用。3・4・3は運用の値（台帳 B8・H1）。 */
export function tenYearClass(value: number, totals: number[]): 'low' | 'middle' | 'high' | null {
  if (!Number.isFinite(value) || totals.length !== 10 || totals.some((n) => !Number.isFinite(n))) return null
  const sorted = [...totals].sort((a, b) => a - b)
  // 同値を別の階級に割り振らない。乾季など、境界が分けられないときは言い分けない。
  if (sorted[2] === sorted[3] || sorted[6] === sorted[7]) return null
  const low = (sorted[2] + sorted[3]) / 2
  const high = (sorted[6] + sorted[7]) / 2
  return value < low ? 'low' : value > high ? 'high' : 'middle'
}

/** 同じ暦日期間を各年で合計。欠測のある年は除く。年越し・2月29日にも対応する。 */
export function annualPeriodTotals(args: {
  archive: LocationArchive
  start: Date
  end: Date
  measure: 'rain' | { count: HeatCount; baseTemp: number }
}): number[] {
  const { archive, start, end, measure } = args
  if (end < start) return []
  const values = new Map(archive.times.map((date, i) => [date, measure === 'rain' ? archive.precip[i] : archive.tempMean[i]]))
  const endYear = new Date().getFullYear() - 1
  const spanYears = end.getFullYear() - start.getFullYear()
  const totals: number[] = []
  const inYear = (date: Date, year: number) => new Date(year, date.getMonth(),
    date.getMonth() === 1 && date.getDate() === 29 ? 28 : date.getDate(), 12)
  for (let year = endYear - 9; year <= endYear; year++) {
    const cursor = inYear(start, year)
    const last = inYear(end, year + spanYears)
    let total = 0
    let complete = true
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const value = values.get(key)
      if (value == null || !Number.isFinite(value)) { complete = false; break }
      total += measure === 'rain' ? value : dailyHeat(value, measure.count, measure.baseTemp)
      cursor.setDate(cursor.getDate() + 1)
    }
    if (complete) totals.push(total)
  }
  return totals
}
