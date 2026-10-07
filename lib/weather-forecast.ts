/**
 * 気象予報データ（気象ナビ・生育ナビで共通利用）
 * Open-Meteo APIから取得。失敗時はフォールバックを返す。
 */
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
    timezone: 'Asia/Tokyo',
    start_date: todayYmd,
    end_date: addDaysToYmd(todayYmd, 13),
  })

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
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
  } catch (error) {
    // 誤った日付のダミー予報を出さない（空配列 → UIで取得失敗を表示）
    console.error('getForecastDays failed:', error)
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

export async function getHistoricalDailyTemps(args: {
  startDate: Date
  endDate: Date
  point?: Partial<WeatherPoint>
}): Promise<{ date: Date; avgTemp: number; maxTemp: number; minTemp: number }[]> {
  if (!hasWeatherCoordinates(args.point)) return []
  const p = {
    latitude: Number(args.point!.latitude),
    longitude: Number(args.point!.longitude),
  }
  const start = new Date(args.startDate)
  const end = new Date(args.endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start > end) return []

  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    start_date: toYmd(start),
    end_date: toYmd(end),
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Tokyo',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`Open-Meteo archive failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
      }
    }
    const times = json.daily?.time
    const maxes = json.daily?.temperature_2m_max
    const mins = json.daily?.temperature_2m_min
    if (!times || !maxes || !mins || times.length !== maxes.length || maxes.length !== mins.length) return []

    return times.map((day, i) => {
      const date = new Date(`${day}T00:00:00`)
      const maxTemp = Math.round(maxes[i] * 10) / 10
      const minTemp = Math.round(mins[i] * 10) / 10
      const avgTemp = Math.round(((maxes[i] + mins[i]) / 2) * 10) / 10
      return { date, avgTemp, maxTemp, minTemp }
    })
  } catch (error) {
    console.error('getHistoricalDailyTemps fallback:', error)
    return []
  }
}

export async function getHistoricalDailySunshine(args: {
  startDate: Date
  endDate: Date
  point?: Partial<WeatherPoint>
}): Promise<{ date: Date; sunshineHours: number }[]> {
  if (!hasWeatherCoordinates(args.point)) return []
  const p = {
    latitude: Number(args.point!.latitude),
    longitude: Number(args.point!.longitude),
  }
  const start = new Date(args.startDate)
  const end = new Date(args.endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start > end) return []

  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    start_date: toYmd(start),
    end_date: toYmd(end),
    daily: 'sunshine_duration',
    timezone: 'Asia/Tokyo',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`Open-Meteo archive failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        sunshine_duration?: number[]
      }
    }
    const times = json.daily?.time
    const sunshineSeconds = json.daily?.sunshine_duration
    if (!times || !sunshineSeconds || times.length !== sunshineSeconds.length) return []

    return times.map((day, i) => {
      const date = new Date(`${day}T00:00:00`)
      const sunshineHours = Math.round(((sunshineSeconds[i] ?? 0) / 3600) * 10) / 10
      return { date, sunshineHours }
    })
  } catch (error) {
    console.error('getHistoricalDailySunshine fallback:', error)
    return []
  }
}

export async function getHistoricalDailyRadiation(args: {
  startDate: Date
  endDate: Date
  point?: Partial<WeatherPoint>
}): Promise<{ date: Date; radiationMj: number }[]> {
  if (!hasWeatherCoordinates(args.point)) return []
  const p = {
    latitude: Number(args.point!.latitude),
    longitude: Number(args.point!.longitude),
  }
  const start = new Date(args.startDate)
  const end = new Date(args.endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start > end) return []

  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    start_date: toYmd(start),
    end_date: toYmd(end),
    daily: 'shortwave_radiation_sum',
    timezone: 'Asia/Tokyo',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`Open-Meteo archive failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        shortwave_radiation_sum?: number[]
      }
    }
    const times = json.daily?.time
    const radiation = json.daily?.shortwave_radiation_sum
    if (!times || !radiation || times.length !== radiation.length) return []

    return times.map((day, i) => {
      const date = new Date(`${day}T00:00:00`)
      const radiationMj = Math.round((radiation[i] ?? 0) * 10) / 10
      return { date, radiationMj }
    })
  } catch (error) {
    console.error('getHistoricalDailyRadiation fallback:', error)
    return []
  }
}

export async function getHistoricalDailyPrecipitation(args: {
  startDate: Date
  endDate: Date
  point?: Partial<WeatherPoint>
}): Promise<{ date: Date; precipitationMm: number }[]> {
  if (!hasWeatherCoordinates(args.point)) return []
  const p = {
    latitude: Number(args.point!.latitude),
    longitude: Number(args.point!.longitude),
  }
  const start = new Date(args.startDate)
  const end = new Date(args.endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start > end) return []

  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    start_date: toYmd(start),
    end_date: toYmd(end),
    daily: 'precipitation_sum',
    timezone: 'Asia/Tokyo',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`Open-Meteo archive failed: ${res.status}`)
    const json = await res.json() as {
      daily?: {
        time?: string[]
        precipitation_sum?: number[]
      }
    }
    const times = json.daily?.time
    const rain = json.daily?.precipitation_sum
    if (!times || !rain || times.length !== rain.length) return []

    return times.map((day, i) => ({
      date: new Date(`${day}T00:00:00`),
      precipitationMm: Math.round((rain[i] ?? 0) * 10) / 10,
    }))
  } catch (error) {
    console.error('getHistoricalDailyPrecipitation fallback:', error)
    return []
  }
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
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
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
  } catch (error) {
    console.error('getForecastDailyPrecipitation failed:', error)
    return []
  }
}

export async function getAccumulatedGDDFromApi(args: {
  startDate: Date
  endDate: Date
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
    sum += Math.max(0, day.avgTemp - args.baseTemp)
  }
  return Math.round(sum * 10) / 10
}
