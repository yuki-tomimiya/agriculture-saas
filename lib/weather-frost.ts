import { loadLocationArchive } from '@/lib/weather-normals'
import type { WeatherPoint } from '@/lib/weather-forecast'

/** 最低気温がこの値以下なら霜のおそれ。気象台の「3〜4℃」の安全側 */
export const FROST_RISK_MAX_C = 4

/** 平年値と同じ、昨年までの10年。届いた年がこれより少ないときは「10年中○年」と言う */
export const FROST_ARCHIVE_YEARS = 10

export type MonthDay = { month: number; day: number }

export type FirstFrostSummary = {
  mean: MonthDay
  earliest: MonthDay
  years: number
}

function inAutumnWindow(month: number, day: number): boolean {
  if (month < 8 || month > 12) return false
  if (month === 8 && day < 15) return false
  return true
}

function monthDayOrder(value: MonthDay): number {
  return value.month * 100 + value.day
}

function averageMonthDay(dates: MonthDay[]): MonthDay {
  const total = dates.reduce((sum, value) => sum + Date.UTC(2001, value.month - 1, value.day), 0)
  const rounded = new Date(Math.round(total / dates.length))
  return { month: rounded.getUTCMonth() + 1, day: rounded.getUTCDate() }
}

/**
 * 年ごとに、8月15日〜12月31日で初めて最低気温4℃以下になった日を出す。
 * 暦日の平均気温から探すと寒波がならされ、初霜が遅く出る。届かなかった年は数えない。
 */
export function summarizeAutumnFirstFrost(
  times: string[],
  mins: Array<number | null>
): FirstFrostSummary | null {
  const firstByYear = new Map<number, MonthDay | null>()
  const length = Math.min(times.length, mins.length)
  for (let i = 0; i < length; i++) {
    const [yearText, monthText, dayText] = times[i].split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    if (!year || !month || !day || !inAutumnWindow(month, day)) continue
    if (!firstByYear.has(year)) firstByYear.set(year, null)
    if (firstByYear.get(year)) continue
    const min = mins[i]
    if (min == null || min > FROST_RISK_MAX_C) continue
    firstByYear.set(year, { month, day })
  }
  const found = [...firstByYear.values()].filter((value): value is MonthDay => value != null)
  if (found.length === 0) return null
  const earliest = found.reduce((soonest, value) =>
    monthDayOrder(value) < monthDayOrder(soonest) ? value : soonest
  )
  return { mean: averageMonthDay(found), earliest, years: found.length }
}

export async function getLocationFirstFrost(
  point?: Partial<WeatherPoint>
): Promise<FirstFrostSummary | null> {
  const archive = await loadLocationArchive(point)
  if (!archive?.tempMin) return null
  return summarizeAutumnFirstFrost(archive.times, archive.tempMin)
}

export function formatMonthDay(value: MonthDay): string {
  return `${value.month}月${value.day}日`
}

export function formatYmd(ymd: string): string {
  const [, monthText, dayText] = ymd.split('-')
  return `${Number(monthText)}月${Number(dayText)}日`
}

export function formatCelsius(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

/** 今年のその月日まであと何日か。過ぎていれば負 */
export function daysUntilMonthDay(today: Date, value: MonthDay): number {
  const target = new Date(today.getFullYear(), value.month - 1, value.day, 12, 0, 0, 0)
  const start = new Date(today)
  start.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

export function daysUntilYmd(today: Date, ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number)
  const target = new Date(year, month - 1, day, 12, 0, 0, 0)
  const start = new Date(today)
  start.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}
