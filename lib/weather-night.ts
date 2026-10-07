import type { LocationArchive } from '@/lib/weather-normals'
import {
  NIGHT_COOL_FROM_DAY,
  NIGHT_COOL_FROM_MONTH,
  TOMATO_POLLEN_MIN_C,
} from '@/lib/proposals/crop-kind'

export type CoolNightDate = { month: number; day: number }

function onOrAfter(month: number, day: number, fromMonth: number, fromDay: number): boolean {
  return month * 100 + day >= fromMonth * 100 + fromDay
}

/**
 * 過去の日最低気温を暦日で平均し、8月15日以降で初めて平均がしきい値未満になる日。
 * 霜（届いた年の日付を平均する）とは逆に、先に気温を平均する。
 */
export function firstMeanMinBelow(
  archive: LocationArchive,
  thresholdC = TOMATO_POLLEN_MIN_C
): CoolNightDate | null {
  if (!archive.tempMin) return null
  const mins = archive.tempMin
  const bucket = new Map<string, { sum: number; count: number }>()
  for (let i = 0; i < archive.times.length; i++) {
    const min = mins[i]
    if (min == null || Number.isNaN(min)) continue
    const ymd = archive.times[i]?.slice(0, 10) ?? ''
    const month = Number(ymd.slice(5, 7))
    const day = Number(ymd.slice(8, 10))
    if (!month || !day) continue
    if (month === 1) continue
    if (!onOrAfter(month, day, NIGHT_COOL_FROM_MONTH, NIGHT_COOL_FROM_DAY)) continue
    const key = `${month}-${day}`
    const row = bucket.get(key) ?? { sum: 0, count: 0 }
    row.sum += min
    row.count += 1
    bucket.set(key, row)
  }

  const cursor = new Date(Date.UTC(2023, NIGHT_COOL_FROM_MONTH - 1, NIGHT_COOL_FROM_DAY))
  const end = new Date(Date.UTC(2023, 11, 31))
  while (cursor.getTime() <= end.getTime()) {
    const month = cursor.getUTCMonth() + 1
    const day = cursor.getUTCDate()
    const row = bucket.get(`${month}-${day}`)
    if (row && row.count > 0 && row.sum / row.count < thresholdC) {
      return { month, day }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return null
}

/** 今年のその暦日以降か。今日がその日なら、時期に入ったものとして出す。 */
export function isOnOrAfterCoolNight(today: Date, cool: CoolNightDate): boolean {
  const todayKey = (today.getMonth() + 1) * 100 + today.getDate()
  const coolKey = cool.month * 100 + cool.day
  return todayKey >= coolKey
}
