import { prisma } from '@/lib/prisma'
import { openMeteoUrl } from './url'

/** ⚙ 運用の値（根拠台帳I14）：直近7日を24時間ごとに更新。昨年以前は取り直さない。 */
export const ARCHIVE_REFRESH_DAYS = 7
const REFRESH_MS = 24 * 60 * 60 * 1000
const RETRY_MS = 60 * 60 * 1000
const queues = new Map<string, Promise<void>>()
const retryAfter = new Map<string, number>()
const variables = {
  tempMean: 'temperature_2m_mean', tempMax: 'temperature_2m_max', tempMin: 'temperature_2m_min',
  precip: 'precipitation_sum', radiation: 'shortwave_radiation_sum', sunshine: 'sunshine_duration',
} as const
type Field = keyof typeof variables

export function weatherLocation(point: { latitude: number; longitude: number }): string {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`
}

function addDays(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function tokyoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

async function serial<T>(location: string, work: () => Promise<T>): Promise<T> {
  const pending = (queues.get(location) ?? Promise.resolve()).then(work)
  const tail = pending.then(() => {}, () => {})
  queues.set(location, tail)
  try { return await pending } finally { if (queues.get(location) === tail) queues.delete(location) }
}

async function fetchRange(location: string, start: string, end: string): Promise<boolean> {
  if ((retryAfter.get(location) ?? 0) > Date.now()) return false
  const [latitude, longitude] = location.split(',')
  const params = new URLSearchParams({ latitude, longitude, start_date: start, end_date: end, daily: Object.values(variables).join(','), timezone: 'Asia/Tokyo' })
  try {
    // DBが取り直す時期を決める。Nextの永続キャッシュで古い応答を再保存しない。
    const res = await fetch(openMeteoUrl('archive', params), { cache: 'no-store' })
    if (process.env.NODE_ENV !== 'production') console.info(`[OpenMeteo archive] ${start}..${end} status=${res.status}`)
    if (!res.ok) {
      retryAfter.set(location, Date.now() + RETRY_MS)
      return false
    }
    const json = await res.json() as { daily?: Record<string, unknown> }
    const daily = json.daily
    const dates = daily?.time
    if (!daily || !Array.isArray(dates) || !dates.length) throw new Error('invalid daily dates')
    for (const variable of Object.values(variables)) {
      if (!Array.isArray(daily[variable]) || (daily[variable] as unknown[]).length !== dates.length) throw new Error('invalid daily columns')
    }
    const fetchedAt = new Date()
    const data = dates.map((date, index) => {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end) throw new Error('invalid daily date')
      const values = {} as Record<Field, number | null>
      for (const field of Object.keys(variables) as Field[]) {
        const value = (daily[variables[field]] as unknown[])[index]
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('invalid daily value')
        values[field] = value as number | null
      }
      return { location, date, ...values, fetchedAt }
    })
    // SQLiteのパラメータ数とトランザクションの時間を抑える。
    for (let offset = 0; offset < data.length; offset += 90) {
      await prisma.$transaction(data.slice(offset, offset + 90).map(row => prisma.openMeteoDaily.upsert({
        where: { location_date: { location, date: row.date } }, create: row, update: row,
      })))
    }
    retryAfter.delete(location)
    return true
  } catch {
    // URLには秘密のキーが入るので、例外やURL自体はログに出さない。
    retryAfter.set(location, Date.now() + RETRY_MS)
    if (process.env.NODE_ENV !== 'production') console.warn('[OpenMeteo archive] fetch/save failed; retained stored data')
    return false
  }
}

/** 必要な期間だけ読み、連続した未取得・更新対象日をまとめて取り足す。欠測nullも取得済みとして扱う。 */
export async function loadDailyWeather(point: { latitude: number; longitude: number }, start: string, end: string) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null
  const today = tokyoToday()
  end = end > today ? today : end
  if (start > end) return null
  const location = weatherLocation(point)
  return serial(location, async () => {
    const query = { where: { location, date: { gte: start, lte: end } }, orderBy: { date: 'asc' as const } }
    const rows = await prisma.openMeteoDaily.findMany(query)
    const saved = new Map(rows.map(row => [row.date, row]))
    const refreshFrom = addDays(today, -(ARCHIVE_REFRESH_DAYS - 1))
    const ranges: { start: string; end: string }[] = []
    let range: { start: string; end: string } | null = null
    let expected = 0
    for (let date = start; date <= end; date = addDays(date, 1)) {
      expected++
      const row = saved.get(date)
      const stale = row && date >= refreshFrom && date.slice(0, 4) === today.slice(0, 4) && Date.now() - row.fetchedAt.getTime() >= REFRESH_MS
      if (!row || stale) {
        if (range) range.end = date
        else { range = { start: date, end: date }; ranges.push(range) }
      } else range = null
    }
    for (const missing of ranges) { if (!await fetchRange(location, missing.start, missing.end)) break }
    const result = ranges.length ? await prisma.openMeteoDaily.findMany(query) : rows
    return result.length === expected ? result : null
  })
}
