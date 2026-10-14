/**
 * 前回作付けシーズンの気象系列（植付けからの日数で揃えて昨年比較用）
 */
import { prisma } from '@/lib/prisma'
import { personalGroupKey, plantingGapNote, previousPlanting } from '@/lib/crops/conditions'
import {
  getHistoricalDailyPrecipitation,
  getHistoricalDailyRadiation,
  getHistoricalDailyTemps,
  hasWeatherCoordinates,
} from '@/lib/weather-forecast'

export type DaySeriesPoint = { dayFromPlanting: number; value: number }

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 決定論的な仮データ（Open-Meteo が空のとき用） */
export function buildDemoSeasonSeries(args: {
  days: number
  dailyGddMean: number
  dailyRainMean: number
  dailyRadiationMean: number
  seed?: number
}): {
  gdd: DaySeriesPoint[]
  rain: DaySeriesPoint[]
  radiation: DaySeriesPoint[]
} {
  let s = args.seed ?? 42
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }

  let gdd = 0
  let rain = 0
  let rad = 0
  const gddPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
  const rainPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
  const radPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]

  for (let day = 1; day <= args.days; day++) {
    const season = Math.sin((day / args.days) * Math.PI) // 中盤やや高め
    gdd += Math.max(0, args.dailyGddMean * (0.7 + 0.6 * season) + (rand() - 0.5) * 3)
    rain += Math.max(0, args.dailyRainMean * (0.5 + rand()) + (rand() > 0.85 ? 15 * rand() : 0))
    rad += Math.max(0, args.dailyRadiationMean * (0.75 + 0.5 * season) + (rand() - 0.5) * 2)
    gddPts.push({ dayFromPlanting: day, value: Math.round(gdd * 10) / 10 })
    rainPts.push({ dayFromPlanting: day, value: Math.round(rain * 10) / 10 })
    radPts.push({ dayFromPlanting: day, value: Math.round(rad * 10) / 10 })
  }

  return { gdd: gddPts, rain: rainPts, radiation: radPts }
}

export type PreviousSeasonWeather = {
  previousCropId: string
  previousLabel: string
  plantingDate: Date
  endDate: Date
  plantingGapNote: string | null
  source: 'open-meteo' | 'demo'
  gdd: DaySeriesPoint[]
  rain: DaySeriesPoint[]
  radiation: DaySeriesPoint[]
}

/**
 * 選択中作物と同じまとまりの、前の年で月日がいちばん近い作付けの気象系列を返す
 */
export async function getPreviousSeasonWeather(args: {
  cropId: string
  name: string
  cropKind?: string | null
  variety: string | null
  farmId: string | null
  growingSite?: string | null
  plantingDate: Date
  latitude: number | null
  longitude: number | null
  baseTemperature: number
}): Promise<PreviousSeasonWeather | null> {
  const siblings = await prisma.crop.findMany({
    where: args.farmId ? { farmId: args.farmId } : { name: args.name, farmId: null },
    orderBy: { plantingDate: 'desc' },
  })

  const key = personalGroupKey(args)
  const group = siblings.filter((c) => personalGroupKey(c) === key)
  const previous = previousPlanting(
    { id: args.cropId, plantingDate: args.plantingDate },
    group,
  )
  if (!previous?.plantingDate) return null
  const gapNote = plantingGapNote(args.plantingDate, previous.plantingDate)

  const plant = new Date(previous.plantingDate)
  plant.setHours(0, 0, 0, 0)
  const end = previous.harvestDate
    ? new Date(previous.harvestDate)
    : addDays(plant, 163)
  end.setHours(0, 0, 0, 0)

  const daySpan = Math.max(
    1,
    Math.floor((end.getTime() - plant.getTime()) / (24 * 60 * 60 * 1000))
  )

  const point = { latitude: args.latitude, longitude: args.longitude }
  const canFetch = hasWeatherCoordinates(point)

  if (canFetch) {
    try {
      const [temps, rains, rads] = await Promise.all([
        getHistoricalDailyTemps({
          startDate: plant,
          endDate: end,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        }),
        getHistoricalDailyPrecipitation({
          startDate: plant,
          endDate: end,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        }),
        getHistoricalDailyRadiation({
          startDate: plant,
          endDate: end,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        }),
      ])

      if (temps.length > 10) {
        let gdd = 0
        const gddPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
        temps.forEach((t, i) => {
          gdd += Math.max(0, t.avgTemp - args.baseTemperature)
          gddPts.push({
            dayFromPlanting: i + 1,
            value: Math.round(gdd * 10) / 10,
          })
        })

        let rain = 0
        const rainPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
        rains.forEach((r, i) => {
          rain += r.precipitationMm
          rainPts.push({
            dayFromPlanting: i + 1,
            value: Math.round(rain * 10) / 10,
          })
        })

        let rad = 0
        const radPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
        rads.forEach((r, i) => {
          rad += r.radiationMj
          radPts.push({
            dayFromPlanting: i + 1,
            value: Math.round(rad * 10) / 10,
          })
        })

        return {
          previousCropId: previous.id,
          previousLabel: `${previous.name}${previous.variety ? `（${previous.variety}）` : ''} · ${plant.getFullYear()}年作`,
          plantingDate: plant,
          endDate: end,
          plantingGapNote: gapNote,
          source: 'open-meteo',
          gdd: gddPts,
          rain: rainPts.length > 1 ? rainPts : buildDemoSeasonSeries({ days: daySpan, dailyGddMean: 8, dailyRainMean: 3, dailyRadiationMean: 14, seed: 1 }).rain,
          radiation: radPts.length > 1 ? radPts : buildDemoSeasonSeries({ days: daySpan, dailyGddMean: 8, dailyRainMean: 3, dailyRadiationMean: 14, seed: 2 }).radiation,
        }
      }
    } catch {
      // fall through to demo
    }
  }

  const demo = buildDemoSeasonSeries({
    days: daySpan,
    dailyGddMean: 8.5,
    dailyRainMean: 2.8,
    dailyRadiationMean: 13.5,
    seed: previous.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0),
  })

  return {
    previousCropId: previous.id,
    previousLabel: `${previous.name}${previous.variety ? `（${previous.variety}）` : ''} · ${plant.getFullYear()}年作（仮データ）`,
    plantingDate: plant,
    endDate: end,
    plantingGapNote: gapNote,
    source: 'demo',
    gdd: demo.gdd,
    rain: demo.rain,
    radiation: demo.radiation,
  }
}
