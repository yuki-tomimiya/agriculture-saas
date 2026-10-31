import { loadDailyWeather } from '@/lib/open-meteo/archive'
import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
import { hasWeatherCoordinates, type WeatherPoint } from '@/lib/weather-forecast'

export type DayNormal = {
  precipMm: number
  radiationMj: number
  tempMean: number
  /** 同じ暦日の最高気温の10年平均。取得できない日は null */
  tempMax: number | null
}

export type NormalSeries = {
  precipMm: number[]
  radiationMj: number[]
  gdd: number[]
}

function monthDayKey(month: number, day: number): string {
  return `${month}-${day}`
}

export type LocationArchive = {
  times: string[]
  precip: Array<number | null>
  radiation: Array<number | null>
  tempMean: Array<number | null>
  /** 最低気温。無いときは null。初霜は年ごとに見るので、ここでは平均しない */
  tempMin: Array<number | null> | null
  /** 最高気温。無いときは null。気象ナビの10年平均との比較に使う */
  tempMax: Array<number | null> | null
}

const archiveInflight = new Map<string, Promise<LocationArchive | null>>()

/**
 * 地点の過去10年（昨年まで）を1回で取る。平年値と初霜が同じ応答を使う。
 * 失敗したときは null。
 */
export function loadLocationArchive(point?: Partial<WeatherPoint>): Promise<LocationArchive | null> {
  if (!hasWeatherCoordinates(point)) return Promise.resolve(null)
  const endYear = new Date().getFullYear() - 1
  const startYear = endYear - 9
  const latitude = Number(point!.latitude)
  const longitude = Number(point!.longitude)
  const key = `${latitude}|${longitude}|${startYear}`
  const existing = archiveInflight.get(key)
  if (existing) return existing
  const pending = fetchLocationArchive(latitude, longitude, startYear, endYear).finally(() => {
    archiveInflight.delete(key)
  })
  archiveInflight.set(key, pending)
  return pending
}

async function fetchLocationArchive(
  latitude: number,
  longitude: number,
  startYear: number,
  endYear: number
): Promise<LocationArchive | null> {
  try {
    const rows = await loadDailyWeather({ latitude, longitude }, `${startYear}-01-01`, `${endYear}-12-31`)
    if (!rows) return null
    return {
      times: rows.map(row => row.date), precip: rows.map(row => row.precip),
      radiation: rows.map(row => row.radiation), tempMean: rows.map(row => row.tempMean),
      tempMin: rows.map(row => row.tempMin), tempMax: rows.map(row => row.tempMax),
    }
  } catch { return null }
}
/**
 * 地点の過去10年（昨年まで）を1回で取り、月日ごとの平均にする。
 * 失敗したときは null。直線の目安には戻さない。
 * 最低気温は平均しない。初霜は年ごとの初日が要る。
 */
export async function getLocationDailyNormals(
  point?: Partial<WeatherPoint>
): Promise<Map<string, DayNormal> | null> {
  const archive = await loadLocationArchive(point)
  if (!archive) return null
  const { times, precip, radiation, tempMean: temps, tempMax: maxes } = archive

  const sums = new Map<
    string,
    { precip: number; radiation: number; temp: number; count: number; tempMax: number; maxCount: number }
  >()
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
    const row = sums.get(key) ?? { precip: 0, radiation: 0, temp: 0, count: 0, tempMax: 0, maxCount: 0 }
    row.precip += p
    row.radiation += r
    row.temp += t
    row.count += 1
    const mx = maxes?.[i]
    if (mx != null) {
      row.tempMax += mx
      row.maxCount += 1
    }
    sums.set(key, row)
  }
  if (sums.size < 300) return null

  const normals = new Map<string, DayNormal>()
  for (const [key, row] of sums) {
    normals.set(key, {
      precipMm: row.precip / row.count,
      radiationMj: row.radiation / row.count,
      tempMean: row.temp / row.count,
      tempMax: row.maxCount > 0 ? row.tempMax / row.maxCount : null,
    })
  }
  return normals
}

/** 予報の各日と同じ暦日の、最高気温の10年平均。取れなければ null */
export function meanNormalMaxTemp(normals: Map<string, DayNormal>, dates: string[]): number | null {
  let sum = 0
  let count = 0
  for (const ymd of dates) {
    const parts = ymd.split('-')
    const month = Number(parts[1])
    let day = Number(parts[2])
    if (!month || !day) continue
    if (month === 2 && day === 29) day = 28
    const row = normals.get(`${month}-${day}`)
    if (row?.tempMax == null) continue
    sum += row.tempMax
    count += 1
  }
  if (count === 0) return null
  return sum / count
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
  count: HeatCount,
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
      heat += dailyHeat(row.tempMean, count, baseTemp)
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
  count: HeatCount
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
      heat += dailyHeat(row.tempMean, args.count, args.baseTemp)
    }
    precipMm.push(Math.round(precip * 10) / 10)
    radiationMj.push(Math.round(radiation * 10) / 10)
    gdd.push(Math.round(heat * 10) / 10)
  }
  return { precipMm, radiationMj, gdd }
}
