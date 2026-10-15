import { prisma } from '@/lib/prisma'
import { farmElevationM } from '@/lib/jma/elevation'
import { formatKm, pickNearestStation, type StationPick } from '@/lib/jma/stations'
import { STATION_ENOUGH_YEARS, STATION_MISSING_RATE } from '@/lib/jma/thresholds'
import {
  FROST_ARCHIVE_YEARS,
  FROST_RISK_MAX_C,
  formatMonthDay,
  summarizeAutumnFirstFrost,
  summarizeSpringLastFrost,
  type FirstFrostSummary,
  type LastFrostSummary,
  type MonthDay,
} from '@/lib/weather-frost'
import { loadLocationArchive } from '@/lib/weather-normals'
import { firstMeanMinBelow, type CoolNightDate } from '@/lib/weather-night'
import type { LocationArchive } from '@/lib/weather-normals'
import type { WeatherPoint } from '@/lib/weather-forecast'

/** 昨年までの10年。Open-Meteo の平年値と同じ決め方 */
export function archiveYears(today = new Date()): { fromYear: number; toYear: number } {
  const toYear = today.getFullYear() - 1
  return { fromYear: toYear - FROST_ARCHIVE_YEARS + 1, toYear }
}

export type FrostOrigin = {
  summary: FirstFrostSummary
  source: 'station' | 'estimate'
  stationName: string | null
  distanceKm: number | null
  elevationDiffM: number | null
  near: boolean
}

function autumnDays(year: number): string[] {
  const days: string[] = []
  const cursor = new Date(Date.UTC(year, 7, 15))
  const end = new Date(Date.UTC(year, 11, 31))
  while (cursor.getTime() <= end.getTime()) {
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cursor.getUTCDate()).padStart(2, '0')
    days.push(`${year}-${month}-${day}`)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function autumnSeries(
  rows: { date: string; tMin: number | null }[],
  fromYear: number,
  toYear: number
): { times: string[]; mins: Array<number | null>; usableYears: number } {
  const byDate = new Map(rows.map((row) => [row.date, row.tMin]))
  const times: string[] = []
  const mins: Array<number | null> = []
  let usableYears = 0
  for (let year = fromYear; year <= toYear; year++) {
    const days = autumnDays(year)
    const missing = days.filter((day) => byDate.get(day) == null).length
    if (missing / days.length > STATION_MISSING_RATE) continue
    usableYears += 1
    for (const day of days) {
      times.push(day)
      mins.push(byDate.get(day) ?? null)
    }
  }
  return { times, mins, usableYears }
}

export function summarizeStationFrost(
  rows: { date: string; tMin: number | null }[],
  fromYear?: number,
  toYear?: number
): FirstFrostSummary | null {
  const span = fromYear == null || toYear == null ? archiveYears() : { fromYear, toYear }
  const series = autumnSeries(rows, span.fromYear, span.toYear)
  return summarizeAutumnFirstFrost(series.times, series.mins)
}

export type StationFrostRead =
  | { kind: 'station'; summary: FirstFrostSummary; usableYears: number }
  | { kind: 'none'; usableYears: number }
  | { kind: 'fallback'; usableYears: number }

/** 記録が十分あるのに4℃以下に届かないときは none。届く年が足りないときは fallback */
export function readStationFrost(
  rows: { date: string; tMin: number | null }[],
  today = new Date()
): StationFrostRead {
  const { fromYear, toYear } = archiveYears(today)
  const series = autumnSeries(rows, fromYear, toYear)
  const summary = summarizeAutumnFirstFrost(series.times, series.mins)
  if (series.usableYears >= STATION_ENOUGH_YEARS) {
    if (!summary) return { kind: 'none', usableYears: series.usableYears }
    return { kind: 'station', summary, usableYears: series.usableYears }
  }
  return { kind: 'fallback', usableYears: series.usableYears }
}

export async function chooseStation(point?: Partial<WeatherPoint>): Promise<StationPick | null> {
  if (point?.latitude == null || point.longitude == null) return null
  const lat = Number(point.latitude)
  const lon = Number(point.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  const elevation = await farmElevationM(lat, lon)
  return pickNearestStation(lat, lon, elevation)
}

async function stationRows(blockNo: string, today = new Date()) {
  const { fromYear, toYear } = archiveYears(today)
  return prisma.jmaDailyTemp.findMany({
    where: { blockNo, date: { gte: `${fromYear}-01-01`, lte: `${toYear}-12-31` } },
    select: { date: true, tMin: true },
  })
}

export async function readFarmFrost(point?: Partial<WeatherPoint>): Promise<FrostOrigin | null> {
  const pick = await chooseStation(point)
  if (pick?.usable) {
    const rows = await stationRows(pick.station.blockNo)
    const read = readStationFrost(rows)
    if (read.kind === 'none') return null
    if (read.kind === 'station') {
      return {
        summary: read.summary,
        source: 'station',
        stationName: pick.station.name,
        distanceKm: pick.distanceKm,
        elevationDiffM: pick.elevationDiffM,
        near: pick.near,
      }
    }
  }
  const archive = await loadLocationArchive(point)
  if (!archive?.tempMin) return null
  const summary = summarizeAutumnFirstFrost(archive.times, archive.tempMin)
  if (!summary) return null
  return {
    summary,
    source: 'estimate',
    stationName: pick?.station.name ?? null,
    distanceKm: pick?.distanceKm ?? null,
    elevationDiffM: pick?.elevationDiffM ?? null,
    near: false,
  }
}

function springDays(year: number): string[] {
  const days: string[] = []
  const cursor = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 5, 30))
  while (cursor.getTime() <= end.getTime()) {
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cursor.getUTCDate()).padStart(2, '0')
    days.push(`${year}-${month}-${day}`)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function springSeries(
  rows: { date: string; tMin: number | null }[],
  fromYear: number,
  toYear: number
): { times: string[]; mins: Array<number | null>; usableYears: number } {
  const byDate = new Map(rows.map((row) => [row.date, row.tMin]))
  const times: string[] = []
  const mins: Array<number | null> = []
  let usableYears = 0
  for (let year = fromYear; year <= toYear; year++) {
    const days = springDays(year)
    const missing = days.filter((day) => byDate.get(day) == null).length
    if (missing / days.length > STATION_MISSING_RATE) continue
    usableYears += 1
    for (const day of days) {
      times.push(day)
      mins.push(byDate.get(day) ?? null)
    }
  }
  return { times, mins, usableYears }
}

export type SpringYearEnd = { year: number; last: MonthDay | null; dropped: boolean }

/** 年ごとの、春に最後に4℃以下になった日。欠けが多い年は dropped */
export function eachSpringLastFrost(
  rows: { date: string; tMin: number | null }[],
  today = new Date()
): SpringYearEnd[] {
  const { fromYear, toYear } = archiveYears(today)
  const byDate = new Map(rows.map((row) => [row.date, row.tMin]))
  const ends: SpringYearEnd[] = []
  for (let year = fromYear; year <= toYear; year++) {
    const days = springDays(year)
    const missing = days.filter((day) => byDate.get(day) == null).length
    const dropped = missing / days.length > STATION_MISSING_RATE
    let last: MonthDay | null = null
    if (!dropped) {
      for (const day of days) {
        const min = byDate.get(day)
        if (min == null || min > FROST_RISK_MAX_C) continue
        const month = Number(day.slice(5, 7))
        const date = Number(day.slice(8, 10))
        if (!last || month * 100 + date > last.month * 100 + last.day) last = { month, day: date }
      }
    }
    ends.push({ year, last, dropped })
  }
  return ends
}

export type SpringStationRead =
  | { kind: 'station'; summary: LastFrostSummary; usableYears: number }
  | { kind: 'none'; usableYears: number }
  | { kind: 'fallback'; usableYears: number }

export function readStationSpringFrost(
  rows: { date: string; tMin: number | null }[],
  today = new Date()
): SpringStationRead {
  const { fromYear, toYear } = archiveYears(today)
  const series = springSeries(rows, fromYear, toYear)
  const summary = summarizeSpringLastFrost(series.times, series.mins)
  if (series.usableYears >= STATION_ENOUGH_YEARS) {
    if (!summary) return { kind: 'none', usableYears: series.usableYears }
    return { kind: 'station', summary, usableYears: series.usableYears }
  }
  return { kind: 'fallback', usableYears: series.usableYears }
}

export type SpringFrostOrigin = {
  summary: LastFrostSummary | null
  source: 'station' | 'estimate' | 'none'
  stationName: string | null
  distanceKm: number | null
  elevationDiffM: number | null
  near: boolean
}

export async function readFarmSpringFrost(point?: Partial<WeatherPoint>): Promise<SpringFrostOrigin | null> {
  const pick = await chooseStation(point)
  if (pick?.usable) {
    const rows = await stationRows(pick.station.blockNo)
    const read = readStationSpringFrost(rows)
    if (read.kind === 'none') {
      return {
        summary: null,
        source: 'none',
        stationName: pick.station.name,
        distanceKm: pick.distanceKm,
        elevationDiffM: pick.elevationDiffM,
        near: pick.near,
      }
    }
    if (read.kind === 'station') {
      return {
        summary: read.summary,
        source: 'station',
        stationName: pick.station.name,
        distanceKm: pick.distanceKm,
        elevationDiffM: pick.elevationDiffM,
        near: pick.near,
      }
    }
  }
  const archive = await loadLocationArchive(point)
  if (!archive?.tempMin) return null
  const summary = summarizeSpringLastFrost(archive.times, archive.tempMin)
  if (!summary) return null
  return {
    summary,
    source: 'estimate',
    stationName: pick?.station.name ?? null,
    distanceKm: pick?.distanceKm ?? null,
    elevationDiffM: pick?.elevationDiffM ?? null,
    near: false,
  }
}

export type SpringDateBrief = {
  latest: MonthDay | null
  observed: boolean
  dateLabel: string | null
}

export function toSpringDateBrief(origin: SpringFrostOrigin | null): SpringDateBrief | null {
  if (!origin) return null
  if (origin.source === 'none' || !origin.summary) {
    return { latest: null, observed: origin.source !== 'estimate', dateLabel: null }
  }
  return {
    latest: origin.summary.latest,
    observed: origin.source === 'station',
    dateLabel: formatMonthDay(origin.summary.latest),
  }
}

export function springFrostSentence(origin: SpringFrostOrigin): string {
  if (origin.source === 'none' || !origin.summary) {
    return 'この地点では、過去10年の観測で春に4℃以下になった日はありません'
  }
  const mean = formatMonthDay(origin.summary.mean)
  const latest = formatMonthDay(origin.summary.latest)
  const where =
    origin.stationName != null
      ? `（${origin.stationName}観測所・農場から${formatKm(origin.distanceKm ?? 0)}km）`
      : ''
  if (origin.source === 'estimate') {
    const body =
      origin.summary.years < FROST_ARCHIVE_YEARS
        ? `過去10年の推計では、10年中${origin.summary.years}年で春に最低気温が4℃以下になり、最後の日の平均は${mean}、いちばん遅い年は${latest}です`
        : `過去10年の推計では、春に最低気温が最後に4℃以下になったのは平均${mean}、いちばん遅い年は${latest}です`
    return `${body}。近くの観測所の記録が使えないため、推計の気温から出しています`
  }
  const body =
    origin.summary.years < FROST_ARCHIVE_YEARS
      ? `過去10年の観測では、10年中${origin.summary.years}年で春に最低気温が4℃以下になり、最後の日の平均は${mean}、いちばん遅い年は${latest}です${where}`
      : `過去10年の観測では、春に最低気温が最後に4℃以下になったのは平均${mean}、いちばん遅い年は${latest}です${where}`
  if (origin.near) return body
  const elev = origin.elevationDiffM == null ? '' : `（標高差${origin.elevationDiffM}m）`
  return `${body}。観測所は農場から${formatKm(origin.distanceKm ?? 0)}km${elev}離れているので、目安です`
}

export function autumnFirstFrostSentence(origin: FrostOrigin): string {
  const mean = formatMonthDay(origin.summary.mean)
  const early = formatMonthDay(origin.summary.earliest)
  const where =
    origin.source === 'station' && origin.stationName
      ? `（${origin.stationName}観測所）`
      : origin.source === 'estimate'
        ? '（推計）'
        : ''
  const years =
    origin.summary.years < FROST_ARCHIVE_YEARS ? `10年中${origin.summary.years}年で、` : ''
  return `秋に最低気温が初めて4℃以下になったのは、${years}平均${mean}、最も早い年は${early}です${where}`
}

export async function springBriefsForFarms(
  farms: { id: string; latitude: number | null; longitude: number | null }[]
): Promise<Record<string, SpringDateBrief>> {
  const briefs: Record<string, SpringDateBrief> = {}
  for (const farm of farms) {
    if (farm.latitude == null || farm.longitude == null) continue
    const origin = await readFarmSpringFrost({ latitude: farm.latitude, longitude: farm.longitude })
    const brief = toSpringDateBrief(origin)
    if (brief) briefs[farm.id] = brief
  }
  return briefs
}

export function stationArchive(rows: { date: string; tMin: number | null }[]): LocationArchive {
  return {
    times: rows.map((row) => row.date),
    precip: [],
    radiation: [],
    tempMean: [],
    tempMin: rows.map((row) => row.tMin),
    tempMax: null,
  }
}

export async function readCoolNight(point?: Partial<WeatherPoint>): Promise<{
  date: CoolNightDate | null
  source: 'station' | 'estimate'
  stationName: string | null
  distanceKm: number | null
}> {
  const pick = await chooseStation(point)
  if (pick?.usable) {
    const rows = await stationRows(pick.station.blockNo)
    if (rows.length > 0) {
      const date = firstMeanMinBelow(stationArchive(rows))
      return {
        date,
        source: 'station',
        stationName: pick.station.name,
        distanceKm: pick.distanceKm,
      }
    }
  }
  const archive = await loadLocationArchive(point)
  return {
    date: archive ? firstMeanMinBelow(archive) : null,
    source: 'estimate',
    stationName: null,
    distanceKm: null,
  }
}

export function stationDistanceLabel(km: number, elevationDiffM: number | null): string {
  const elev = elevationDiffM == null ? '' : `・標高差${elevationDiffM}m`
  return `農場から${formatKm(km)}km${elev}`
}

export function frostUsesStation(origin: FrostOrigin): boolean {
  return origin.source === 'station'
}

export function frostStationLine(pick: StationPick | null, hasRecords: boolean): string {
  if (!pick || !pick.usable || !hasRecords) {
    return '霜の判定に使う観測所：近くに使える観測所の記録がありません（推計の気温を使っています）'
  }
  const place = `${pick.station.name}（${stationDistanceLabel(pick.distanceKm, pick.elevationDiffM)}）`
  if (pick.near) return `霜の判定に使う観測所：${place}`
  return `霜の判定に使う観測所：${place}。目安`
}

export { FROST_RISK_MAX_C }
