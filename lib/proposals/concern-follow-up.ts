import { firstFollowUpDay, lastFollowUpDay, concernChoiceLabels, concernLocations, concernMonthDay, concernSymptoms } from '@/lib/crops/field-concerns'
import { japanDateKey } from '@/lib/pesticide-safety'
import { prisma } from '@/lib/prisma'

// 台帳 I27。日付の境界は日本時間。
export function concernFollowUpWindow(now: Date) {
  const today = new Date(japanDateKey(now) + 'T00:00:00+09:00')
  const daysAgo = (days: number) => new Date(+today - days * 86_400_000)
  return { gte: daysAgo(lastFollowUpDay), lt: daysAgo(firstFollowUpDay - 1) }
}

export async function loadConcernFollowUps(userId: string, now: Date) {
  const rows = await prisma.fieldConcern.findMany({
    where: {
      observedAt: concernFollowUpWindow(now),
      followUpResult: null,
      crop: { status: 'growing', OR: [{ userId }, { farm: { userId } }] },
    },
    select: { id: true, cropId: true, observedAt: true, locations: true, symptoms: true },
  })
  return rows.map(row => {
    const observedDay = japanDateKey(row.observedAt)
    const labels = [
      ...concernChoiceLabels(concernLocations, row.locations),
      ...concernChoiceLabels(concernSymptoms, row.symptoms),
    ]
    const summary = labels.length ? '（' + labels.slice(0, 3).join('・') + (labels.length > 3 ? ' ほか）' : '）') : '気になること'
    return {
      id: row.id, cropId: row.cropId, observedDay,
      title: `${concernMonthDay(observedDay)}に記録した${summary}は、広がっていますか？`,
    }
  })
}
