import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { getAccumulatedGDDFromApi, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { getLocationDailyNormals, loadLocationArchive, sumNormalGdd, type DayNormal } from '@/lib/weather-normals'
import { annualPeriodTotals, tenYearClass } from '@/lib/insights/ten-year-classes'
import { TEN_YEAR_MEAN } from '@/lib/weather-labels'
import { formatHarvestWindow, projectHarvestWindow, projectTwoStageHarvestWindow } from '@/lib/insights/harvest-date-window'
import {
  chosenHarvestSamples,
  loadHarvestSamples,
  pickHarvestBasis,
  type HarvestBasis,
  type HarvestSample,
} from '@/lib/insights/harvest-gdd-basis'
import { dailyHeat, displayHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'
import { adviceNames } from '@/lib/crops/conditions'
import { plantingConditionForKind } from '@/lib/benchmarks/planting-conditions'
import { dateIsBeforeMonthDay, formatMonthDay } from '@/lib/weather-frost'
import { readFarmSpringFrost, springFrostSentence, type SpringFrostOrigin } from '@/lib/jma/frost-record'

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
  targetGdd: number | null
  basis: HarvestBasis
  count: HeatCount
  baseTemp: number
  countLabel: string
  nextPlantingDate: Date | null
  normalHarvestDate: Date | null
  normalDays: number | null
  normalStatus: 'reached' | 'missing' | 'unreachable' | 'no-date' | 'no-place'
  normalNote: string | null
  /** 日付の出し方。adjusted は平年換算、season-days は栽培日数 */
  forecastKind: 'adjusted' | 'season-days' | 'method' | 'actual' | 'none'
  adjustNote: string | null
  /** 平年換算した℃日は変えない。日付だけ、年ごとの幅で出す */
  windowLabel: string | null
  windowEarly: Date | null
  windowLate: Date | null
  workHints: PlanWorkHint[]
  workCount: number
  springLine: string | null
  springSource: 'station' | 'estimate' | 'none' | null
  plantingCondition: string | null
  springEarlyNote: string | null
  /** 起点が節目の品目の「あなた」行。無いときは積算温度の従来の文 */
  historyMeasure: string | null
  /** 起点が節目の品目の「来年」行。無いときは従来の文 */
  milestonePlan: string | null
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
  count: HeatCount
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
      heat += dailyHeat(row.tempMean, args.count, args.baseTemp)
    }
    if (heat >= args.targetGdd && daysWithData > 0) return { status: 'reached', days: offset }
  }
  if (daysWithData < 300) return { status: 'missing' }
  return { status: 'unreachable' }
}

function formatYearMonthDay(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatSpan(early: Date, late: Date): string {
  const label = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`
  const start = label(early)
  const end = label(late)
  return start === end ? start : `${start}〜${end}`
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

function heatTone(tone: ReturnType<typeof tenYearClass>): string | null {
  if (tone === 'high') return `${TEN_YEAR_MEAN}より暑く`
  if (tone === 'low') return `${TEN_YEAR_MEAN}より涼しく`
  return tone === 'middle' ? `${TEN_YEAR_MEAN}に近く` : null
}

/** 年ごとの実績を、その年の同期間の平年積算へ引き直してから平均する。 */
async function adjustHarvestsToNormal(
  samples: HarvestSample[],
  normalsFor: (latitude: number, longitude: number) => Promise<Map<string, DayNormal> | null>,
  archiveFor: (latitude: number, longitude: number) => ReturnType<typeof loadLocationArchive>
): Promise<{ gdd: number; avgDays: number; note: string } | null> {
  const years: {
    label: string
    plantingTime: number
    pct: number
    tone: string | null
    corrected: number
    days: number
  }[] = []
  for (const sample of samples) {
    if (sample.latitude == null || sample.longitude == null || sample.gdd == null) continue
    const normals = await normalsFor(sample.latitude, sample.longitude)
    if (!normals) continue
    const normal = sumNormalGdd(normals, sample.countStart, sample.endDate, sample.count, sample.baseTemp)
    if (normal == null || normal <= 0 || sample.gdd <= 0) continue
    const archive = await archiveFor(sample.latitude, sample.longitude)
    const totals = archive
      ? annualPeriodTotals({
          archive,
          start: sample.countStart,
          end: sample.endDate,
          measure: { count: sample.count, baseTemp: sample.baseTemp },
        })
      : []
    years.push({
      tone: heatTone(tenYearClass(sample.gdd, totals)),
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
      ? `${years[0].label}は${years[0].tone ? `${years[0].tone}（` : `積算温度の`}${TEN_YEAR_MEAN}比${years[0].pct}%${years[0].tone ? '）' : ''}、${TEN_YEAR_MEAN}に引き直すと${gdd}℃日にあたります`
      : `${years.map((year) => `${year.label}は${TEN_YEAR_MEAN}比${year.pct}%`).join('、')}。引き直した平均は${gdd}℃日です`
  return { gdd, avgDays, note }
}

export async function getNextYearPlans(userId: string): Promise<NextYearPlanCard[]> {
  const { where, whereFallback } = getCropWhere(userId)
  const include = {
    farm: true,
    harvests: { orderBy: { date: 'asc' as const } },
    sales: true,
    workRecords: { orderBy: { date: 'asc' as const } },
    milestones: { select: { key: true, observedAt: true } },
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
  const springCache = new Map<string, Promise<SpringFrostOrigin | null>>()
  const springFor = (farmId: string, latitude: number, longitude: number) => {
    const existing = springCache.get(farmId)
    if (existing) return existing
    const pending = readFarmSpringFrost({ latitude, longitude })
    springCache.set(farmId, pending)
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
      const picked = chosenHarvestSamples(harvestSamples, crop)
      const basis = pickHarvestBasis(harvestSamples, crop)
      const targetGdd = basis.gdd
      const heat = displayHeat(basis.view)
      const baseTemp = heat.baseTemp
      const countLabel =
        basis.view.status === 'active' || basis.view.status === 'pending' || basis.view.status === 'days'
          ? basis.view.countLabel
          : '植え付けから、日平均気温をそのまま足す（参考）'
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
      let historyMeasure: string | null = null
      let milestonePlan: string | null = null
      const milestoneStart = basis.view.status === 'active' && basis.view.startDate
        ? basis.view.startDate
        : null
      const originTerm = basis.view.status === 'active' && basis.view.key === 'edamame' ? '開花'
        : basis.view.status === 'active' && basis.view.key === 'broccoli' ? '出蕾' : '第1花房'
      const cornSilk = basis.view.status === 'days' && basis.view.key === 'sweet-corn' ? basis.view : null
      if (basis.view.status === 'pending') {
        normalNote = basis.view.key === 'tomato'
          ? '第1花房の日を記録した作付けから、来年の収穫開始の見込みを出せます。'
          : basis.view.key === 'sweet-corn'
            ? '絹糸（ひげ）が出た日を記録した作付けから、来年の収穫の見込みを出せます。'
            : basis.view.message
      } else if (cornSilk) {
        if (!crop.plantingDate) {
          normalStatus = 'no-date'
          normalNote = '植付日がないので、来年の収穫日は出せません。'
        } else if (!hasWeatherCoordinates(point)) {
          normalStatus = 'no-place'
          normalNote = '農場の位置がないので、10年平均の気温から収穫日は出せません。'
        } else {
          const silkGdd = await getAccumulatedGDDFromApi({
            startDate: crop.plantingDate,
            endDate: cornSilk.startDate,
            count: 'simple',
            baseTemp: 0,
            point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
          })
          const plantOn = nextPlantingDate(crop.plantingDate, today)
          nextPlant = plantOn
          if (silkGdd == null) {
            normalStatus = 'missing'
            normalNote = '植付から絹糸までの積算温度を取れなかったので、来年の日付は出せません。'
          } else {
            const archive = await archiveFor(Number(point.latitude), Number(point.longitude))
            const rounded = Math.round(silkGdd)
            const silkWindow = archive
              ? projectHarvestWindow({
                  today: plantOn,
                  currentGdd: 0,
                  targetGdd: rounded,
                  count: 'simple',
                  baseTemp: 0,
                  archive,
                  includeToday: true,
                })
              : null
            if (!silkWindow) {
              normalStatus = archive ? 'unreachable' : 'missing'
              normalNote = archive
                ? '過去10年の気温は取れましたが、年内に絹糸までの積算温度へ届きません。'
                : '過去10年の気温を取れなかったので、収穫日は出せません。'
            } else {
              const ownDays = basis.source === 'variety' || basis.source === 'crop'
              const lowDays = ownDays && basis.days != null ? basis.days : cornSilk.lowDays
              const highDays = ownDays && basis.days != null ? basis.days : cornSilk.highDays
              const harvestEarly = addDays(silkWindow.early, lowDays)
              const harvestLate = addDays(silkWindow.late, highDays)
              normalStatus = 'reached'
              forecastKind = ownDays ? 'actual' : 'method'
              windowLabel = formatHarvestWindow(silkWindow)
              windowEarly = harvestEarly
              windowLate = harvestLate
              const dayText = lowDays === highDays ? `${lowDays}日後` : `${lowDays}〜${highDays}日後`
              milestonePlan = `来年も${formatYearMonthDay(plantOn)}に植えると、${ownDays ? '去年と同じく' : ''}植付から絹糸まで${rounded}℃日として、絹糸が出るのは${formatHarvestWindow(silkWindow)}。収穫の目安はその${dayText}の${formatSpan(harvestEarly, harvestLate)}です。`
            }
          }
        }
        const firstHarvest = crop.harvests[0]?.date ?? null
        historyMeasure = firstHarvest
          ? `絹糸から最初の収穫まで ${daysBetween(cornSilk.startDate, firstHarvest)}日`
          : '収穫の記録はないので、絹糸からの日数は資料の20〜25日を使います'
      } else if (basis.view.status === 'active' && basis.view.key === 'broccoli' && milestoneStart && targetGdd != null) {
        if (!crop.plantingDate) {
          normalStatus = 'no-date'
          normalNote = '植付日がないので、来年の収穫日は出せません。'
        } else if (!hasWeatherCoordinates(point)) {
          normalStatus = 'no-place'
          normalNote = '農場の位置がないので、来年の収穫日は出せません。'
        } else {
          const coordinates = { latitude: Number(point.latitude), longitude: Number(point.longitude) }
          const before = await getAccumulatedGDDFromApi({ startDate: crop.plantingDate, endDate: milestoneStart, count: 'simple', baseTemp: 0, point: coordinates })
          const plantOn = nextPlantingDate(crop.plantingDate, today)
          nextPlant = plantOn
          const [normals, archive] = await Promise.all([normalsFor(coordinates.latitude, coordinates.longitude), archiveFor(coordinates.latitude, coordinates.longitude)])
          if (before == null || !archive || !normals || normals.size < 300) {
            normalStatus = 'missing'
            normalNote = '植付から出蕾までの実績、または過去10年の気温が足りないので、来年の日付は出せません。'
          } else {
            const own = basis.source === 'variety' || basis.source === 'crop'
            const adjusted = own ? await adjustHarvestsToNormal(picked.samples, normalsFor, archiveFor) : null
            const harvestPart = adjusted?.gdd ?? targetGdd
            adjustNote = adjusted?.note ?? null
            const beforeRounded = Math.round(before)
            const windows = projectTwoStageHarvestWindow({ plantingDate: plantOn, milestoneGdd: beforeRounded, harvestGdd: harvestPart, count: heat.count, baseTemp, archive })
            const first = daysToTargetGdd({ normals, start: plantOn, count: 'simple', baseTemp: 0, targetGdd: beforeRounded })
            if (first.status === 'reached') {
              const second = daysToTargetGdd({ normals, start: addDays(plantOn, first.days + 1), count: heat.count, baseTemp, targetGdd: harvestPart })
              if (second.status === 'reached') {
                const date = addDays(plantOn, first.days + 1 + second.days)
                if (date.getFullYear() === plantOn.getFullYear()) {
                  normalHarvest = date
                  normalDays = first.days + 1 + second.days
                }
              }
            }
            if (windows.harvest) {
              normalStatus = 'reached'
              forecastKind = own ? adjusted ? 'adjusted' : 'actual' : 'method'
              windowLabel = formatHarvestWindow(windows.harvest)
              windowEarly = windows.harvest.early
              windowLate = windows.harvest.late
              milestonePlan = `来年も${formatYearMonthDay(plantOn)}に植えると、植付から出蕾まで単純積算${beforeRounded}℃日、出蕾の翌日から有効5℃で${harvestPart}℃日として、収穫は${windowLabel}。出蕾は${windows.milestone ? formatHarvestWindow(windows.milestone) : '見込みなし'}。${own ? '収穫までは自分の実績を使います。' : '収穫までは宮城県の資料の下限192℃日を使います。'}`
            } else {
              normalStatus = 'unreachable'
              normalNote = '過去10年の気温では、年内に出蕾後の収穫目安へ届きません。'
            }
          }
        }
      } else if (basis.view.status !== 'active' || targetGdd == null) {
        normalNote = basis.summary
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
          if (basis.source === 'variety' || basis.source === 'crop') {
            const adjusted = await adjustHarvestsToNormal(picked.samples, normalsFor, archiveFor)
            if (adjusted) {
              walkTarget = adjusted.gdd
              // 節目→収穫の実績日数を、植付→収穫の計画日数にそろえる。
              seasonDayFallback = adjusted.avgDays + (milestoneStart ? daysBetween(crop.plantingDate, milestoneStart) : 0)
              adjustNote = adjusted.note
              windowAdjustNote = adjusted.note
            }
          }
          let plantToFlower: number | null = null
          if (milestoneStart) {
            const flowerGdd = await getAccumulatedGDDFromApi({
              startDate: crop.plantingDate,
              endDate: milestoneStart,
              count: heat.count,
              baseTemp,
              point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
            })
            if (flowerGdd == null) {
              normalStatus = 'missing'
              normalNote = `植付から${originTerm}までの積算温度を取れなかったので、来年の日付は出せません。`
            } else {
              plantToFlower = Math.round(flowerGdd)
              walkTarget += plantToFlower
            }
          }
          if (milestoneStart && plantToFlower == null) {
            // 植付から節目までが取れないときは、植付日だけで歩かない
          } else {
          const reach = daysToTargetGdd({
            normals,
            start: nextPlant,
            count: heat.count,
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
              basis.source === 'method' ? 'method' : adjustNote ? 'adjusted' : 'actual'
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
              count: heat.count,
              baseTemp,
              archive,
              includeToday: true,
            })
            if (window) {
              windowLabel = formatHarvestWindow(window)
              windowEarly = window.early
              windowLate = window.late
              if (forecastKind === 'season-days' && windowAdjustNote) adjustNote = windowAdjustNote
              if (plantToFlower != null && forecastKind !== 'season-days') {
                const harvestPart = walkTarget - plantToFlower
                const own = basis.source === 'variety' || basis.source === 'crop'
                const unspecified =
                  basis.source === 'method' &&
                  basis.view.status === 'active' &&
                  basis.view.low === 850 &&
                  basis.view.high > basis.view.low
                const mean =
                  normalHarvest &&
                  normalHarvest.getTime() >= window.early.getTime() &&
                  normalHarvest.getTime() <= window.late.getTime()
                    ? `10年平均の1本の線では${formatYearMonthDay(normalHarvest)}ごろです（植付から${normalDays}日）。`
                    : ''
                milestonePlan = `来年も${formatYearMonthDay(plantOn)}に植えると、${own ? '去年と同じく' : ''}植付から${originTerm}まで${plantToFlower}℃日、そこから収穫開始まで${harvestPart}℃日として、${formatHarvestWindow(window)}。${mean}${unspecified ? '区分が無いので850℃で歩いています。大玉ならこれより遅くなります。' : ''}`
              }
            }
          }
          }
        }
      }

      let accumulatedGdd: number | null = null
      const gddEnd = milestoneStart ? crop.harvests[0]?.date ?? null : harvestDate
      const gddStart = milestoneStart ?? crop.plantingDate
      if (basis.view.status === 'active' && gddStart && gddEnd && hasWeatherCoordinates(point)) {
        accumulatedGdd = await getAccumulatedGDDFromApi({
          startDate: gddStart,
          endDate: gddEnd,
          count: heat.count,
          baseTemp,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        })
      }
      if (milestoneStart && accumulatedGdd != null) {
        historyMeasure = `${originTerm}から最初の収穫まで ${Math.round(accumulatedGdd)}℃日`
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

      const springOrigin =
        crop.farm && hasWeatherCoordinates(point)
          ? await springFor(crop.farm.id, Number(point.latitude), Number(point.longitude))
          : null
      const planAdvice = adviceNames(crop)
      const showPlanting =
        crop.growingSite !== 'house' && !planAdvice.recordOnly && Boolean(crop.cropKind)
      const condition = showPlanting ? plantingConditionForKind(crop.cropKind, crop.plantingMethod) : null
      const springEarlyNote =
        showPlanting && springOrigin?.summary && nextPlant && dateIsBeforeMonthDay(nextPlant, springOrigin.summary.latest)
          ? `この見込みの日は、過去10年の${springOrigin.source === 'estimate' ? '推計' : '観測'}でいちばん遅い霜（${formatMonthDay(springOrigin.summary.latest)}）より前です。`
          : null

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
        count: heat.count,
        baseTemp,
        countLabel,
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
        springLine: springOrigin ? springFrostSentence(springOrigin) : null,
        springSource: springOrigin?.source ?? null,
        plantingCondition: condition ? `${condition.text}（${condition.scopeLabel}）` : null,
        springEarlyNote,
        historyMeasure,
        milestonePlan,
      }
    })
  )
}
