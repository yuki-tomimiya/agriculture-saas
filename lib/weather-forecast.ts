import { loadDailyWeather } from '@/lib/open-meteo/archive'
import { fetchOpenMeteo } from '@/lib/open-meteo/fetch'
/**
 * 気象予報データ（気象ナビ・生育ナビで共通利用）
 * Open-Meteo APIから取得。失敗時はフォールバックを返す。
 */
import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
import { FORECAST_LEAD_DAYS } from '@/lib/weather-thresholds'
export type ForecastDay = {
  /** Asia/Tokyo の YYYY-MM-DD。最低気温の日付を提案に使う */
  date: string
  dayLabel: string
  weather: string
  weatherCode: number
  maxTemp: number | null
  minTemp: number | null
  /** Open-Meteoの日平均。欠測時はnullで、最高・最低から補わない。 */
  avgTemp: number | null
  precipitation: number | null
  wind: number | null
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
function tokyoTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
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

function forecastValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 農場などに緯度・経度が登録されているか（未登録のときは気象APIを呼ばない） */
export function hasWeatherCoordinates(
  point?: { latitude?: number | string | null; longitude?: number | string | null } | null
): boolean {
  return [point?.latitude, point?.longitude].every(value =>
    typeof value === 'number' ? Number.isFinite(value) :
      typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)),
  )
}

export async function getForecastDays(point?: Partial<WeatherPoint>, now = new Date()): Promise<ForecastDay[]> {
  if (!hasWeatherCoordinates(point)) {
    return []
  }
  const p = {
    latitude: Number(point!.latitude),
    longitude: Number(point!.longitude),
  }
  // 日付をURLに含め、日をまたいだ古いキャッシュを使わない
  const todayYmd = tokyoTodayYmd(now)
  const lastYmd = addDaysToYmd(todayYmd, FORECAST_LEAD_DAYS)
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_probability_max,windspeed_10m_max',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Tokyo',
    start_date: todayYmd,
    end_date: lastYmd,
  })

  try {
    const res = await fetchOpenMeteo('forecast', params, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        weathercode?: unknown[]
        temperature_2m_max?: unknown[]
        temperature_2m_min?: unknown[]
        temperature_2m_mean?: unknown[]
        precipitation_probability_max?: unknown[]
        windspeed_10m_max?: unknown[]
      }
    }
    const d = json.daily
    if (!Array.isArray(d?.time)) return []
    return d.time.flatMap((date, i) => {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayYmd || date > lastYmd) return []
      const code = forecastValue(d.weathercode?.[i]) ?? -1
      return [{
        date,
        dayLabel: labelFromDateString(date),
        weather: weatherCodeToJa(code),
        weatherCode: code,
        maxTemp: forecastValue(d.temperature_2m_max?.[i]),
        minTemp: forecastValue(d.temperature_2m_min?.[i]),
        avgTemp: forecastValue(d.temperature_2m_mean?.[i]),
        precipitation: forecastValue(d.precipitation_probability_max?.[i]),
        wind: forecastValue(d.windspeed_10m_max?.[i]),
      }]
    }).sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    // 誤った日付のダミー予報を出さない（空配列 → UIで取得失敗を表示）
    console.error('getForecastDays failed')
    return []
  }
}

/** 明日から14日先までの日平均。欠測日はGDD計算に使わない。 */
export async function getForecastDailyTemps(
  baseDate: Date = new Date(),
  point?: Partial<WeatherPoint>
): Promise<{ date: Date; avgTemp: number }[]> {
  const today = tokyoTodayYmd(baseDate)
  const days = await getForecastDays(point, baseDate)
  return days.flatMap((d) => {
    if (d.date <= today || d.avgTemp == null) return []
    // 欠測日を省いても後の日付を詰めない。APIのAsia/Tokyoの日付を使う。
    const date = new Date(`${d.date}T00:00:00`)
    return [{ date, avgTemp: d.avgTemp }]
  })
}

/** 保存済みの日別値を使う。日平均はAPIの24時間平均（根拠台帳A1）。 */
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
  return rows?.flatMap(row => row.tempMean == null || row.tempMax == null || row.tempMin == null ? [] : [{
    date: new Date(`${row.date}T00:00:00`),
    maxTemp: Math.round(row.tempMax * 10) / 10,
    minTemp: Math.round(row.tempMin * 10) / 10,
    avgTemp: Math.round(row.tempMean * 10) / 10,
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
export async function getForecastDailyPrecipitation(point?: Partial<WeatherPoint>, now = new Date()): Promise<{
  date: Date
  dayLabel: string
  precipitationMm: number
}[]> {
  if (!hasWeatherCoordinates(point)) return []
  const p = {
    latitude: Number(point!.latitude),
    longitude: Number(point!.longitude),
  }
  const todayYmd = tokyoTodayYmd(now)
  const lastYmd = addDaysToYmd(todayYmd, FORECAST_LEAD_DAYS)
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    daily: 'precipitation_sum',
    timezone: 'Asia/Tokyo',
    start_date: todayYmd,
    end_date: lastYmd,
  })

  try {
    const res = await fetchOpenMeteo('forecast', params, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        precipitation_sum?: unknown[]
      }
    }
    const times = json.daily?.time
    const rain = json.daily?.precipitation_sum
    if (!Array.isArray(times)) return []

    return times.flatMap((day, i) => {
      const precipitationMm = forecastValue(rain?.[i])
      if (precipitationMm == null || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < todayYmd || day > lastYmd) return []
      const [y, m, d] = day.slice(0, 10).split('-').map(Number)
      const date = new Date(y, m - 1, d)
      date.setHours(0, 0, 0, 0)
      return [{
        date,
        dayLabel: labelFromDateString(day),
        precipitationMm,
      }]
    }).sort((a, b) => +a.date - +b.date)
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
