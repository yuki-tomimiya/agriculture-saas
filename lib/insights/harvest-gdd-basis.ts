import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { displayHeat, gddAvailability, gddStartDate, type GddAvailability, type GddMilestone, type HeatCount } from '@/lib/benchmarks/gdd-methods'
import { getAccumulatedGDDFromApi, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { formatPlantingLabel } from '@/lib/insights/crop-season-compare'
import { adviceNames, compareSubject } from '@/lib/crops/conditions'

export type HarvestSample = {
  cropId: string
  name: string
  variety: string | null
  varietyLabel: string | null
  cropKey: string
  subjectLabel: string
  growingSite: string | null
  gdd: number | null
  dayCount: number | null
  days: number
  seasonLabel: string
  plantingTime: number
  plantingDate: Date
  /** 平年換算で足し始める日。トマトは第1花房、スイートコーンは絹糸、ほかは植付 */
  countStart: Date
  endDate: Date
  count: HeatCount
  baseTemp: number
  latitude: number | null
  longitude: number | null
}

export type HarvestBasis = {
  /** 自分の実績の平均。無いときは数え方の下限。目安が無いときは null */
  gdd: number | null
  /** 絹糸など、気温ではなく日数で数える品目の実績・資料値。 */
  days: number | null
  source: 'variety' | 'crop' | 'method' | 'none'
  summary: string
  detail: string | null
  spreadNote: string | null
  view: GddAvailability
  /** 見込みの幅と霜に使う値。自分の実績があればその平均、無ければ数え方の下限 */
  windowGdd: number | null
}

function daysBetween(start: Date, end: Date): number {
  const a = new Date(start)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)))
}

function seasonLabel(name: string, variety: string | null, plantingDate: Date): string {
  const full = formatPlantingLabel(name, variety, plantingDate)
  const parts = full.split(' · ')
  return parts[1] ?? full
}

export async function loadHarvestSamples(userId: string): Promise<HarvestSample[]> {
  const { where, whereFallback } = getCropWhere(userId)
  const include = {
    farm: true,
    harvests: { orderBy: { date: 'asc' as const } },
    milestones: { select: { key: true, observedAt: true } },
  } as const
  const past = { status: { not: 'growing' as const }, plantingDate: { not: null } }
  let crops
  try {
    crops = await prisma.crop.findMany({ where: { AND: [where, past] }, include })
  } catch {
    crops = await prisma.crop.findMany({ where: { AND: [whereFallback, past] }, include })
  }

  const measured = await Promise.all(
    crops.map(async (crop) => {
      if (!crop.plantingDate) return null
      const firstHarvest = crop.harvests[0]?.date ?? null
      const lastHarvest = crop.harvests[crop.harvests.length - 1]?.date ?? null
      const point = { latitude: crop.farm?.latitude ?? null, longitude: crop.farm?.longitude ?? null }
      const advice = adviceNames(crop)
      const view = gddAvailability({
        cropKind: crop.cropKind,
        name: advice.recordOnly ? '' : advice.name,
        variety: advice.recordOnly ? null : advice.variety,
        plantingMethod: crop.plantingMethod,
        recordOnly: advice.recordOnly,
        milestones: crop.milestones,
      })
      if (view.status !== 'active' && view.status !== 'days') return null
      const end =
        view.key === 'tomato' || view.key === 'sweet-corn'
          ? firstHarvest
          : lastHarvest ?? crop.harvestDate
      if (!end) return null
      const start = view.status === 'days'
        ? view.startDate
        : gddStartDate(view, crop.plantingDate)
      if (end.getTime() < start.getTime()) return null
      const dayCount = view.status === 'days' ? daysBetween(start, end) : null
      if (view.status === 'active' && !hasWeatherCoordinates(point)) return null
      const gdd = view.status === 'active'
        ? await getAccumulatedGDDFromApi({
            startDate: start,
            endDate: end,
            count: view.count,
            baseTemp: view.baseTemp,
            point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
          })
        : null
      if (view.status === 'active' && gdd == null) return null
      const varietyLabel = (crop.variety ?? '').trim() || null
      const subject = compareSubject(crop)
      return {
        cropId: crop.id,
        name: crop.name,
        variety: crop.variety,
        varietyLabel,
        cropKey: subject.key,
        subjectLabel: subject.label,
        growingSite: crop.growingSite,
        gdd: view.status === 'active' && gdd != null ? Math.round(gdd) : null,
        dayCount,
        days: daysBetween(start, end),
        seasonLabel: seasonLabel(crop.name, crop.variety, crop.plantingDate),
        plantingTime: crop.plantingDate.getTime(),
        plantingDate: crop.plantingDate,
        countStart: start,
        endDate: end,
        count: view.status === 'active' ? view.count : 'simple',
        baseTemp: view.status === 'active' ? view.baseTemp : 0,
        latitude: hasWeatherCoordinates(point) ? Number(point.latitude) : null,
        longitude: hasWeatherCoordinates(point) ? Number(point.longitude) : null,
      } satisfies HarvestSample
    })
  )
  return measured.filter((row): row is HarvestSample => row != null)
}

function average(samples: HarvestSample[]): number {
  const values = samples.map((row) => row.gdd).filter((value): value is number => value != null)
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function detailLine(samples: HarvestSample[], avg: number): string | null {
  if (samples.length < 2) return null
  const ordered = [...samples].sort((a, b) => a.plantingTime - b.plantingTime)
  const years = ordered.map((row) => `${row.seasonLabel} ${row.gdd}℃日（${row.days}日）`).join('／')
  const daysAvg = Math.round(ordered.reduce((sum, row) => sum + row.days, 0) / ordered.length)
  return `${years} → 平均 ${avg}℃日（${daysAvg}日）`
}

function spreadNote(samples: HarvestSample[], avg: number): string | null {
  if (samples.length < 2 || avg <= 0) return null
  const values = samples.map((row) => row.gdd).filter((value): value is number => value != null)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if ((max - min) / avg < 0.15) return null
  return `作によって ${min}〜${max}℃日と差があります。`
}

export type HarvestBasisCrop = {
  cropKind?: string | null
  name: string
  variety?: string | null
  growingSite?: string | null
  plantingMethod?: string | null
  milestones?: GddMilestone[]
}

export function viewForCrop(crop: HarvestBasisCrop): GddAvailability {
  const advice = adviceNames(crop)
  return gddAvailability({
    cropKind: crop.cropKind,
    name: advice.recordOnly ? '' : advice.name,
    variety: advice.recordOnly ? null : advice.variety,
    plantingMethod: crop.plantingMethod,
    recordOnly: advice.recordOnly,
    milestones: crop.milestones,
  })
}

export function chosenHarvestSamples(
  samples: HarvestSample[],
  crop: HarvestBasisCrop
): { source: 'variety' | 'crop' | 'none'; samples: HarvestSample[] } {
  const subject = compareSubject(crop)
  const siteOf = (site?: string | null) => (site === 'open' || site === 'house' ? site : '')
  const pool = samples.filter(
    (row) => row.cropKey === subject.key && siteOf(row.growingSite) === siteOf(crop.growingSite)
  )
  const varietyLabel = (crop.variety ?? '').trim()
  const byVariety = varietyLabel
    ? pool.filter((row) => row.varietyLabel === varietyLabel)
    : pool.filter((row) => row.varietyLabel == null)
  if (byVariety.length > 0) return { source: 'variety', samples: byVariety }
  if (pool.length > 0) return { source: 'crop', samples: pool }
  return { source: 'none', samples: [] }
}

function methodSummary(view: GddAvailability): string {
  if (view.status === 'active') {
    return `${view.scopeLabel}の目安 ${view.rangeLabel}（${view.countLabel}）`
  }
  if (view.status === 'days') {
    return `${view.scopeLabel}の目安 ${view.rangeLabel}（${view.countLabel}）`
  }
  if (view.status === 'pending') return view.message
  return view.message
}

export function pickHarvestBasis(samples: HarvestSample[], crop: HarvestBasisCrop): HarvestBasis {
  const view = viewForCrop(crop)
  const empty = {
    view,
    detail: null,
    spreadNote: null,
    days: null,
  }
  if (view.status === 'days') {
    const picked = chosenHarvestSamples(samples, crop)
    const usable = picked.samples.filter((sample) => sample.dayCount != null)
    if (usable.length === 0) {
      return {
        ...empty,
        gdd: null,
        days: view.lowDays,
        source: 'method',
        summary: methodSummary(view),
        windowGdd: null,
      }
    }
    const days = Math.round(
      usable.reduce((sum, sample) => sum + (sample.dayCount ?? 0), 0) / usable.length
    )
    const count = usable.length
    const key = compareSubject(crop).label
    return {
      ...empty,
      gdd: null,
      days,
      source: picked.source,
      summary:
        picked.source === 'crop'
          ? `同じ品種の実績がないので、${key}の過去${count}作の平均 ${days}日`
          : count === 1
            ? `前回のあなたは${days}日で最初に収穫しました`
            : `過去${count}作の最初の収穫までの平均 ${days}日`,
      detail: usable.length < 2
        ? null
        : usable
            .sort((a, b) => a.plantingTime - b.plantingTime)
            .map((sample) => `${sample.seasonLabel} ${sample.dayCount}日`)
            .join('／'),
      windowGdd: null,
    }
  }
  if (view.status !== 'active') {
    return {
      ...empty,
      gdd: null,
      source: 'none',
      summary: methodSummary(view),
      windowGdd: null,
    }
  }
  const picked = chosenHarvestSamples(samples, crop)
  const usable = picked.samples.filter((sample) => sample.gdd != null)
  if (picked.source === 'none' || usable.length === 0) {
    return {
      ...empty,
      gdd: view.low,
      source: 'method',
      summary: methodSummary(view),
      windowGdd: view.low,
    }
  }
  const gdd = average(usable)
  const count = usable.length
  const key = compareSubject(crop).label
  const summary =
    picked.source === 'crop'
      ? `同じ品種の実績がないので、${key}の過去${count}作の平均 ${gdd}℃日`
      : count === 1
        ? `前回のあなたは${gdd}℃日で収穫しました`
        : `過去${count}作の収穫時点の平均 ${gdd}℃日`
  return {
    gdd,
    days: null,
    source: picked.source,
    summary,
    detail: detailLine(usable, gdd),
    spreadNote: spreadNote(usable, gdd),
    view,
    windowGdd: gdd,
  }
}

export function heatForCrop(crop: HarvestBasisCrop): { count: HeatCount; baseTemp: number } {
  return displayHeat(viewForCrop(crop))
}
