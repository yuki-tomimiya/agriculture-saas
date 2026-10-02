import { prisma } from '@/lib/prisma'
import {
  commentYieldVsBenchmark,
  findCropBenchmark,
} from '@/lib/benchmarks/crops'
import { formatPlantingLabel } from '@/lib/insights/crop-season-compare'
import { getTargetGDDForCrop } from '@/lib/gdd'
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
  harvestCount: number
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
  previousSalesAmount: number | null
  yieldComment: string | null
  accumulatedGdd: number | null
  targetGdd: number | null
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
  const season = month >= 3 && month <= 5 ? '春作' : month >= 6 && month <= 8 ? '夏作' : month >= 9 && month <= 11 ? '秋作' : '冬作'
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
    if (args.harvestDiffPct === null) {
      parts.push('前回作付けとの収量比較は記録を確認してください')
    } else if (args.harvestDiffPct > 5) {
      parts.push(`収量は前回より +${args.harvestDiffPct}%`)
    } else if (args.harvestDiffPct < -5) {
      parts.push(`収量は前回より ${args.harvestDiffPct}%`)
    } else {
      parts.push('収量は前回と同程度')
    }
  }
  if (args.yieldComment) parts.push(args.yieldComment)
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
  let previousSalesAmount: number | null = null
  let harvestDiffPct: number | null = null
  let salesDiffPct: number | null = null
  if (previous) {
    previousHarvestQty = previous.harvests
      .filter((h) => h.unit === harvestUnit || (!h.unit && harvestUnit === 'kg'))
      .reduce((s, h) => s + h.quantity, 0)
    previousSalesAmount = previous.sales.reduce((s, sale) => s + sale.amount, 0)
    harvestDiffPct = pctDiff(harvestQty, previousHarvestQty)
    salesDiffPct = pctDiff(salesAmount, previousSalesAmount)
  }

  const benchmark = findCropBenchmark(crop.name, crop.variety)
  const yieldComment =
    harvestUnit === 'kg' && harvestQty > 0
      ? commentYieldVsBenchmark(harvestQty, benchmark)
      : null

  const endDate =
    crop.harvestDate ??
    lastHarvestDate ??
    (crop.status === 'growing' ? new Date() : null)

  let seasonDays: number | null = null
  if (crop.plantingDate && endDate) {
    seasonDays = daysBetween(crop.plantingDate, endDate)
  }

  const targetGdd = getTargetGDDForCrop(crop.name, crop.variety)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endStamp = endDate ? new Date(endDate) : null
  if (endStamp) endStamp.setHours(0, 0, 0, 0)
  const gddAsOf = !endStamp ? null : endStamp.getTime() >= today.getTime() ? 'today' : 'harvest'
  const seasonTitle = retrospectiveSeasonTitle(crop.plantingDate, crop.status)

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
    harvestCount,
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
    previousSalesAmount,
    yieldComment,
    accumulatedGdd: null,
    targetGdd,
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
