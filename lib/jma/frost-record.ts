import { prisma } from '@/lib/prisma'
import { farmElevationM } from '@/lib/jma/elevation'
import { formatKm, pickNearestStation, type StationPick } from '@/lib/jma/stations'
import { STATION_ENOUGH_YEARS, STATION_MISSING_RATE } from '@/lib/jma/thresholds'
import {
  FROST_ARCHIVE_YEARS,
  FROST_RISK_MAX_C,
  summarizeAutumnFirstFrost,
  type FirstFrostSummary,
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
