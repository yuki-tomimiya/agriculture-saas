import { prisma } from '@/lib/prisma'
import { getForecastDailyTemps } from '@/lib/weather-forecast'
import { computeGDDProjection, getTargetGDDForCrop } from '@/lib/gdd'
import {
  buildGeneralLayer,
  buildPersonalLayerForCrop,
  buildPersonalLayerForTask,
  buildRegionalLayer,
  layersToDescription,
  mergeLayers,
  type ProposalLayers,
} from '@/lib/ai-proposal-context'

export type ProposalType = 'task_due' | 'schedule' | 'weather'

export type Proposal = {
  id: string
  type: ProposalType
  title: string
  /** 後方互換：結論テキスト */
  description: string
  layers: ProposalLayers
  suggestedDate?: Date
  relatedTaskId?: string
  relatedCropId?: string
  relatedFarmName?: string
  priority: 'high' | 'medium' | 'low'
}

const MAX_PROPOSALS = 3

function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function getTomorrowStart(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysSince(date: Date | null): number | null {
  if (!date) return null
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const today = getTodayStart()
  const diff = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return diff >= 0 ? diff : null
}

function pushProposal(
  proposals: Proposal[],
  item: Omit<Proposal, 'description'> & { description?: string }
) {
  proposals.push({
    ...item,
    description: item.description ?? layersToDescription(item.layers),
  })
}

/**
 * 3層（あなた / 地域 / 一般）→ 結論 のルールベース「今日の提案」
 */
export async function getTodayProposals(userId: string): Promise<Proposal[]> {
  const proposals: Proposal[] = []
  const todayStart = getTodayStart()
  const tomorrowStart = getTomorrowStart()

  const defaultFarm = await prisma.farm.findFirst({
    where: { userId, latitude: { not: null }, longitude: { not: null } },
  })
  const defaultPoint = defaultFarm
    ? {
        latitude: defaultFarm.latitude,
        longitude: defaultFarm.longitude,
        farmName: defaultFarm.name,
      }
    : undefined

  // --- 1. タスク期限 ---
  const dueTasks = await prisma.task.findMany({
    where: {
      farm: { userId },
      status: { in: ['pending', 'in_progress'] },
      dueDate: { lte: tomorrowStart },
    },
    include: { farm: true, crop: true },
    orderBy: { dueDate: 'asc' },
    take: 2,
  })

  for (const task of dueTasks) {
    const isOverdue = task.dueDate && new Date(task.dueDate) < todayStart
    const point = {
      latitude: task.farm.latitude,
      longitude: task.farm.longitude,
      farmName: task.farm.name,
    }
    const [regional, general] = await Promise.all([
      buildRegionalLayer(point.latitude != null ? point : defaultPoint),
      Promise.resolve(buildGeneralLayer(task.crop?.name, task.crop?.variety)),
    ])
    const personal = buildPersonalLayerForTask({
      title: task.title,
      farmName: task.farm.name,
      cropName: task.crop?.name,
      isOverdue: !!isOverdue,
    })
    const conclusion = isOverdue
      ? '今日中に対応するか、完了見込みを記録に残しましょう。'
      : '今日中に着手・完了を目指しましょう。'

    pushProposal(proposals, {
      id: `task-${task.id}`,
      type: 'task_due',
      title: isOverdue ? '期限を過ぎたタスクがあります' : '今日が期限のタスクがあります',
      layers: mergeLayers({ personal, regional, general, conclusion }),
      suggestedDate: task.dueDate ?? todayStart,
      relatedTaskId: task.id,
      relatedFarmName: task.farm.name,
      relatedCropId: task.cropId ?? undefined,
      priority: isOverdue ? 'high' : 'medium',
    })
  }

  // --- 2. 栽培中作物のスケジュール提案 ---
  if (proposals.length < MAX_PROPOSALS) {
    const growingCrops = await prisma.crop.findMany({
      where: {
        OR: [{ userId }, { farm: { userId } }],
        status: 'growing',
        plantingDate: { not: null },
      },
      include: { farm: true },
      orderBy: { plantingDate: 'desc' },
    })

    for (const crop of growingCrops) {
      if (proposals.length >= MAX_PROPOSALS) break
      const days = daysSince(crop.plantingDate)
      if (days === null) continue
      const farmName = crop.farm?.name ?? '農場未設定'
      const point = crop.farm
        ? {
            latitude: crop.farm.latitude,
            longitude: crop.farm.longitude,
            farmName: crop.farm.name,
          }
        : defaultPoint

      let scheduleTitle: string | null = null
      let conclusion: string | null = null

      if (days >= 5 && days <= 9) {
        scheduleTitle = '活着確認のタイミングです'
        conclusion = '株の状態を確認し、問題があれば作業記録に残しましょう。'
      } else if (days >= 12 && days <= 18) {
        scheduleTitle = '初回追肥のタイミングです'
        conclusion = '追肥の計画を確認し、天候の良い日に実施を検討しましょう。'
      } else if (days >= 25 && days <= 35) {
        scheduleTitle = '防除・管理作業のタイミングです'
        conclusion = '病害防除や誘引など、優先度の高い作業から進めましょう。'
      }

      if (!scheduleTitle || !conclusion) continue

      const [personal, regional, general] = await Promise.all([
        buildPersonalLayerForCrop({
          userId,
          cropId: crop.id,
          cropName: crop.name,
          variety: crop.variety,
          farmId: crop.farmId,
          plantingDate: crop.plantingDate,
          farmName,
        }),
        buildRegionalLayer(point),
        Promise.resolve(buildGeneralLayer(crop.name, crop.variety)),
      ])

      pushProposal(proposals, {
        id: `schedule-${crop.id}-${days}`,
        type: 'schedule',
        title: scheduleTitle,
        layers: mergeLayers({ personal, regional, general, conclusion }),
        suggestedDate: todayStart,
        relatedCropId: crop.id,
        relatedFarmName: farmName,
        priority: 'medium',
      })
      break
    }

    // GDD 収穫適期
    if (proposals.length < MAX_PROPOSALS && growingCrops.length > 0) {
      const mainCrop = growingCrops[0]
      const days = daysSince(mainCrop.plantingDate)
      if (days !== null && days > 0 && mainCrop.farm) {
        const mainFarmName = mainCrop.farm.name
        const lat = mainCrop.farm.latitude ?? undefined
        const lon = mainCrop.farm.longitude ?? undefined
        const forecastTemps = await getForecastDailyTemps(todayStart, {
          latitude: lat,
          longitude: lon,
        })
        const baseTemp = mainCrop.baseTemperature ?? 10
        const targetGDD = getTargetGDDForCrop(mainCrop.name, mainCrop.variety)
        const approxDailyGDD = 5
        const currentGDD = days * approxDailyGDD
        const projection = computeGDDProjection(currentGDD, baseTemp, forecastTemps, targetGDD)

        if (
          projection.targetReachDate &&
          projection.daysToTarget !== null &&
          projection.daysToTarget <= 10
        ) {
          const dateStr = projection.targetReachDate.toLocaleDateString('ja-JP', {
            month: 'long',
            day: 'numeric',
          })
          const isSoon = projection.daysToTarget <= 5

          const [personal, regional, general] = await Promise.all([
            buildPersonalLayerForCrop({
              userId,
              cropId: mainCrop.id,
              cropName: mainCrop.name,
              variety: mainCrop.variety,
              farmId: mainCrop.farmId,
              plantingDate: mainCrop.plantingDate,
              farmName: mainFarmName,
            }),
            buildRegionalLayer({
              latitude: mainCrop.farm.latitude,
              longitude: mainCrop.farm.longitude,
              farmName: mainFarmName,
            }),
            Promise.resolve(buildGeneralLayer(mainCrop.name, mainCrop.variety)),
          ])

          const gddPersonal =
            personal ??
            `${mainCrop.name}は積算温度の予測では ${dateStr} 頃に目標に近づく見込みです（現在おおよそ ${currentGDD}℃日）。`

          pushProposal(proposals, {
            id: `gdd-${mainCrop.id}-${projection.targetReachDate.toISOString()}`,
            type: 'schedule',
            title: 'GDD予測：収穫適期が近づいています',
            layers: mergeLayers({
              personal: gddPersonal,
              regional,
              general,
              conclusion:
                '収穫・出荷準備やパートさんのシフト調整を前倒しで検討しましょう。',
            }),
            suggestedDate: projection.targetReachDate,
            relatedCropId: mainCrop.id,
            relatedFarmName: mainFarmName,
            priority: isSoon ? 'high' : 'medium',
          })
        }
      }
    }
  }

  // --- 3. 気象ベースの提案 ---
  if (proposals.length < MAX_PROPOSALS) {
    const regional = await buildRegionalLayer(defaultPoint)
    const general = buildGeneralLayer(null)
    let conclusion = '今週の天候を確認し、雨や強風の前にできる作業を優先すると効率的です。'

    if (regional?.includes('降水') || regional?.includes('雨')) {
      conclusion = '晴れ間を活かして、屋外作業を前倒しで進めましょう。'
    } else if (regional?.includes('風速')) {
      conclusion = '風が強くなる前に、資材の固定と圃場の点検を済ませましょう。'
    }

    pushProposal(proposals, {
      id: 'weather-today',
      type: 'weather',
      title: '気象を踏まえた作業のタイミング',
      layers: mergeLayers({
        personal: '直近の作業記録が少ない場合も、天候に合わせた優先順位づけが有効です。',
        regional,
        general,
        conclusion,
      }),
      suggestedDate: tomorrowStart,
      priority: proposals.length === 0 ? 'high' : 'low',
    })
  }

  return proposals.slice(0, MAX_PROPOSALS)
}

export type { ProposalLayers } from '@/lib/ai-proposal-context'
