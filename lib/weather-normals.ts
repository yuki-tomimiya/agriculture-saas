import { loadDailyWeather } from '@/lib/open-meteo/archive'
import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
import { hasWeatherCoordinates, type WeatherPoint } from '@/lib/weather-forecast'
import { STATION_ENOUGH_YEARS } from '@/lib/jma/thresholds'

export type DayNormal = {
  precipMm: number | null
  radiationMj: number | null
  tempMean: number | null
  /** 同じ暦日の最高気温の10年平均。取得できない日は null */
  tempMax: number | null
}

export type NormalSeries = {
  precipMm: number[] | null
  radiationMj: number[] | null
  gdd: number[] | null
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
export function loadLocationArchive(point?: Partial<WeatherPoint>, now = new Date()): Promise<LocationArchive | null> {
  if (!hasWeatherCoordinates(point)) return Promise.resolve(null)
  const endYear = now.getFullYear() - 1
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
  return dailyNormalsFromArchive(await loadLocationArchive(point))
}

/** 台帳 I23。同じ月日の記録が十分ある日だけを数え、要素ごとに平均する。 */
function dailyAverage(times: string[], values: LocationArchive['tempMax']): Map<string, number> {
  const sums = new Map<string, { sum: number; years: Set<string> }>()
  if (!values) return new Map()
  for (let i = 0; i < times.length; i++) {
    const value = values[i]
    if (value == null || !Number.isFinite(value)) continue
    const [year, monthText, dayText] = times[i].split('-')
    const month = Number(monthText)
    const day = Number(dayText)
    if (!year || !month || !day) continue
    if (month === 2 && day === 29) continue
    const key = monthDayKey(month, day)
    const row = sums.get(key) ?? { sum: 0, years: new Set<string>() }
    if (row.years.has(year)) continue
    row.sum += value
    row.years.add(year)
    sums.set(key, row)
  }
  const averages = new Map<string, number>()
  for (const [key, row] of sums) {
    if (row.years.size >= STATION_ENOUGH_YEARS) averages.set(key, row.sum / row.years.size)
  }
  return averages.size >= 300 ? averages : new Map()
}

export function dailyNormalsFromArchive(archive: LocationArchive | null): Map<string, DayNormal> | null {
  if (!archive) return null
  const precip = dailyAverage(archive.times, archive.precip)
  const radiation = dailyAverage(archive.times, archive.radiation)
  const temps = dailyAverage(archive.times, archive.tempMean)
  const maxes = dailyAverage(archive.times, archive.tempMax)
  const keys = new Set([...precip.keys(), ...radiation.keys(), ...temps.keys(), ...maxes.keys()])
  if (!keys.size) return null
  const normals = new Map<string, DayNormal>()
  for (const key of keys) {
    normals.set(key, {
      precipMm: precip.get(key) ?? null,
      radiationMj: radiation.get(key) ?? null,
      tempMean: temps.get(key) ?? null,
      tempMax: maxes.get(key) ?? null,
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
    if (!month || !day) return null
    if (month === 2 && day === 29) day = 28
    const row = normals.get(`${month}-${day}`)
    if (row?.tempMax == null) return null
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
  while (cursor <= last) {
    let month = cursor.getMonth() + 1
    let day = cursor.getDate()
    if (month === 2 && day === 29) day = 28
    const precipMm = normals.get(`${month}-${day}`)?.precipMm
    if (precipMm == null) return null
    total += precipMm
    cursor.setDate(cursor.getDate() + 1)
  }
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
  while (cursor <= last) {
    let month = cursor.getMonth() + 1
    let day = cursor.getDate()
    if (month === 2 && day === 29) day = 28
    const tempMean = normals.get(`${month}-${day}`)?.tempMean
    if (tempMean == null) return null
    heat += dailyHeat(tempMean, count, baseTemp)
    cursor.setDate(cursor.getDate() + 1)
  }
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
  const daily: (DayNormal | undefined)[] = []
  for (let offset = 0; offset <= args.days; offset++) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    let month = date.getMonth() + 1
    let day = date.getDate()
    if (month === 2 && day === 29) day = 28
    daily.push(args.normals.get(monthDayKey(month, day)))
  }
  return {
    precipMm: accumulateNormal(daily.map(row => row?.precipMm)),
    radiationMj: accumulateNormal(daily.map(row => row?.radiationMj)),
    gdd: accumulateNormal(daily.map(row =>
      row?.tempMean == null ? null : dailyHeat(row.tempMean, args.count, args.baseTemp))),
  }
}

function accumulateNormal(values: (number | null | undefined)[]): number[] | null {
  const series: number[] = []
  let total = 0
  for (const value of values) {
    if (value == null) return null
    total += value
    series.push(Math.round(total * 10) / 10)
  }
  return series
}
