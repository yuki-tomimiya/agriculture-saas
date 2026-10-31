import { loadDailyWeather } from '@/lib/open-meteo/archive'
import { openMeteoUrl } from '@/lib/open-meteo/url'
/**
 * 気象予報データ（気象ナビ・生育ナビで共通利用）
 * Open-Meteo APIから取得。失敗時はフォールバックを返す。
 */
import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
export type ForecastDay = {
  /** Asia/Tokyo の YYYY-MM-DD。最低気温の日付を提案に使う */
  date: string
  dayLabel: string
  weather: string
  weatherCode: number
  maxTemp: number
  minTemp: number
  precipitation: number
  wind: number
}

export type WeatherPoint = {
  latitude: number
  longitude: number
}

function labelFromDateString(ymd: string): string {
  // Date パースだとタイムゾーンで日付がずれることがあるため、文字列から直接組み立てる
  const parts = ymd.slice(0, 10).split('-')
  if (parts.length !== 3) return ymd
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!Number.isFinite(month) || !Number.isFinite(day)) return ymd
  return `${month}月${day}日`
}

/** Asia/Tokyo の今日（YYYY-MM-DD）。サーバーTZに依存しない */
function tokyoTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function weatherCodeToJa(code: number): string {
  if (code === 0) return '快晴'
  if (code === 1) return '晴れ'
  if (code === 2) return '晴れ時々くもり'
  if (code === 3) return 'くもり'
  if ([45, 48].includes(code)) return '霧'
  if ([51, 53, 55, 56, 57].includes(code)) return '霧雨'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '雨'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '雪'
  if ([95, 96, 99].includes(code)) return '雷雨'
  return '不明'
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 農場などに緯度・経度が登録されているか（未登録のときは気象APIを呼ばない） */
export function hasWeatherCoordinates(
  point?: { latitude?: number | null; longitude?: number | null } | null
): boolean {
  const latitude = Number(point?.latitude)
  const longitude = Number(point?.longitude)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
}

export async function getForecastDays(point?: Partial<WeatherPoint>): Promise<ForecastDay[]> {
  if (!hasWeatherCoordinates(point)) {
    return []
  }
  const p = {
    latitude: Number(point!.latitude),
    longitude: Number(point!.longitude),
  }
  // 日付をURLに含め、日をまたいだ古いキャッシュを使わない
  const todayYmd = tokyoTodayYmd()
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Tokyo',
    start_date: todayYmd,
    end_date: addDaysToYmd(todayYmd, 13),
  })

  try {
    const res = await fetch(openMeteoUrl('forecast', params), {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        weathercode?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: number[]
        windspeed_10m_max?: number[]
      }
    }
    const d = json.daily
    if (
      !d?.weathercode ||
      !d.time ||
      !d.temperature_2m_max ||
      !d.temperature_2m_min ||
      !d.precipitation_probability_max ||
      !d.windspeed_10m_max
    ) {
      throw new Error('Invalid Open-Meteo payload')
    }

    return d.weathercode.slice(0, 14).map((code, i) => ({
      date: d.time![i],
      dayLabel: labelFromDateString(d.time![i]),
      weather: weatherCodeToJa(code),
      weatherCode: code,
      maxTemp: Math.round(d.temperature_2m_max![i] * 10) / 10,
      minTemp: Math.round(d.temperature_2m_min![i] * 10) / 10,
      precipitation: Math.round(d.precipitation_probability_max![i] ?? 0),
      wind: Math.round((d.windspeed_10m_max![i] ?? 0) * 10) / 10,
    }))
  } catch {
    // 誤った日付のダミー予報を出さない（空配列 → UIで取得失敗を表示）
    console.error('getForecastDays failed')
    return []
  }
}

/** 日付付きの予報（本日から14日分）。GDD計算用に平均気温を付与 */
export async function getForecastDailyTemps(
  baseDate: Date = new Date(),
  point?: Partial<WeatherPoint>
): Promise<{ date: Date; avgTemp: number; maxTemp: number; minTemp: number }[]> {
  const days = await getForecastDays(point)
  return days.map((d, i) => {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i)
    date.setHours(0, 0, 0, 0)
    const avgTemp = (d.maxTemp + d.minTemp) / 2
    return { date, avgTemp, maxTemp: d.maxTemp, minTemp: d.minTemp }
  })
}

/** 保存済みの日別値を使う。作付け実績は従来どおり最高・最低から平均を計算する。 */
async function historicalRows(args: { startDate: Date; endDate: Date; point?: Partial<WeatherPoint> }) {
  // 起点の節目は正午、終点は午前0時の場合もある。同じ暦日は従来どおり含める。
  if (!hasWeatherCoordinates(args.point) || toYmd(args.startDate) > toYmd(args.endDate)) return null
  try {
    return await loadDailyWeather({ latitude: Number(args.point!.latitude), longitude: Number(args.point!.longitude) }, toYmd(args.startDate), toYmd(args.endDate))
  } catch {
    console.warn('Historical weather storage unavailable')
    return null
  }
}

export async function getHistoricalDailyTemps(args: { startDate: Date; endDate: Date; point?: Partial<WeatherPoint> }): Promise<{ date: Date; avgTemp: number; maxTemp: number; minTemp: number }[]> {
  const rows = await historicalRows(args)
  return rows?.flatMap(row => row.tempMax == null || row.tempMin == null ? [] : [{
    date: new Date(`${row.date}T00:00:00`),
    maxTemp: Math.round(row.tempMax * 10) / 10,
    minTemp: Math.round(row.tempMin * 10) / 10,
    avgTemp: Math.round(((row.tempMax + row.tempMin) / 2) * 10) / 10,
  }]) ?? []
}

export async function getHistoricalDailySunshine(args: { startDate: Date; endDate: Date; point?: Partial<WeatherPoint> }): Promise<{ date: Date; sunshineHours: number }[]> {
  const rows = await historicalRows(args)
  return rows?.flatMap(row => row.sunshine == null ? [] : [{ date: new Date(`${row.date}T00:00:00`), sunshineHours: Math.round((row.sunshine / 3600) * 10) / 10 }]) ?? []
}

export async function getHistoricalDailyRadiation(args: { startDate: Date; endDate: Date; point?: Partial<WeatherPoint> }): Promise<{ date: Date; radiationMj: number }[]> {
  const rows = await historicalRows(args)
  return rows?.flatMap(row => row.radiation == null ? [] : [{ date: new Date(`${row.date}T00:00:00`), radiationMj: Math.round(row.radiation * 10) / 10 }]) ?? []
}

export async function getHistoricalDailyPrecipitation(args: { startDate: Date; endDate: Date; point?: Partial<WeatherPoint> }): Promise<{ date: Date; precipitationMm: number }[]> {
  const rows = await historicalRows(args)
  return rows?.flatMap(row => row.precip == null ? [] : [{ date: new Date(`${row.date}T00:00:00`), precipitationMm: Math.round(row.precip * 10) / 10 }]) ?? []
}
export async function getForecastDailyPrecipitation(point?: Partial<WeatherPoint>): Promise<{
  date: Date
  dayLabel: string
  precipitationMm: number
}[]> {
  if (!hasWeatherCoordinates(point)) return []
  const p = {
    latitude: Number(point!.latitude),
    longitude: Number(point!.longitude),
  }
  const todayYmd = tokyoTodayYmd()
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    daily: 'precipitation_sum',
    timezone: 'Asia/Tokyo',
    start_date: todayYmd,
    end_date: addDaysToYmd(todayYmd, 13),
  })

  try {
    const res = await fetch(openMeteoUrl('forecast', params), {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        precipitation_sum?: number[]
      }
    }
    const times = json.daily?.time
    const rain = json.daily?.precipitation_sum
    if (!times || !rain || times.length !== rain.length) return []

    return times.slice(0, 14).map((day, i) => {
      const [y, m, d] = day.slice(0, 10).split('-').map(Number)
      const date = new Date(y, m - 1, d)
      date.setHours(0, 0, 0, 0)
      return {
        date,
        dayLabel: labelFromDateString(day),
        precipitationMm: Math.round((rain[i] ?? 0) * 10) / 10,
      }
    })
  } catch {
    console.error('getForecastDailyPrecipitation failed')
    return []
  }
}

export async function getAccumulatedGDDFromApi(args: {
  startDate: Date
  endDate: Date
  count: HeatCount
  baseTemp: number
  point?: Partial<WeatherPoint>
}): Promise<number | null> {
  const history = await getHistoricalDailyTemps({
    startDate: args.startDate,
    endDate: args.endDate,
    point: args.point,
  })
  if (history.length === 0) return null

  let sum = 0
  for (const day of history) {
    sum += dailyHeat(day.avgTemp, args.count, args.baseTemp)
  }
  return Math.round(sum * 10) / 10
}
