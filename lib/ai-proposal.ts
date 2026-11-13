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
import { isFrostTrigger } from '@/lib/proposals/frost'
import { liveProposalWeather, type ProposalWeather } from '@/lib/proposals/weather'
import {
  scoreCrops, type ProposalCropLine, type ProposalMilestoneContext, type ProposalSignal, type ProposalUrgency,
} from '@/lib/proposals/scoring'
import type { MilestoneAsk } from '@/lib/proposals/milestones'
import { formatLocalYmd } from '@/lib/proposals/links'

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
  action?: { kind: 'work' | 'task' | 'sale' | 'finish' | 'pesticide'; taskType?: string; title?: string }
  lines?: ProposalCropLine[]
  milestoneContext?: ProposalMilestoneContext
  milestone?: MilestoneAsk
  signal?: ProposalSignal
}

export type ProposalOptions = { now?: Date; weather?: ProposalWeather }

function getTodayStart(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysSince(date: Date | null, today: Date): number | null {
  if (!date) return null
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
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
export async function getTodayProposals(
  userId: string,
  options: ProposalOptions = {},
): Promise<Proposal[]> {
  return (await loadProposalCandidates(userId, options)).proposals
}

export async function loadProposalCandidates(
  userId: string,
  { now = new Date(), weather = liveProposalWeather }: ProposalOptions,
  confirmations = false,
) {
  const proposals: Proposal[] = []
  const todayStart = getTodayStart(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const defaultFarm = confirmations ? null : await prisma.farm.findFirst({
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
      dueDate: confirmations ? { lt: tomorrowStart } : { lte: tomorrowStart },
    },
    include: { farm: true, crop: true },
    orderBy: confirmations ? [{ dueDate: 'asc' }, { id: 'asc' }] : { dueDate: 'asc' },
    ...(confirmations ? {} : { take: 2 }),
  })

  const taskCropIds = dueTasks
    .map((task) => task.cropId)
    .filter((id): id is string => !!id)
  const taskMilestoneRows = taskCropIds.length
    ? await prisma.cropMilestone.findMany({
        where: { cropId: { in: taskCropIds } },
        select: { cropId: true, key: true, observedAt: true },
      })
    : []
  const milestonesByCrop = new Map<string, { key: string; observedAt: Date }[]>()
  for (const row of taskMilestoneRows) {
    const list = milestonesByCrop.get(row.cropId) ?? []
    list.push({ key: row.key, observedAt: row.observedAt })
    milestonesByCrop.set(row.cropId, list)
  }

  for (const task of dueTasks) {
    const isOverdue = task.dueDate && new Date(task.dueDate) < todayStart
    const point = {
      latitude: task.farm.latitude,
      longitude: task.farm.longitude,
      farmName: task.farm.name,
    }
    const [regional, general, personal] = await Promise.all([
      confirmations ? null : buildRegionalLayer(point.latitude != null ? point : defaultPoint, now, weather),
      Promise.resolve(
        buildGeneralLayer(task.crop?.name, task.crop?.variety, {
          daysSincePlanting: daysSince(task.crop?.plantingDate ?? null, todayStart),
          milestones: task.cropId ? milestonesByCrop.get(task.cropId) : undefined,
          today: todayStart,
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
        now,
      }),
    ])
    const conclusion = isOverdue
      ? '今日中に対応するか、完了見込みを記録に残しましょう。'
      : '今日中に着手・完了を目指しましょう。'

    const due = task.dueDate ?? todayStart
    pushProposal(proposals, {
      id: `task-${task.id}`,
      type: 'task_due',
      title: isOverdue ? '期限を過ぎたタスクがあります' : '今日が期限のタスクがあります',
      layers: mergeLayers({ personal, regional, general, conclusion }),
      suggestedDate: due,
      relatedTaskId: task.id,
      relatedFarmId: task.farmId,
      relatedFarmName: task.farm.name,
      relatedCropId: task.cropId ?? undefined,
      relatedCropName: task.crop?.name,
      daysSincePlanting: daysSince(task.crop?.plantingDate ?? null, todayStart) ?? undefined,
      priority: isOverdue ? 'high' : 'medium',
      urgency: 'today',
      trigger: 'task-due',
      signal: {
        stage: 'deadline',
        deadline: formatLocalYmd(due),
        reason: isOverdue ? `登録した期限（${due.getMonth() + 1}月${due.getDate()}日）を過ぎています。` : '登録した期限は今日です。',
      },
      action: { kind: 'work', title: task.title },
    })
  }

  // --- 2. 栽培中の全作物を採点 ---
  const dismissed = await listActiveDismissals(userId, now)
  const { cards: scored, crops } = await scoreCrops(userId, todayStart, dismissed, { now, weather, confirmations })
  for (const card of scored) {
    pushProposal(proposals, {
      id: card.id,
      type: card.trigger === 'weather-pull-forward' || isFrostTrigger(card.trigger) ? 'weather' : 'schedule',
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
      signal: card.signal,
      action: card.action,
      lines: card.lines,
      milestone: card.milestone,
      milestoneContext: card.milestoneContext,
    })
  }

  const lastYear = await getLastYearSameDayWorkSummary(userId, { now })
  if (lastYear.summaryLine && !proposals.some((item) => item.layers.personal?.includes('昨年同日'))) {
    pushProposal(proposals, {
      id: 'last-year-same-day',
      type: 'schedule',
      title: '昨年同日の作業があります',
      layers: mergeLayers({
        personal: lastYear.summaryLine,
        regional: confirmations ? null : await buildRegionalLayer(defaultPoint, now, weather),
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
  return { proposals: visible, crops }
}

export type { ProposalLayers } from '@/lib/ai-proposal-context'
