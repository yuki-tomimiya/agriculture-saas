import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { getTargetGDDForCrop, TARGET_GDD_BY_CROP } from '@/lib/gdd'
import { getAccumulatedGDDFromApi, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { formatPlantingLabel } from '@/lib/insights/crop-season-compare'

export type HarvestSample = {
  cropId: string
  name: string
  variety: string | null
  varietyLabel: string | null
  cropKey: string | null
  gdd: number
  days: number
  seasonLabel: string
  plantingTime: number
  plantingDate: Date
  endDate: Date
  baseTemp: number
  latitude: number
  longitude: number
}

export type HarvestBasis = {
  gdd: number
  source: 'variety' | 'crop' | 'provisional'
  summary: string
  detail: string | null
  spreadNote: string | null
}

function daysBetween(start: Date, end: Date): number {
  const a = new Date(start)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)))
}

function cropKeyOf(name: string): string | null {
  for (const key of Object.keys(TARGET_GDD_BY_CROP)) {
    if (name.includes(key)) return key
  }
  const trimmed = name.trim()
  return trimmed || null
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
      const lastHarvest = crop.harvests[crop.harvests.length - 1]?.date ?? null
      const end = lastHarvest ?? crop.harvestDate
      const point = { latitude: crop.farm?.latitude ?? null, longitude: crop.farm?.longitude ?? null }
      if (!end || !hasWeatherCoordinates(point)) return null
      const gdd = await getAccumulatedGDDFromApi({
        startDate: crop.plantingDate,
        endDate: end,
        baseTemp: crop.baseTemperature ?? 10,
        point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
      })
      if (gdd == null) return null
      const varietyLabel = (crop.variety ?? '').trim() || null
      return {
        cropId: crop.id,
        name: crop.name,
        variety: crop.variety,
        varietyLabel,
        cropKey: cropKeyOf(crop.name),
        gdd: Math.round(gdd),
        days: daysBetween(crop.plantingDate, end),
        seasonLabel: seasonLabel(crop.name, crop.variety, crop.plantingDate),
        plantingTime: crop.plantingDate.getTime(),
        plantingDate: crop.plantingDate,
        endDate: end,
        baseTemp: crop.baseTemperature ?? 10,
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
      } satisfies HarvestSample
    })
  )
  return measured.filter((row): row is HarvestSample => row != null)
}

function average(samples: HarvestSample[]): number {
  const total = samples.reduce((sum, row) => sum + row.gdd, 0)
  return Math.round(total / samples.length)
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
  const values = samples.map((row) => row.gdd)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if ((max - min) / avg < 0.15) return null
  return `作によって ${min}〜${max}℃日と差があります。`
}

export function chosenHarvestSamples(
  samples: HarvestSample[],
  cropName: string,
  variety?: string | null
): { source: HarvestBasis['source']; samples: HarvestSample[]; provisional: number } {
  const provisional = getTargetGDDForCrop(cropName, variety)
  const varietyLabel = (variety ?? '').trim()
  const key = cropKeyOf(cropName)
  const byVariety = varietyLabel
    ? samples.filter((row) => row.varietyLabel === varietyLabel)
    : []
  const byCrop = key ? samples.filter((row) => row.cropKey === key) : []
  if (byVariety.length > 0) return { source: 'variety', samples: byVariety, provisional }
  if (byCrop.length > 0) return { source: 'crop', samples: byCrop, provisional }
  return { source: 'provisional', samples: [], provisional }
}

export function pickHarvestBasis(
  samples: HarvestSample[],
  cropName: string,
  variety?: string | null
): HarvestBasis {
  const picked = chosenHarvestSamples(samples, cropName, variety)
  const { source } = picked
  const chosen = picked.samples
  const provisional = picked.provisional
  const key = cropKeyOf(cropName)
  if (source === 'provisional') {
    return {
      gdd: provisional,
      source,
      summary: `一般の目安（暫定）${provisional}℃日`,
      detail: null,
      spreadNote: null,
    }
  }
  const gdd = average(chosen)
  const count = chosen.length
  const summary =
    source === 'crop'
      ? `同じ品種の実績がないので、${key}の過去${count}作の平均 ${gdd}℃日`
      : count === 1
        ? `過去1作の収穫時点 ${gdd}℃日（1年分の実績です）`
        : `過去${count}作の収穫時点の平均 ${gdd}℃日`
  return {
    gdd,
    source,
    summary,
    detail: detailLine(chosen, gdd),
    spreadNote: spreadNote(chosen, gdd),
  }
}
