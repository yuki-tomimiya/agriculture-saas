import { prisma } from '@/lib/prisma'
import { describeYieldChange, formatPlantingLabel } from '@/lib/insights/crop-season-compare'
import { seasonName } from '@/lib/insights/season'
import { latestHarvestDate, sharesFieldPeriod } from '@/lib/benchmarks/national-yield'
import { loadHarvestSamples, pickHarvestBasis, type HarvestBasis } from '@/lib/insights/harvest-gdd-basis'
import {
  getAccumulatedGDDFromApi,
  hasWeatherCoordinates,
} from '@/lib/weather-forecast'

export type CropSeasonRetrospective = {
  cropId: string
  label: string
  cropName: string
  variety: string | null
  farmName: string | null
  farmId: string | null
  status: string
  plantingDate: Date | null
  endDate: Date | null
  seasonDays: number | null
  harvestQty: number
  harvestUnit: string
  fieldAreaM2: number | null
  sharedField: boolean
  harvestCount: number
  salesCount: number
  firstHarvestDate: Date | null
  lastHarvestDate: Date | null
  salesAmount: number
  workCount: number
  workByType: { taskType: string; count: number }[]
  recentWorks: { date: Date; taskType: string }[]
  pesticideCount: number
  fertilizerCount: number
  previousLabel: string | null
  previousCropId: string | null
  harvestDiffPct: number | null
  salesDiffPct: number | null
  previousHarvestQty: number | null
  previousHarvestCount: number | null
  previousSalesAmount: number | null
  previousSalesCount: number | null
  yieldComment: string | null
  accumulatedGdd: number | null
  targetGdd: number | null
  gddBasis: HarvestBasis | null
  /** 積算温度の終点。今日までなら today、収穫日までなら harvest */
  gddAsOf: 'today' | 'harvest' | null
  seasonTitle: string
  headlineSummary: string
}

export function retrospectiveSeasonTitle(plantingDate: Date | null, status: string): string {
  if (status === 'growing') return '栽培中の途中まとめ'
  if (!plantingDate) return 'この作付けの振り返り'
  const year = new Date(plantingDate).getFullYear()
  if (year === new Date().getFullYear()) return '今シーズンの振り返り'
  const month = new Date(plantingDate).getMonth() + 1
  const season = `${seasonName(month)}作`
  return `${year}年${season}の振り返り`
}

function matchKey(name: string, variety: string | null, farmId: string | null): string {
  return `${name.trim().toLowerCase()}|${(variety ?? '').trim().toLowerCase()}|${farmId ?? ''}`
}

function pctDiff(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function daysBetween(start: Date, end: Date): number {
  const a = new Date(start)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)))
}

function buildHeadline(args: {
  status: string
  harvestDiffPct: number | null
  hasPrevious: boolean
  harvestQty: number
  harvestUnit: string
  salesAmount: number
  yieldComment: string | null
  workCount: number
  seasonTitle: string
}): string {
  const parts: string[] = []
  parts.push(`${args.seasonTitle}です`)
  if (args.harvestQty > 0) {
    parts.push(`収量合計 ${args.harvestQty}${args.harvestUnit}`)
  }
  if (args.salesAmount > 0) {
    parts.push(`売上 ${args.salesAmount.toLocaleString('ja-JP')}円`)
  }
  if (args.hasPrevious) {
    parts.push(
      describeYieldChange({
        harvestDiffPct: args.harvestDiffPct,
        hasPrevious: true,
        yieldComment: args.yieldComment,
      }).replace(/。$/, '')
    )
  } else if (args.yieldComment) {
    parts.push(args.yieldComment.replace(/。$/, ''))
  }
  if (args.workCount > 0) parts.push(`作業記録 ${args.workCount}件`)
  return parts.join('。') + '。'
}

/**
 * 作付け1件の終了時（または途中）振り返りサマリー。DB保存なし・都度集計。
 */
export async function getCropSeasonRetrospective(
  userId: string,
  cropId: string
): Promise<CropSeasonRetrospective | null> {
  const include = {
    farm: true,
    field: { select: { area: true } },
    harvests: { orderBy: { date: 'asc' as const } },
    sales: true,
    workRecords: { orderBy: { date: 'asc' as const } },
    pesticideRecords: true,
    fertilizerRecords: true,
  } as const

  const crop = await prisma.crop.findFirst({
    where: {
      id: cropId,
      OR: [{ userId }, { farm: { userId } }],
    },
    include,
  })
  if (!crop) return null

  const harvestUnit =
    crop.harvests.find((h) => h.unit)?.unit ?? 'kg'
  const harvestQty = crop.harvests
    .filter((h) => h.unit === harvestUnit || (!h.unit && harvestUnit === 'kg'))
    .reduce((s, h) => s + h.quantity, 0)
  const harvestCount = crop.harvests.length
  const firstHarvestDate = crop.harvests[0]?.date ?? null
  const lastHarvestDate = crop.harvests[crop.harvests.length - 1]?.date ?? null
  const salesAmount = crop.sales.reduce((s, sale) => s + sale.amount, 0)
  const salesCount = crop.sales.length

  const workByTypeMap = new Map<string, number>()
  for (const w of crop.workRecords) {
    workByTypeMap.set(w.taskType, (workByTypeMap.get(w.taskType) ?? 0) + 1)
  }
  const workByType = [...workByTypeMap.entries()]
    .map(([taskType, count]) => ({ taskType, count }))
    .sort((a, b) => b.count - a.count)
  const recentWorks = crop.workRecords.slice(-5).reverse().map((w) => ({
    date: w.date,
    taskType: w.taskType,
  }))

  // 前回作付け（同名・同品種・同農場）
  const siblings = await prisma.crop.findMany({
    where: {
      name: crop.name,
      variety: crop.variety ?? undefined,
      farmId: crop.farmId ?? undefined,
      OR: [{ userId }, { farm: { userId } }],
    },
    include: { harvests: true, sales: true },
    orderBy: { plantingDate: 'desc' },
  })
  const group = siblings
    .filter((c) => matchKey(c.name, c.variety, c.farmId) === matchKey(crop.name, crop.variety, crop.farmId))
    .sort((a, b) => (b.plantingDate?.getTime() ?? 0) - (a.plantingDate?.getTime() ?? 0))
  const idx = group.findIndex((c) => c.id === crop.id)
  const previous = idx >= 0 ? group[idx + 1] : null

  let previousHarvestQty: number | null = null
  let previousHarvestCount: number | null = null
  let previousSalesAmount: number | null = null
  let previousSalesCount: number | null = null
  let harvestDiffPct: number | null = null
  let salesDiffPct: number | null = null
  if (previous) {
    previousHarvestCount = previous.harvests.length
    previousSalesCount = previous.sales.length
    previousHarvestQty = previous.harvests
      .filter((h) => h.unit === harvestUnit || (!h.unit && harvestUnit === 'kg'))
      .reduce((s, h) => s + h.quantity, 0)
    previousSalesAmount = previous.sales.reduce((s, sale) => s + sale.amount, 0)
    harvestDiffPct =
      harvestCount > 0 && previousHarvestCount > 0
        ? pctDiff(harvestQty, previousHarvestQty)
        : null
    salesDiffPct =
      salesCount > 0 && previousSalesCount > 0 ? pctDiff(salesAmount, previousSalesAmount) : null
  }

  const yieldComment = null

  const endDate =
    crop.harvestDate ??
    lastHarvestDate ??
    (crop.status === 'growing' ? new Date() : null)

  let seasonDays: number | null = null
  if (crop.plantingDate && endDate) {
    seasonDays = daysBetween(crop.plantingDate, endDate)
  }

  const harvestSamples = await loadHarvestSamples(userId)
  const gddBasis = pickHarvestBasis(harvestSamples, crop.name, crop.variety)
  const targetGdd = gddBasis.gdd
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endStamp = endDate ? new Date(endDate) : null
  if (endStamp) endStamp.setHours(0, 0, 0, 0)
  const gddAsOf = !endStamp ? null : endStamp.getTime() >= today.getTime() ? 'today' : 'harvest'
  const seasonTitle = retrospectiveSeasonTitle(crop.plantingDate, crop.status)

  const fieldMates = crop.fieldId
    ? await prisma.crop.findMany({
        where: { fieldId: crop.fieldId, NOT: { id: crop.id } },
        select: {
          id: true,
          fieldId: true,
          plantingDate: true,
          status: true,
          harvests: { select: { date: true } },
        },
      })
    : []
  const sharedField = sharesFieldPeriod(
    {
      id: crop.id,
      fieldId: crop.fieldId,
      plantingDate: crop.plantingDate,
      status: crop.status,
      lastHarvestDate,
    },
    fieldMates.map((mate) => ({
      id: mate.id,
      fieldId: mate.fieldId,
      plantingDate: mate.plantingDate,
      status: mate.status,
      lastHarvestDate: latestHarvestDate(mate.harvests.map((harvest) => harvest.date)),
    }))
  )

  const label = formatPlantingLabel(crop.name, crop.variety, crop.plantingDate)
  const headlineSummary = buildHeadline({
    status: crop.status,
    harvestDiffPct,
    hasPrevious: !!previous,
    harvestQty,
    harvestUnit,
    salesAmount,
    yieldComment,
    workCount: crop.workRecords.length,
    seasonTitle,
  })

  return {
    cropId: crop.id,
    label,
    cropName: crop.name,
    variety: crop.variety,
    farmName: crop.farm?.name ?? null,
    farmId: crop.farmId,
    status: crop.status,
    plantingDate: crop.plantingDate,
    endDate,
    seasonDays,
    harvestQty,
    harvestUnit,
    fieldAreaM2: crop.field?.area ?? null,
    sharedField,
    harvestCount,
    salesCount,
    firstHarvestDate,
    lastHarvestDate,
    salesAmount,
    workCount: crop.workRecords.length,
    workByType,
    recentWorks,
    pesticideCount: crop.pesticideRecords.length,
    fertilizerCount: crop.fertilizerRecords.length,
    previousLabel: previous
      ? formatPlantingLabel(previous.name, previous.variety, previous.plantingDate)
      : null,
    previousCropId: previous?.id ?? null,
    harvestDiffPct,
    salesDiffPct,
    previousHarvestQty,
    previousHarvestCount,
    previousSalesAmount,
    previousSalesCount,
    yieldComment,
    accumulatedGdd: null,
    targetGdd,
    gddBasis,
    gddAsOf,
    seasonTitle,
    headlineSummary,
  }
}

export async function getRetrospectiveGdd(
  userId: string,
  cropId: string
): Promise<{ accumulatedGdd: number | null } | null> {
  const crop = await prisma.crop.findFirst({
    where: { id: cropId, OR: [{ userId }, { farm: { userId } }] },
    include: { farm: true, harvests: { orderBy: { date: 'asc' } } },
  })
  if (!crop) return null
  const lastHarvestDate = crop.harvests[crop.harvests.length - 1]?.date ?? null
  const endDate = crop.harvestDate ?? lastHarvestDate ?? (crop.status === 'growing' ? new Date() : null)
  const point = {
    latitude: crop.farm?.latitude ?? null,
    longitude: crop.farm?.longitude ?? null,
  }
  if (!crop.plantingDate || !endDate || !hasWeatherCoordinates(point)) {
    return { accumulatedGdd: null }
  }
  const accumulatedGdd = await getAccumulatedGDDFromApi({
    startDate: crop.plantingDate,
    endDate,
    baseTemp: crop.baseTemperature ?? 10,
    point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
  })
  return { accumulatedGdd }
}
