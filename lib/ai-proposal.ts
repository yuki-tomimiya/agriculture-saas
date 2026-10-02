import { prisma } from '@/lib/prisma'
import {
  buildGeneralLayer,
  buildPersonalLayerForTask,
  buildRegionalLayer,
  getLastYearSameDayWorkSummary,
  layersToDescription,
  mergeLayers,
  type ProposalLayers,
} from '@/lib/ai-proposal-context'
import { isProposalDismissed, listActiveDismissals } from '@/lib/proposals/dismissal'
import { scoreGrowingCrops, type ProposalCropLine, type ProposalUrgency } from '@/lib/proposals/scoring'

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
  relatedCropName?: string
  relatedFarmId?: string
  relatedFarmName?: string
  daysSincePlanting?: number
  priority: 'high' | 'medium' | 'low'
  urgency: ProposalUrgency
  /** 採点のきっかけ。作物のない提案の「今はしない」に使う */
  trigger?: string
  action?: { kind: 'work' | 'task' | 'sale' | 'finish'; taskType?: string; title?: string }
  lines?: ProposalCropLine[]
}

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
    const [regional, general, personal] = await Promise.all([
      buildRegionalLayer(point.latitude != null ? point : defaultPoint),
      Promise.resolve(
        buildGeneralLayer(task.crop?.name, task.crop?.variety, {
          daysSincePlanting: daysSince(task.crop?.plantingDate ?? null),
        })
      ),
      buildPersonalLayerForTask({
        userId,
        title: task.title,
        farmName: task.farm.name,
        farmId: task.farmId,
        cropName: task.crop?.name,
        cropId: task.cropId,
        isOverdue: !!isOverdue,
      }),
    ])
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
      relatedFarmId: task.farmId,
      relatedFarmName: task.farm.name,
      relatedCropId: task.cropId ?? undefined,
      relatedCropName: task.crop?.name,
      daysSincePlanting: daysSince(task.crop?.plantingDate ?? null) ?? undefined,
      priority: isOverdue ? 'high' : 'medium',
      urgency: 'today',
      trigger: 'task-due',
      action: { kind: 'work', title: task.title },
    })
  }

  // --- 2. 栽培中の全作物を採点 ---
  const dismissed = await listActiveDismissals(userId)
  const scored = await scoreGrowingCrops(userId, todayStart, dismissed)
  for (const card of scored) {
    pushProposal(proposals, {
      id: card.id,
      type: card.trigger === 'weather-pull-forward' ? 'weather' : 'schedule',
      title: card.title,
      layers: card.layers,
      suggestedDate: todayStart,
      relatedCropId: card.cropId,
      relatedCropName: card.cropName,
      relatedFarmId: card.farmId,
      relatedFarmName: card.farmName,
      daysSincePlanting: card.daysSincePlanting,
      priority: card.urgency === 'today' ? 'high' : card.urgency === 'thisWeek' ? 'medium' : 'low',
      urgency: card.urgency,
      trigger: card.trigger,
      action: card.action,
      lines: card.lines,
    })
  }

  const lastYear = await getLastYearSameDayWorkSummary(userId)
  if (lastYear.summaryLine && !proposals.some((item) => item.layers.personal?.includes('昨年同日'))) {
    pushProposal(proposals, {
      id: 'last-year-same-day',
      type: 'schedule',
      title: '昨年同日の作業があります',
      layers: mergeLayers({
        personal: lastYear.summaryLine,
        regional: await buildRegionalLayer(defaultPoint),
        general: null,
        conclusion: 'カレンダーの昨年表示と照らし、今年も同じ作業が必要か判断しましょう。',
      }),
      suggestedDate: todayStart,
      relatedFarmId: defaultFarm?.id,
      relatedFarmName: defaultFarm?.name,
      priority: 'low',
      urgency: 'thisWeek',
      trigger: 'last-year-same-day',
      action: { kind: 'work', title: '昨年同日の作業を確認' },
    })
  }

  const visible = proposals.filter(
    (item) => !isProposalDismissed(dismissed, item.trigger, item.relatedCropId)
  )

  const rank = { today: 3, thisWeek: 2, watch: 1 }
  visible.sort((a, b) => rank[b.urgency] - rank[a.urgency])
  return visible
}

export type { ProposalLayers } from '@/lib/ai-proposal-context'
