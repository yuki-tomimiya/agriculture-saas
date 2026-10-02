import { hasWeatherCoordinates, type WeatherPoint } from '@/lib/weather-forecast'

export type DayNormal = {
  precipMm: number
  radiationMj: number
  tempMean: number
}

export type NormalSeries = {
  precipMm: number[]
  radiationMj: number[]
  gdd: number[]
}

function monthDayKey(month: number, day: number): string {
  return `${month}-${day}`
}

/**
 * 地点の過去10年（昨年まで）を1回で取り、月日ごとの平均にする。
 * 失敗したときは null。直線の目安には戻さない。
 */
export async function getLocationDailyNormals(
  point?: Partial<WeatherPoint>
): Promise<Map<string, DayNormal> | null> {
  if (!hasWeatherCoordinates(point)) return null
  const endYear = new Date().getFullYear() - 1
  const startYear = endYear - 9
  const params = new URLSearchParams({
    latitude: String(Number(point!.latitude)),
    longitude: String(Number(point!.longitude)),
    start_date: `${startYear}-01-01`,
    end_date: `${endYear}-12-31`,
    daily: 'precipitation_sum,shortwave_radiation_sum,temperature_2m_mean',
    timezone: 'Asia/Tokyo',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      daily?: {
        time?: string[]
        precipitation_sum?: Array<number | null>
        shortwave_radiation_sum?: Array<number | null>
        temperature_2m_mean?: Array<number | null>
      }
    }
    const times = json.daily?.time
    const precip = json.daily?.precipitation_sum
    const radiation = json.daily?.shortwave_radiation_sum
    const temps = json.daily?.temperature_2m_mean
    if (!times || !precip || !radiation || !temps) return null
    if (times.length !== precip.length || times.length !== radiation.length || times.length !== temps.length) {
      return null
    }

    const sums = new Map<string, { precip: number; radiation: number; temp: number; count: number }>()
    for (let i = 0; i < times.length; i++) {
      const [year, monthText, dayText] = times[i].split('-')
      const month = Number(monthText)
      const day = Number(dayText)
      if (!year || !month || !day) continue
      if (month === 2 && day === 29) continue
      const p = precip[i]
      const r = radiation[i]
      const t = temps[i]
      if (p == null || r == null || t == null) continue
      const key = monthDayKey(month, day)
      const row = sums.get(key) ?? { precip: 0, radiation: 0, temp: 0, count: 0 }
      row.precip += p
      row.radiation += r
      row.temp += t
      row.count += 1
      sums.set(key, row)
    }
    if (sums.size < 300) return null

    const normals = new Map<string, DayNormal>()
    for (const [key, row] of sums) {
      normals.set(key, {
        precipMm: row.precip / row.count,
        radiationMj: row.radiation / row.count,
        tempMean: row.temp / row.count,
      })
    }
    return normals
  } catch {
    return null
  }
}

/** 暦日の範囲（両端を含む）で、平年降水量を合計する。 */
export function sumNormalPrecip(normals: Map<string, DayNormal>, start: Date, end: Date): number | null {
  const cursor = new Date(start)
  cursor.setHours(12, 0, 0, 0)
  const last = new Date(end)
  last.setHours(12, 0, 0, 0)
  if (cursor > last) return null
  let total = 0
  let days = 0
  while (cursor <= last) {
    let month = cursor.getMonth() + 1
    let day = cursor.getDate()
    if (month === 2 && day === 29) day = 28
    const row = normals.get(`${month}-${day}`)
    if (row) {
      total += row.precipMm
      days += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (days === 0) return null
  return Math.round(total * 10) / 10
}

/** 暦日の範囲（両端を含む）で、平年の積算温度を合計する。 */
export function sumNormalGdd(
  normals: Map<string, DayNormal>,
  start: Date,
  end: Date,
  baseTemp: number
): number | null {
  const cursor = new Date(start)
  cursor.setHours(12, 0, 0, 0)
  const last = new Date(end)
  last.setHours(12, 0, 0, 0)
  if (cursor > last) return null
  let heat = 0
  let days = 0
  while (cursor <= last) {
    let month = cursor.getMonth() + 1
    let day = cursor.getDate()
    if (month === 2 && day === 29) day = 28
    const row = normals.get(`${month}-${day}`)
    if (row && Number.isFinite(row.tempMean)) {
      heat += Math.max(0, row.tempMean - baseTemp)
      days += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (days === 0) return null
  return heat
}

/** 植付日からの経過日数ぶん、平年の日別値を累積する。添字が経過日数。 */
export function accumulateNormals(args: {
  normals: Map<string, DayNormal>
  plantingDate: Date
  days: number
  baseTemp: number
}): NormalSeries {
  const start = new Date(args.plantingDate)
  start.setHours(0, 0, 0, 0)
  const precipMm: number[] = []
  const radiationMj: number[] = []
  const gdd: number[] = []
  let precip = 0
  let radiation = 0
  let heat = 0
  for (let offset = 0; offset <= args.days; offset++) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    let month = date.getMonth() + 1
    let day = date.getDate()
    if (month === 2 && day === 29) day = 28
    const row = args.normals.get(monthDayKey(month, day))
    if (row) {
      precip += row.precipMm
      radiation += row.radiationMj
      heat += Math.max(0, row.tempMean - args.baseTemp)
    }
    precipMm.push(Math.round(precip * 10) / 10)
    radiationMj.push(Math.round(radiation * 10) / 10)
    gdd.push(Math.round(heat * 10) / 10)
  }
  return { precipMm, radiationMj, gdd }
}
