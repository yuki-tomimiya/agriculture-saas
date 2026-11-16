/**
 * 前回作付けシーズンの気象系列（植付けからの日数で揃えて昨年比較用）
 */
import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
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

export type PreviousSeasonWeather = {
  previousCropId: string
  previousLabel: string
  plantingDate: Date
  endDate: Date
  plantingGapNote: string | null
  gdd: DaySeriesPoint[]
  rain: DaySeriesPoint[]
  radiation: DaySeriesPoint[]
}

/**
 * 選択中作物と同じまとまりの、前の年で月日がいちばん近い作付けの気象系列を返す
 */
export async function getPreviousSeasonWeather(args: {
  userId: string
  cropId: string
  name: string
  cropKind?: string | null
  variety: string | null
  farmId: string | null
  growingSite?: string | null
  plantingDate: Date
  latitude: number | null
  longitude: number | null
  count: HeatCount
  baseTemp: number
}): Promise<PreviousSeasonWeather | null> {
  const point = { latitude: args.latitude, longitude: args.longitude }
  if (!hasWeatherCoordinates(point)) return null
  const coordinates = { latitude: Number(point.latitude), longitude: Number(point.longitude) }

  const siblings = await prisma.crop.findMany({
    where: {
      ...(args.farmId ? { farmId: args.farmId } : { name: args.name, farmId: null }),
      OR: [{ userId: args.userId }, { farm: { userId: args.userId } }],
    },
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

  try {
    const [temps, rains, rads] = await Promise.all([
      getHistoricalDailyTemps({
        startDate: plant,
        endDate: end,
        point: coordinates,
      }),
      getHistoricalDailyPrecipitation({
        startDate: plant,
        endDate: end,
        point: coordinates,
      }),
      getHistoricalDailyRadiation({
        startDate: plant,
        endDate: end,
        point: coordinates,
      }),
    ])

    if (temps.length > 10) {
      let gdd = 0
      const gddPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
      temps.forEach((t) => {
        gdd += dailyHeat(t.avgTemp, args.count, args.baseTemp)
        gddPts.push({
          dayFromPlanting: Math.floor((t.date.getTime() - plant.getTime()) / (24 * 60 * 60 * 1000)) + 1,
          value: Math.round(gdd * 10) / 10,
        })
      })

      let rain = 0
      const rainPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
      rains.forEach((r) => {
        rain += r.precipitationMm
        rainPts.push({
          dayFromPlanting: Math.floor((r.date.getTime() - plant.getTime()) / (24 * 60 * 60 * 1000)) + 1,
          value: Math.round(rain * 10) / 10,
        })
      })

      let rad = 0
      const radPts: DaySeriesPoint[] = [{ dayFromPlanting: 0, value: 0 }]
      rads.forEach((r) => {
        rad += r.radiationMj
        radPts.push({
          dayFromPlanting: Math.floor((r.date.getTime() - plant.getTime()) / (24 * 60 * 60 * 1000)) + 1,
          value: Math.round(rad * 10) / 10,
        })
      })

      return {
        previousCropId: previous.id,
        previousLabel: `${previous.name}${previous.variety ? `（${previous.variety}）` : ''} · ${plant.getFullYear()}年作`,
        plantingDate: plant,
        endDate: end,
        plantingGapNote: gapNote,
        gdd: gddPts,
        rain: rainPts.length > 1 ? rainPts : [],
        radiation: radPts.length > 1 ? radPts : [],
      }
    }
  } catch {
    // 地点の気象を取得できなければ、仮の気象で埋めない。
  }
  return null
}
