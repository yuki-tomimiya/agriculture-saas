import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { getAccumulatedGDDFromApi, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { getLocationDailyNormals, loadLocationArchive, sumNormalGdd, type DayNormal } from '@/lib/weather-normals'
import { TEN_YEAR_MEAN } from '@/lib/weather-labels'
import { formatHarvestWindow, projectHarvestWindow } from '@/lib/insights/harvest-date-window'
import {
  chosenHarvestSamples,
  loadHarvestSamples,
  pickHarvestBasis,
  type HarvestBasis,
  type HarvestSample,
} from '@/lib/insights/harvest-gdd-basis'
import { DAYLENGTH_NOTE, DAYLENGTH_SOURCE, isDaylengthCrop } from '@/lib/benchmarks/daylength-crops'

export type PlanWorkHint = {
  taskType: string
  day: number
  count: number
}

export type NextYearPlanCard = {
  cropId: string
  name: string
  variety: string | null
  farmName: string | null
  plantingDate: Date | null
  harvestDate: Date | null
  seasonDays: number | null
  harvestQty: number | null
  harvestUnit: string
  harvestRecorded: boolean
  salesAmount: number | null
  salesRecorded: boolean
  accumulatedGdd: number | null
  targetGdd: number
  basis: HarvestBasis
  baseTemp: number
  provisionalTarget: boolean
  nextPlantingDate: Date | null
  normalHarvestDate: Date | null
  normalDays: number | null
  normalStatus: 'reached' | 'missing' | 'unreachable' | 'no-date' | 'no-place'
  normalNote: string | null
  /** 日付の出し方。adjusted は平年換算、season-days は栽培日数 */
  forecastKind: 'adjusted' | 'season-days' | 'provisional' | 'actual' | 'none'
  adjustNote: string | null
  /** 平年換算した℃日は変えない。日付だけ、年ごとの幅で出す */
  windowLabel: string | null
  windowEarly: Date | null
  windowLate: Date | null
  workHints: PlanWorkHint[]
  workCount: number
}

function monthDayKey(month: number, day: number): string {
  if (month === 2 && day === 29) return '2-28'
  return `${month}-${day}`
}

function atNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0)
}

/** 今年と同じ月日で、今日よりあとの植付日 */
export function nextPlantingDate(planting: Date, today = new Date()): Date {
  const month = planting.getMonth()
  const day = planting.getMonth() === 1 && planting.getDate() === 29 ? 28 : planting.getDate()
  const now = atNoon(today.getFullYear(), today.getMonth(), today.getDate())
  let candidate = atNoon(now.getFullYear(), month, day)
  if (candidate.getTime() <= now.getTime()) {
    candidate = atNoon(now.getFullYear() + 1, month, day)
  }
  return candidate
}

export type GddReach =
  | { status: 'reached'; days: number }
  | { status: 'missing' }
  | { status: 'unreachable' }

/**
 * 平年の日平均気温を足し、目標GDDに届く日を求める。
 * 足せる日が少なすぎるときは missing。日は足りるが目標に届かないときは unreachable。
 */
export function daysToTargetGdd(args: {
  normals: Map<string, DayNormal>
  start: Date
  baseTemp: number
  targetGdd: number
  maxDays?: number
}): GddReach {
  const max = args.maxDays ?? 400
  const start = new Date(args.start)
  start.setHours(12, 0, 0, 0)
  let heat = 0
  let daysWithData = 0
  for (let offset = 0; offset <= max; offset++) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    const row = args.normals.get(monthDayKey(date.getMonth() + 1, date.getDate()))
    if (row && Number.isFinite(row.tempMean)) {
      daysWithData += 1
      heat += Math.max(0, row.tempMean - args.baseTemp)
    }
    if (heat >= args.targetGdd && daysWithData > 0) return { status: 'reached', days: offset }
  }
  if (daysWithData < 300) return { status: 'missing' }
  return { status: 'unreachable' }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function daysBetween(start: Date, end: Date): number {
  const a = new Date(start)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)))
}

function heatTone(pct: number): string {
  if (pct >= 103) return `${TEN_YEAR_MEAN}より暑く`
  if (pct <= 97) return `${TEN_YEAR_MEAN}より涼しく`
  return `${TEN_YEAR_MEAN}に近く`
}

/** 年ごとの実績を、その年の同期間の平年積算へ引き直してから平均する。 */
async function adjustHarvestsToNormal(
  samples: HarvestSample[],
  normalsFor: (latitude: number, longitude: number) => Promise<Map<string, DayNormal> | null>
): Promise<{ gdd: number; avgDays: number; note: string } | null> {
  const years: {
    label: string
    plantingTime: number
    pct: number
    corrected: number
    days: number
  }[] = []
  for (const sample of samples) {
    const normals = await normalsFor(sample.latitude, sample.longitude)
    if (!normals) continue
    const normal = sumNormalGdd(normals, sample.plantingDate, sample.endDate, sample.baseTemp)
    if (normal == null || normal <= 0 || sample.gdd <= 0) continue
    years.push({
      label: sample.seasonLabel,
      plantingTime: sample.plantingTime,
      pct: Math.round((sample.gdd / normal) * 100),
      corrected: sample.gdd * (normal / sample.gdd),
      days: sample.days,
    })
  }
  if (years.length === 0) return null
  years.sort((a, b) => a.plantingTime - b.plantingTime)
  const gdd = Math.round(years.reduce((sum, year) => sum + year.corrected, 0) / years.length)
  const avgDays = Math.round(years.reduce((sum, year) => sum + year.days, 0) / years.length)
  const note =
    years.length === 1
      ? `${years[0].label}は${heatTone(years[0].pct)}（${TEN_YEAR_MEAN}比${years[0].pct}%）、${TEN_YEAR_MEAN}に引き直すと${gdd}℃日にあたります`
      : `${years.map((year) => `${year.label}は${TEN_YEAR_MEAN}比${year.pct}%`).join('、')}。引き直した平均は${gdd}℃日です`
  return { gdd, avgDays, note }
}

function provisionalTarget(name: string, variety: string | null): boolean {
  const text = `${name}${variety ?? ''}`
  return text.includes('さつまいも') || text.includes('紅はるか') || text.includes('ふくむらさき')
}

export async function getNextYearPlans(userId: string): Promise<NextYearPlanCard[]> {
  const { where, whereFallback } = getCropWhere(userId)
  const include = {
    farm: true,
    harvests: { orderBy: { date: 'asc' as const } },
    sales: true,
    workRecords: { orderBy: { date: 'asc' as const } },
  } as const
  const past = { status: { not: 'growing' } }

  let crops
  try {
    crops = await prisma.crop.findMany({
      where: { AND: [where, past] },
      include,
      orderBy: { plantingDate: 'desc' },
    })
  } catch {
    crops = await prisma.crop.findMany({
      where: { AND: [whereFallback, past] },
      include,
      orderBy: { plantingDate: 'desc' },
    })
  }

  const normalCache = new Map<string, Promise<Map<string, DayNormal> | null>>()
  const normalsFor = (latitude: number, longitude: number) => {
    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
    const existing = normalCache.get(key)
    if (existing) return existing
    const pending = getLocationDailyNormals({ latitude, longitude })
    normalCache.set(key, pending)
    return pending
  }
  const archiveCache = new Map<string, ReturnType<typeof loadLocationArchive>>()
  const archiveFor = (latitude: number, longitude: number) => {
    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
    const existing = archiveCache.get(key)
    if (existing) return existing
    const pending = loadLocationArchive({ latitude, longitude })
    archiveCache.set(key, pending)
    return pending
  }

  const today = new Date()
  const harvestSamples = await loadHarvestSamples(userId)
  return Promise.all(
    crops.map(async (crop) => {
      const harvestUnit = crop.harvests.find((h) => h.unit)?.unit ?? 'kg'
      const harvestRecorded = crop.harvests.length > 0
      const harvestQty = harvestRecorded
        ? crop.harvests
            .filter((h) => h.unit === harvestUnit || (!h.unit && harvestUnit === 'kg'))
            .reduce((sum, h) => sum + h.quantity, 0)
        : null
      const salesRecorded = crop.sales.length > 0
      const salesAmount = salesRecorded
        ? crop.sales.reduce((sum, sale) => sum + sale.amount, 0)
        : null
      const lastHarvest = crop.harvests[crop.harvests.length - 1]?.date ?? null
      const harvestDate = lastHarvest ?? crop.harvestDate
      const seasonDays =
        crop.plantingDate && harvestDate ? daysBetween(crop.plantingDate, harvestDate) : null
      const baseTemp = crop.baseTemperature ?? 10
      const picked = chosenHarvestSamples(harvestSamples, crop.name, crop.variety)
      const basis = pickHarvestBasis(harvestSamples, crop.name, crop.variety)
      const targetGdd = basis.gdd
      const point = {
        latitude: crop.farm?.latitude ?? null,
        longitude: crop.farm?.longitude ?? null,
      }

      let nextPlant: Date | null = null
      let normalHarvest: Date | null = null
      let normalDays: number | null = null
      let normalStatus: NextYearPlanCard['normalStatus'] = 'missing'
      let normalNote: string | null = null
      let forecastKind: NextYearPlanCard['forecastKind'] = 'none'
      let adjustNote: string | null = null
      let windowLabel: string | null = null
      let windowEarly: Date | null = null
      let windowLate: Date | null = null
      let windowAdjustNote: string | null = null
      let seasonDayFallback: number | null = seasonDays
      if (isDaylengthCrop(crop.name, crop.variety)) {
        normalNote = `${DAYLENGTH_NOTE}出典：${DAYLENGTH_SOURCE}。`
      } else if (!crop.plantingDate) {
        normalStatus = 'no-date'
        normalNote = '植付日がないので、来年の収穫日は出せません。'
      } else if (!hasWeatherCoordinates(point)) {
        normalStatus = 'no-place'
        normalNote = '農場の位置がないので、10年平均の気温から収穫日は出せません。'
      } else {
        const normals = await normalsFor(Number(point.latitude), Number(point.longitude))
        const plantOn = nextPlantingDate(crop.plantingDate, today)
        nextPlant = plantOn
        if (!normals || normals.size < 300) {
          normalStatus = 'missing'
          normalNote = '10年平均の気温を取れなかったので、収穫日は出せません。'
        } else {
          let walkTarget = targetGdd
          if (basis.source !== 'provisional') {
            const adjusted = await adjustHarvestsToNormal(picked.samples, normalsFor)
            if (adjusted) {
              walkTarget = adjusted.gdd
              seasonDayFallback = adjusted.avgDays
              adjustNote = adjusted.note
              windowAdjustNote = adjusted.note
            }
          }
          const reach = daysToTargetGdd({
            normals,
            start: nextPlant,
            baseTemp,
            targetGdd: walkTarget,
          })
          const withinSeason = (days: number) => {
            if (seasonDayFallback == null) return true
            const harvest = addDays(plantOn, days)
            return days <= seasonDayFallback * 1.5 && harvest.getFullYear() === plantOn.getFullYear()
          }
          if (reach.status === 'reached' && withinSeason(reach.days)) {
            normalStatus = 'reached'
            normalDays = reach.days
            normalHarvest = addDays(nextPlant, reach.days)
            forecastKind =
              basis.source === 'provisional' ? 'provisional' : adjustNote ? 'adjusted' : 'actual'
          } else if (seasonDayFallback != null && reach.status !== 'missing') {
            normalStatus = 'reached'
            normalDays = seasonDayFallback
            normalHarvest = addDays(nextPlant, seasonDayFallback)
            forecastKind = 'season-days'
            adjustNote = null
          } else if (reach.status === 'missing') {
            normalStatus = 'missing'
            normalNote = '10年平均の気温を取れなかったので、収穫日は出せません。'
          } else {
            normalStatus = 'unreachable'
            normalNote = '10年平均の気温は取れましたが、400日以内にこの基準の積算温度へ届きません。'
          }
          const archive = await archiveFor(Number(point.latitude), Number(point.longitude))
          if (archive) {
            const window = projectHarvestWindow({
              today: plantOn,
              currentGdd: 0,
              targetGdd: walkTarget,
              baseTemp,
              archive,
              includeToday: true,
            })
            if (window) {
              windowLabel = formatHarvestWindow(window, { provisional: basis.source === 'provisional' })
              windowEarly = window.early
              windowLate = window.late
              if (forecastKind === 'season-days' && windowAdjustNote) adjustNote = windowAdjustNote
            }
          }
        }
      }

      let accumulatedGdd: number | null = null
      if (crop.plantingDate && harvestDate && hasWeatherCoordinates(point)) {
        accumulatedGdd = await getAccumulatedGDDFromApi({
          startDate: crop.plantingDate,
          endDate: harvestDate,
          baseTemp,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        })
      }

      const workHints: PlanWorkHint[] = []
      if (crop.plantingDate) {
        const counts = new Map<string, number>()
        for (const work of crop.workRecords) {
          counts.set(work.taskType, (counts.get(work.taskType) ?? 0) + 1)
        }
        const seen = new Set<string>()
        for (const work of crop.workRecords) {
          if (seen.has(work.taskType)) continue
          seen.add(work.taskType)
          workHints.push({
            taskType: work.taskType,
            day: daysBetween(crop.plantingDate, work.date),
            count: counts.get(work.taskType) ?? 1,
          })
          if (workHints.length >= 6) break
        }
      }

      return {
        cropId: crop.id,
        name: crop.name,
        variety: crop.variety,
        farmName: crop.farm?.name ?? null,
        plantingDate: crop.plantingDate,
        harvestDate,
        seasonDays,
        harvestQty,
        harvestUnit,
        harvestRecorded,
        salesAmount,
        salesRecorded,
        accumulatedGdd,
        targetGdd,
        basis,
        baseTemp,
        provisionalTarget: provisionalTarget(crop.name, crop.variety),
        nextPlantingDate: nextPlant,
        normalHarvestDate: normalHarvest,
        normalDays,
        normalStatus,
        normalNote,
        forecastKind,
        adjustNote,
        windowLabel,
        windowEarly,
        windowLate,
        workHints,
        workCount: crop.workRecords.length,
      }
    })
  )
}
