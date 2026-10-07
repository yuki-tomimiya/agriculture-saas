import type { LocationArchive } from '@/lib/weather-normals'

/** 明日からこの日数までは、過去のその年の気温ではなく予報の平均気温を足す */
export const HARVEST_FORECAST_LEAD_DAYS = 14

export type HarvestDateWindow = {
  /** アーカイブに入っている年の数（ふつう10） */
  years: number
  /** 年内に目安へ届いた年の数（端を除く前） */
  reached: number
  /** 幅に残した年の数。届いた年が4未満のときは reached と同じ */
  inside: number
  early: Date
  late: Date
}

function atNoon(date: Date): Date {
  const next = new Date(date)
  next.setHours(12, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function ymdKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** 予報の日（YYYY-MM-DD）と、その日の平均気温 */
export function forecastAvgByYmd(
  days: { date: string; maxTemp: number; minTemp: number }[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const day of days) {
    if (!day.date) continue
    map.set(day.date.slice(0, 10), (day.maxTemp + day.minTemp) / 2)
  }
  return map
}

export function forecastAvgByDate(
  days: { date: Date; avgTemp: number }[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const day of days) {
    map.set(ymdKey(day.date), day.avgTemp)
  }
  return map
}

function indexTemps(archive: LocationArchive): Map<number, Map<string, number>> {
  const byYear = new Map<number, Map<string, number>>()
  const length = Math.min(archive.times.length, archive.tempMean.length)
  for (let i = 0; i < length; i++) {
    const temp = archive.tempMean[i]
    if (temp == null || !Number.isFinite(temp)) continue
    const [yearText, monthText, dayText] = archive.times[i].split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    if (!year || !month || !day) continue
    let temps = byYear.get(year)
    if (!temps) {
      temps = new Map()
      byYear.set(year, temps)
    }
    temps.set(`${month}-${day}`, temp)
  }
  return byYear
}

function tempOn(
  temps: Map<string, number>,
  cursor: Date,
  today: Date,
  forecastUntil: Date,
  forecastByYmd: Map<string, number> | null | undefined
): number | null {
  const forecast = forecastByYmd?.get(ymdKey(cursor))
  if (
    forecast != null &&
    Number.isFinite(forecast) &&
    cursor.getTime() > today.getTime() &&
    cursor.getTime() <= forecastUntil.getTime()
  ) {
    return forecast
  }
  let month = cursor.getMonth() + 1
  let day = cursor.getDate()
  if (month === 2 && day === 29) day = 28
  const archived = temps.get(`${month}-${day}`)
  return archived != null && Number.isFinite(archived) ? archived : null
}

/**
 * 残りの積算温度を、過去の年それぞれの気温で足し、届く日の幅を出す。
 * 今日までの積算温度は currentGdd に入っている。歩き始めるのは明日から。
 * includeToday のときは today の気温も足す（来年の植付日を today にするとき）。
 * 今年の12月31日で止める。届かない年は数えない。
 * 届いた年が4年以上なら、いちばん早い年と遅い年を1つずつ除く。
 */
export function projectHarvestWindow(args: {
  today: Date
  currentGdd: number
  targetGdd: number
  baseTemp: number
  archive: LocationArchive
  forecastByYmd?: Map<string, number> | null
  includeToday?: boolean
}): HarvestDateWindow | null {
  if (args.targetGdd <= 0) return null
  const today = atNoon(args.today)
  const seasonEnd = new Date(today.getFullYear(), 11, 31, 12, 0, 0, 0)
  const byYear = indexTemps(args.archive)
  if (byYear.size === 0) return null
  const forecastUntil = addDays(today, HARVEST_FORECAST_LEAD_DAYS)
  const arrivals: Date[] = []

  if (args.currentGdd >= args.targetGdd) {
    for (let i = 0; i < byYear.size; i++) arrivals.push(new Date(today))
  } else {
    const startOffset = args.includeToday ? 0 : 1
    for (const temps of byYear.values()) {
      let heat = args.currentGdd
      let reached: Date | null = null
      for (let offset = startOffset; ; offset++) {
        const cursor = addDays(today, offset)
        if (cursor.getTime() > seasonEnd.getTime()) break
        const temp = tempOn(temps, cursor, today, forecastUntil, args.forecastByYmd)
        if (temp != null) heat += Math.max(0, temp - args.baseTemp)
        if (heat >= args.targetGdd) {
          reached = cursor
          break
        }
      }
      if (reached) arrivals.push(reached)
    }
  }

  if (arrivals.length === 0) return null
  arrivals.sort((a, b) => a.getTime() - b.getTime())
  const reached = arrivals.length
  const kept = reached >= 4 ? arrivals.slice(1, -1) : arrivals
  return {
    years: byYear.size,
    reached,
    inside: kept.length,
    early: kept[0],
    late: kept[kept.length - 1],
  }
}

/** 「9月26日〜9月30日（過去10年の気温で計算。10年中8年がこの間）」 */
export function formatHarvestWindow(
  window: HarvestDateWindow,
  options?: { provisional?: boolean }
): string {
  const same = sameDay(window.early, window.late)
  const span = same
    ? formatMonthDay(window.early)
    : `${formatMonthDay(window.early)}〜${formatMonthDay(window.late)}`
  const place = same ? 'この日' : 'この間'
  let body: string
  if (window.reached >= 4 && window.inside === window.reached - 2 && window.reached === window.years) {
    body = `${span}（過去${window.years}年の気温で計算。${window.years}年中${window.inside}年が${place}）`
  } else if (window.reached >= 4 && window.inside === window.reached - 2) {
    body = `${span}（過去${window.years}年の気温で計算。${window.years}年中${window.reached}年だけ年内に届き、極端な年を除いた${window.inside}年が${place}）`
  } else {
    body = `${span}（過去${window.years}年の気温で計算。${window.years}年中${window.reached}年だけ年内に届きます）`
  }
  if (options?.provisional) {
    body += '。目安が暫定のため、これより大きくずれることがあります'
  }
  return body
}
