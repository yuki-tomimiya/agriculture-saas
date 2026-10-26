import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { findCropBenchmark, type CropBenchmark } from '@/lib/benchmarks/crops'
import {
  adviceNames,
  appendPlantingGapNote,
  personalGroupKey,
  plantingGapNote,
  previousPlanting,
} from '@/lib/crops/conditions'
import { ownYieldRates } from '@/lib/benchmarks/national-yield'
import { seasonName } from '@/lib/insights/season'
import { latestHarvestDate, sharesFieldPeriod, type FieldStay } from '@/lib/benchmarks/national-yield'

export type SeasonCompareRow = {
  currentCropId: string
  cropName: string
  variety: string | null
  farmId: string | null
  farmName: string | null
  currentStatus: string
  currentLabel: string
  previousLabel: string | null
  previousCropId: string | null
  plantingDate: Date | null
  previousPlantingDate: Date | null
  harvestQty: number
  harvestUnit: string
  fieldAreaM2: number | null
  sharedField: boolean
  areaLabel: string | null
  kgPerPlant: number | null
  kgPer10a: number | null
  harvestRecorded: boolean
  previousHarvestQty: number | null
  previousHarvestRecorded: boolean | null
  harvestDiffPct: number | null
  salesAmount: number
  salesRecorded: boolean
  previousSalesAmount: number | null
  previousSalesRecorded: boolean | null
  salesDiffPct: number | null
  benchmark: CropBenchmark | null
  yieldComment: string | null
  summaryLine: string
}

/** 比較の行の見分け。呼び名、植え付け日、株数。 */
export function formatCropRowLabel(crop: {
  name: string
  variety: string | null
  plantingDate: Date | null
  plantCount: number | null
}): string {
  const variety = crop.variety ? `（${crop.variety}）` : ''
  const date = crop.plantingDate
    ? `${crop.plantingDate.getFullYear()}/${crop.plantingDate.getMonth() + 1}/${crop.plantingDate.getDate()}`
    : '植え付け日なし'
  const count = crop.plantCount != null ? `${crop.plantCount}本` : '株数なし'
  return `${crop.name}${variety} · ${date} · ${count}`
}

export function formatPlantingLabel(name: string, variety: string | null, plantingDate: Date | null): string {
  const y = plantingDate ? plantingDate.getFullYear() : null
  const m = plantingDate ? plantingDate.getMonth() + 1 : null
  const season = y && m ? `${y}年${seasonName(m)}作` : y ? `${y}年作` : '作付け時期未設定'
  const v = variety ? `（${variety}）` : ''
  return `${name}${v} · ${season}`
}

function pctDiff(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** 前回比と一般目安を、判断できる1文にする */
export function describeYieldChange(args: {
  harvestDiffPct: number | null
  hasPrevious: boolean
  yieldComment: string | null
  currentHarvestRecorded?: boolean
  previousHarvestQty?: number | null
}): string {
  if (!args.hasPrevious) return '比較できる前回作付けがまだありません。'
  if (
    args.currentHarvestRecorded === false &&
    args.previousHarvestQty != null &&
    args.previousHarvestQty > 0
  ) {
    const kg = Math.round(args.previousHarvestQty * 10) / 10
    const base = `前回の収量は${kg}kgでした`
    return args.yieldComment ? `${base}。${args.yieldComment}` : `${base}。`
  }
  if (args.harvestDiffPct === null) {
    const base = '前回作付けとの収量比較ができません（単位や記録を確認）'
    return args.yieldComment ? `${base}。${args.yieldComment}` : `${base}。`
  }
  const pct = args.harvestDiffPct
  const base = `収量は前回作付けより ${pct > 0 ? '+' : ''}${pct}%です。`
  return args.yieldComment ? `${base}${args.yieldComment}` : base
}

/**
 * いちばん新しい植え付けの年の作付けを1行ずつ出し、前の年の近い月日と比べる。
 */
export async function getCropSeasonComparisons(userId: string): Promise<SeasonCompareRow[]> {
  const { where, whereFallback } = getCropWhere(userId)
  const include = {
    farm: true,
    field: { select: { area: true } },
    harvests: true,
    sales: true,
  } as const

  let crops
  try {
    crops = await prisma.crop.findMany({ where, include, orderBy: { plantingDate: 'desc' } })
  } catch {
    crops = await prisma.crop.findMany({
      where: whereFallback,
      include,
      orderBy: { plantingDate: 'desc' },
    })
  }

  const byKey = new Map<string, typeof crops>()
  for (const crop of crops) {
    const key = personalGroupKey(crop)
    const list = byKey.get(key) ?? []
    list.push(crop)
    byKey.set(key, list)
  }

  const stays: FieldStay[] = crops.map((crop) => ({
    id: crop.id,
    fieldId: crop.fieldId,
    plantingDate: crop.plantingDate,
    status: crop.status,
    lastHarvestDate: latestHarvestDate(crop.harvests.map((harvest) => harvest.date)),
  }))

  const rows: SeasonCompareRow[] = []

  for (const group of byKey.values()) {
    const newestYear = group.reduce<number | null>((latest, crop) => {
      if (!crop.plantingDate) return latest
      const year = crop.plantingDate.getFullYear()
      return latest == null || year > latest ? year : latest
    }, null)
    if (newestYear == null) continue
    const currents = group.filter((crop) => crop.plantingDate?.getFullYear() === newestYear)

    for (const current of currents) {
    const previous = previousPlanting(current, group)

    const harvestUnit =
      current.harvests.find((h) => h.unit)?.unit ??
      previous?.harvests.find((h) => h.unit)?.unit ??
      'kg'

    const harvestQty = current.harvests
      .filter((h) => h.unit === harvestUnit || (!h.unit && harvestUnit === 'kg'))
      .reduce((s, h) => s + h.quantity, 0)

    const previousHarvestQty = previous
      ? previous.harvests
          .filter((h) => h.unit === harvestUnit || (!h.unit && harvestUnit === 'kg'))
          .reduce((s, h) => s + h.quantity, 0)
      : null

    const salesAmount = current.sales.reduce((s, sale) => s + sale.amount, 0)
    const previousSalesAmount = previous
      ? previous.sales.reduce((s, sale) => s + sale.amount, 0)
      : null

    const harvestRecorded = current.harvests.length > 0
    const previousHarvestRecorded = previous ? previous.harvests.length > 0 : null
    const salesRecorded = current.sales.length > 0
    const previousSalesRecorded = previous ? previous.sales.length > 0 : null
    const harvestDiffPct =
      previousHarvestQty !== null && harvestRecorded && previousHarvestRecorded
        ? pctDiff(harvestQty, previousHarvestQty)
        : null
    const salesDiffPct =
      previousSalesAmount !== null && salesRecorded && previousSalesRecorded
        ? pctDiff(salesAmount, previousSalesAmount)
        : null

    const compareAdvice = adviceNames(current)
    const benchmark = compareAdvice.recordOnly
      ? null
      : findCropBenchmark(compareAdvice.name, compareAdvice.variety)
    const yieldComment = null
    const sharedOnField = sharesFieldPeriod(
      stays.find((stay) => stay.id === current.id) ?? {
        id: current.id,
        fieldId: current.fieldId,
        plantingDate: current.plantingDate,
        status: current.status,
        lastHarvestDate: null,
      },
      stays
    )
    const rates = ownYieldRates({
      qtyKg: harvestQty,
      plantCount: current.plantCount,
      cropAreaM2: current.areaM2,
      fieldAreaM2: current.field?.area ?? null,
      sharedField: sharedOnField,
    })

    rows.push({
      currentCropId: current.id,
      cropName: current.name,
      variety: current.variety,
      farmId: current.farmId,
      farmName: current.farm?.name ?? null,
      currentStatus: current.status,
      currentLabel: formatCropRowLabel(current),
      previousLabel: previous
        ? formatCropRowLabel(previous)
        : null,
      previousCropId: previous?.id ?? null,
      plantingDate: current.plantingDate,
      previousPlantingDate: previous?.plantingDate ?? null,
      harvestQty,
      harvestUnit,
      fieldAreaM2: rates.areaM2,
      sharedField: rates.sharedField,
      areaLabel: rates.areaLabel,
      kgPerPlant: rates.perPlant,
      kgPer10a: rates.per10a,
      harvestRecorded,
      previousHarvestQty,
      previousHarvestRecorded,
      harvestDiffPct,
      salesAmount,
      salesRecorded,
      previousSalesAmount,
      previousSalesRecorded,
      salesDiffPct,
      benchmark,
      yieldComment,
      summaryLine: appendPlantingGapNote(
        describeYieldChange({
          harvestDiffPct,
          hasPrevious: !!previous,
          yieldComment,
          currentHarvestRecorded: harvestRecorded,
          previousHarvestQty,
        }),
        plantingGapNote(current.plantingDate, previous?.plantingDate ?? null),
      ),
    })
    }
  }

  rows.sort((a, b) => {
    // 前回比較があるものを先に、その後 plantingDate 新しい順
    const aHas = a.previousCropId ? 1 : 0
    const bHas = b.previousCropId ? 1 : 0
    if (aHas !== bHas) return bHas - aHas
    const ap = a.plantingDate?.getTime() ?? 0
    const bp = b.plantingDate?.getTime() ?? 0
    return bp - ap
  })

  return rows
}

export type PastCropArchiveItem = {
  id: string
  label: string
  farmName: string | null
  status: string
  plantingDate: Date
  harvestDate: Date | null
}

/** 収穫済み・完了など「過去」の作付け一覧（植付日あり） */
export async function getPastCropsArchive(userId: string): Promise<PastCropArchiveItem[]> {
  const { where, whereFallback } = getCropWhere(userId)
  let crops
  try {
    crops = await prisma.crop.findMany({
      where: {
        AND: [where, { status: { not: 'growing' }, plantingDate: { not: null } }],
      },
      include: { farm: true },
      orderBy: { plantingDate: 'desc' },
    })
  } catch {
    crops = await prisma.crop.findMany({
      where: {
        AND: [whereFallback, { status: { not: 'growing' }, plantingDate: { not: null } }],
      },
      include: { farm: true },
      orderBy: { plantingDate: 'desc' },
    })
  }

  return crops
    .filter((c): c is typeof c & { plantingDate: Date } => c.plantingDate != null)
    .map((c) => ({
      id: c.id,
      label: formatPlantingLabel(c.name, c.variety, c.plantingDate),
      farmName: c.farm?.name ?? null,
      status: c.status,
      plantingDate: c.plantingDate,
      harvestDate: c.harvestDate,
    }))
}

