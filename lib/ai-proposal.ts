import { prisma } from '@/lib/prisma'

export type ProposalType = 'task_due' | 'schedule' | 'weather'

export type Proposal = {
  id: string
  type: ProposalType
  title: string
  description: string
  relatedTaskId?: string
  relatedCropId?: string
  relatedFarmName?: string
  priority: 'high' | 'medium' | 'low'
}

const MAX_PROPOSALS = 3

/** 今日の日付（0時0分） */
function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** 明日の日付（0時0分） */
function getTomorrowStart(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 植え付け日から経過日数を返す */
function daysSince(date: Date | null): number | null {
  if (!date) return null
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const today = getTodayStart()
  const diff = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return diff >= 0 ? diff : null
}

/**
 * 気象・GDD・タスク・栽培スケジュールを組み合わせた
 * ルールベースの「今日の提案」を1〜3件生成する
 */
export async function getTodayProposals(userId: string): Promise<Proposal[]> {
  const proposals: Proposal[] = []
  const todayStart = getTodayStart()
  const tomorrowStart = getTomorrowStart()

  // --- 1. タスク: 期限が今日 or 過ぎている未完了タスク（最大2件）---
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
    proposals.push({
      id: `task-${task.id}`,
      type: 'task_due',
      title: isOverdue ? '期限を過ぎたタスクがあります' : '今日が期限のタスクがあります',
      description: task.crop?.name
        ? `「${task.title}」（${task.farm.name} / ${task.crop.name}）`
        : `「${task.title}」（${task.farm.name}）`,
      relatedTaskId: task.id,
      relatedFarmName: task.farm.name,
      priority: isOverdue ? 'high' : 'medium',
    })
  }

  // --- 2. 栽培スケジュール: 植え付け日からの経過日数に基づく提案（最大1件）---
  if (proposals.length < MAX_PROPOSALS) {
    const growingCrops = await prisma.crop.findMany({
      where: {
        farm: { userId },
        status: 'growing',
        plantingDate: { not: null },
      },
      include: { farm: true },
    })

    for (const crop of growingCrops) {
      const days = daysSince(crop.plantingDate)
      if (days === null) continue

      let scheduleTitle: string | null = null
      let scheduleDesc: string | null = null

      if (days >= 5 && days <= 9) {
        scheduleTitle = '活着確認のタイミングです'
        scheduleDesc = `${crop.name}（${crop.farm.name}）は植え付けから${days}日目。株の状態を確認しましょう。`
      } else if (days >= 12 && days <= 18) {
        scheduleTitle = '初回追肥のタイミングです'
        scheduleDesc = `${crop.name}（${crop.farm.name}）は植え付けから${days}日目。追肥の計画を確認しましょう。`
      } else if (days >= 25 && days <= 35) {
        scheduleTitle = '防除・管理作業のタイミングです'
        scheduleDesc = `${crop.name}（${crop.farm.name}）は植え付けから${days}日目。病害防除や誘引などを検討しましょう。`
      }

      if (scheduleTitle && scheduleDesc && proposals.length < MAX_PROPOSALS) {
        proposals.push({
          id: `schedule-${crop.id}-${days}`,
          type: 'schedule',
          title: scheduleTitle,
          description: scheduleDesc,
          relatedCropId: crop.id,
          relatedFarmName: crop.farm.name,
          priority: 'medium',
        })
        break // 1件だけ採用
      }
    }
  }

  // --- 3. 気象: 明日の降水・悪天候を考慮した提案（最大1件、モック可）---
  if (proposals.length < MAX_PROPOSALS) {
    const farmsWithCoords = await prisma.farm.findFirst({
      where: { userId, latitude: { not: null }, longitude: { not: null } },
    })

    let weatherSuggestion: string | null = null
    if (farmsWithCoords?.latitude != null && farmsWithCoords?.longitude != null) {
      const tomorrowWeather = await prisma.weatherData.findUnique({
        where: {
          date_latitude_longitude: {
            date: tomorrowStart,
            latitude: farmsWithCoords.latitude,
            longitude: farmsWithCoords.longitude,
          },
        },
      })
      if (tomorrowWeather && (tomorrowWeather.precipitation ?? 0) > 5) {
        weatherSuggestion = '明日は降水予報のため、屋外作業は今日のうちに済ませると安心です。'
      }
    }
    if (!weatherSuggestion) {
      // モック: 気象データがなくても「今週の作業を前倒し」の一言提案
      weatherSuggestion = '今週の天候を確認し、雨の前にできる作業を優先すると効率的です。'
    }

    proposals.push({
      id: 'weather-today',
      type: 'weather',
      title: '気象を踏まえた作業のタイミング',
      description: weatherSuggestion,
      priority: proposals.length === 0 ? 'high' : 'low',
    })
  }

  return proposals.slice(0, MAX_PROPOSALS)
}
