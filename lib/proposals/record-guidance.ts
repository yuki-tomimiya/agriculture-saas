import type { Proposal } from '@/lib/ai-proposal'
import { fertilizerStandard } from '@/lib/fertilizer-standards'
import { harvestDatesByCrop, japanDateKey } from '@/lib/pesticide-safety'
import { prisma } from '@/lib/prisma'
import { FROST_FORECAST_TRIGGER, FROST_SEASON_TRIGGER } from '@/lib/proposals/frost'

const feedingMilestones = new Set(['flower-3rd', 'first-fruit', 'cabbage-heading', 'negi-final-hilling', 'sprout', 'bud'])
const harvestFeedingMilestones = new Set(['first-fruit', 'side-shoot', 'pepper-feed'])
const harvestMilestones = new Set([
  'yellowing', 'test-dig', 'cabbage-firm', 'onion-lodging', 'lettuce-outer-leaves',
  'spinach-height', 'komatsuna-height', 'negi-final-hilling',
])

export function latestFertilizerDates(records: { cropId: string | null; appliedAt: Date }[]) {
  const dates = new Map<string, string>()
  for (const { cropId, appliedAt } of records) {
    if (!cropId) continue
    const date = japanDateKey(appliedAt)
    if (date > (dates.get(cropId) ?? '')) dates.set(cropId, date)
  }
  return dates
}

export function fertilizerRecordedForMilestone(last?: string, observedAt?: Date): boolean {
  return !!last && !!observedAt && last >= japanDateKey(observedAt)
}

export function upcomingHarvestDate(date: string | undefined, today: string) {
  return date && date > today ? date : undefined
}

export type CropRecordGuidance = {
  fertilizer?: { last?: string; daysAgo?: number; recorded: boolean; href: string }
  harvestFrom?: string
}

export type ProposalRecordGuidance = {
  byCrop: Map<string, CropRecordGuidance>
  standards: ReturnType<typeof fertilizerStandard>[]
}

type RecordGuidanceTarget = Pick<Proposal,
  'id' | 'trigger' | 'relatedCropId' | 'relatedFarmId' | 'lines' | 'milestone' | 'milestoneContext'>

function targets(proposal: RecordGuidanceTarget) {
  const lines = proposal.lines ?? (proposal.relatedCropId ? [{
    cropId: proposal.relatedCropId,
    farmId: proposal.relatedFarmId,
    milestoneContext: proposal.milestoneContext,
  }] : [])
  return lines.map(line => {
    const key = proposal.milestone?.key ?? line.milestoneContext?.key ?? ''
    const afterHarvest = line.milestoneContext?.afterHarvest
    const fertilizer = feedingMilestones.has(key) || (!!afterHarvest && harvestFeedingMilestones.has(key))
    const harvest = !!afterHarvest || harvestMilestones.has(key) ||
      proposal.trigger === 'harvest-window' || proposal.trigger === FROST_FORECAST_TRIGGER ||
      proposal.trigger === FROST_SEASON_TRIGGER
    return { ...line, fertilizer, harvest }
  })
}

export async function loadProposalRecordGuidance(userId: string, proposals: RecordGuidanceTarget[], now = new Date()) {
  const today = japanDateKey(now)
  const cards = proposals.map(proposal => ({
    proposal,
    crops: targets(proposal),
    soil: proposal.trigger === 'soil-ph' || proposal.trigger?.startsWith('soil-nutrient:'),
  }))
  const crops = cards.flatMap(card => card.crops)
  const fertilizerIds = [...new Set(crops.filter(crop => crop.fertilizer).map(crop => crop.cropId))]
  const harvestIds = [...new Set(crops.filter(crop => crop.harvest).map(crop => crop.cropId))]
  const farmIds = [...new Set([
    ...crops.filter(crop => crop.fertilizer).map(crop => crop.farmId),
    ...cards.filter(card => card.soil).map(card => card.proposal.relatedFarmId),
  ].filter((id): id is string => !!id))]
  const [fertilizers, pesticides, farms] = await Promise.all([
    fertilizerIds.length ? prisma.fertilizerRecord.findMany({
      where: { userId, cropId: { in: fertilizerIds } },
      select: { cropId: true, appliedAt: true },
    }) : [],
    harvestIds.length ? prisma.pesticideRecord.findMany({
      where: { userId, cropId: { in: harvestIds } },
      select: { cropId: true, appliedAt: true, daysBeforeHarvest: true },
    }) : [],
    farmIds.length ? prisma.farm.findMany({
      where: { userId, id: { in: farmIds } },
      select: { id: true, prefectureCode: true },
    }) : [],
  ])

  const latest = latestFertilizerDates(fertilizers)
  const harvestDates = harvestDatesByCrop(pesticides)
  const prefectures = new Map(farms.map(farm => [farm.id, farm.prefectureCode]))
  const guidance = new Map<string, ProposalRecordGuidance>()
  for (const card of cards) {
    const byCrop = new Map<string, CropRecordGuidance>()
    const standards = new Map<string, ReturnType<typeof fertilizerStandard>>()
    const addStandard = (farmId?: string) => {
      const standard = fertilizerStandard(farmId ? prefectures.get(farmId) : null)
      standards.set(standard.url, standard)
    }
    if (card.soil) addStandard(card.proposal.relatedFarmId)
    for (const crop of card.crops) {
      const harvestFrom = crop.harvest ? upcomingHarvestDate(harvestDates.get(crop.cropId), today) : undefined
      const entry: CropRecordGuidance = { harvestFrom }
      if (crop.fertilizer) {
        addStandard(crop.farmId)
        const last = latest.get(crop.cropId)
        const observedAt = crop.milestoneContext?.observedAt
        entry.fertilizer = {
          last,
          daysAgo: last && last <= today ? (Date.parse(today) - Date.parse(last)) / 86_400_000 : undefined,
          recorded: fertilizerRecordedForMilestone(last, observedAt),
          href: '/fertilizers/new?' + new URLSearchParams({ cropId: crop.cropId, date: today }),
        }
      }
      if (entry.fertilizer || harvestFrom) byCrop.set(crop.cropId, entry)
    }
    if (byCrop.size || standards.size) guidance.set(card.proposal.id, { byCrop, standards: [...standards.values()] })
  }
  return guidance
}
