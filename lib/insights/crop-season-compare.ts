import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import {
  commentYieldVsBenchmark,
  findCropBenchmark,
  type CropBenchmark,
} from '@/lib/benchmarks/crops'

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
  previousHarvestQty: number | null
  harvestDiffPct: number | null
  salesAmount: number
  previousSalesAmount: number | null
  salesDiffPct: number | null
  benchmark: CropBenchmark | null
  yieldComment: string | null
  summaryLine: string
}

function matchKey(name: string, variety: string | null, farmId: string | null): string {
  return `${name.trim().toLowerCase()}|${(variety ?? '').trim().toLowerCase()}|${farmId ?? ''}`
}

function formatPlantingLabel(name: string, variety: string | null, plantingDate: Date | null): string {
  const y = plantingDate ? plantingDate.getFullYear() : null
  const m = plantingDate ? plantingDate.getMonth() + 1 : null
  const season =
    y && m
      ? m <= 5
        ? `${y}年春作`
        : m <= 8
          ? `${y}年夏作`
          : `${y}年秋作`
      : y
        ? `${y}年作`
        : '作付け時期未設定'
  const v = variety ? `（${variety}）` : ''
  return `${name}${v} · ${season}`
}

function pctDiff(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function buildSummary(args: {
  harvestDiffPct: number | null
  hasPrevious: boolean
  yieldComment: string | null
}): string {
  const parts: string[] = []
  if (!args.hasPrevious) {
    parts.push('比較できる前回作付けがまだありません')
  } else if (args.harvestDiffPct === null) {
    parts.push('前回作付けとの収量比較ができません（単位や記録を確認）')
  } else if (args.harvestDiffPct > 5) {
    parts.push(`収量は前回作付けより +${args.harvestDiffPct}%`)
  } else if (args.harvestDiffPct < -5) {
    parts.push(`収量は前回作付けより ${args.harvestDiffPct}%`)
  } else {
    parts.push('収量は前回作付けと同程度')
  }
  if (args.yieldComment) parts.push(args.yieldComment)
  return parts.join('。') + '。'
}

/**
 * 作付け単位で「今回」と「同名・同品種・同農場の前回作付け」を比較する
 */
export async function getCropSeasonComparisons(userId: string): Promise<SeasonCompareRow[]> {
  const { where, whereFallback } = getCropWhere(userId)
  const include = {
    farm: true,
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
    const key = matchKey(crop.name, crop.variety, crop.farmId)
    const list = byKey.get(key) ?? []
    list.push(crop)
    byKey.set(key, list)
  }

  const rows: SeasonCompareRow[] = []

  for (const group of byKey.values()) {
    // plantingDate 降順（null は末尾）
    const sorted = [...group].sort((a, b) => {
      const ta = a.plantingDate?.getTime() ?? 0
      const tb = b.plantingDate?.getTime() ?? 0
      return tb - ta
    })

    // グループにつき「最新の作付け」1件だけ表示し、1つ前を前回として比較する
    // （前回作付け自体を別カードにすると「比較なし」に見えてしまうため）
    const current = sorted[0]
    if (!current) continue
    const previous = sorted[1] ?? null

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

    const harvestDiffPct =
      previousHarvestQty !== null ? pctDiff(harvestQty, previousHarvestQty) : null
    const salesDiffPct =
      previousSalesAmount !== null ? pctDiff(salesAmount, previousSalesAmount) : null

    const benchmark = findCropBenchmark(current.name, current.variety)
    const yieldComment =
      harvestUnit === 'kg' && harvestQty > 0
        ? commentYieldVsBenchmark(harvestQty, benchmark)
        : null

    rows.push({
      currentCropId: current.id,
      cropName: current.name,
      variety: current.variety,
      farmId: current.farmId,
      farmName: current.farm?.name ?? null,
      currentStatus: current.status,
      currentLabel: formatPlantingLabel(current.name, current.variety, current.plantingDate),
      previousLabel: previous
        ? formatPlantingLabel(previous.name, previous.variety, previous.plantingDate)
        : null,
      previousCropId: previous?.id ?? null,
      plantingDate: current.plantingDate,
      previousPlantingDate: previous?.plantingDate ?? null,
      harvestQty,
      harvestUnit,
      previousHarvestQty,
      harvestDiffPct,
      salesAmount,
      previousSalesAmount,
      salesDiffPct,
      benchmark,
      yieldComment,
      summaryLine: buildSummary({
        harvestDiffPct,
        hasPrevious: !!previous,
        yieldComment,
      }),
    })
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

