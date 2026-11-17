import { prisma } from '@/lib/prisma'
import { harvestDatesByCrop, japanDateKey, pesticideCounts, pesticideUsage, pesticideSafetySelect } from '@/lib/pesticide-safety'
import { forecastOffice } from '@/lib/pest-forecast'
import { findPest, pestGuide, isPestTrigger } from '@/lib/pests/catalog'
import { listActiveDismissals } from '@/lib/proposals/dismissal'
import { pestHistoryRange, selectPestQuestion } from '@/lib/pests/selection'
import { pestMeasuresForSite } from '@/lib/pests/presentation'

const owner = (userId: string) => ({ OR: [{ userId }, { farm: { userId } }] })
const cropFields = {
  id: true, name: true, cropKind: true, farmId: true, growingSite: true, status: true,
  farm: { select: { name: true, prefectureCode: true } },
} as const

export function ownedPestCrop(userId: string, id: string) {
  return prisma.crop.findFirst({ where: { id, ...owner(userId) }, select: cropFields })
}

export async function loadPestQuestions(userId: string, now = new Date()) {
  const today = japanDateKey(now)
  const { first, last } = pestHistoryRange(today)
  const since = new Date(`${first}T00:00:00+09:00`)
  const until = new Date(`${last}T23:59:59.999+09:00`)
  const [crops, history, dismissed] = await Promise.all([
    prisma.crop.findMany({
      where: { ...owner(userId), status: 'growing' },
      select: {
        ...cropFields, plantingDate: true,
        pestChecks: { where: { createdAt: { gte: new Date(+now - 29 * 86_400_000) } }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.pestCheck.findMany({
      where: { present: true, observedAt: { gte: since, lte: until }, crop: owner(userId) },
      select: { pestKey: true, observedAt: true, crop: { select: { farmId: true, cropKind: true } } },
    }),
    listActiveDismissals(userId, now),
  ])
  return crops.flatMap(crop => {
    const question = selectPestQuestion(
      { ...crop, prefectureCode: crop.farm?.prefectureCode, plantingDay: crop.plantingDate && japanDateKey(crop.plantingDate) },
      today,
      crop.pestChecks.map(check => ({ ...check, observedDay: japanDateKey(check.observedAt), answeredDay: japanDateKey(check.createdAt) })),
      history.filter(check => check.crop.cropKind === crop.cropKind).map(check => ({
        pestKey: check.pestKey, observedDay: japanDateKey(check.observedAt), farmId: check.crop.farmId,
      })),
      new Set(dismissed.filter(row => row.cropId === crop.id && isPestTrigger(row.trigger)).map(row => row.trigger.slice(5))),
    )
    if (!question) return []
    const timing = question.previous
      ? previousPestTiming(question.previous.observedDay, today)
      : question.season
        ? `${question.season.source.publisher}の資料では、${question.season.label}とされています。`
        : null
    return [{
      cropId: crop.id, cropName: crop.name, farmName: crop.farm?.name,
      pest: question.pest, timing, timingSource: question.previous ? undefined : question.season?.source.url, today,
    }]
  })
}

function previousPestTiming(observedDay: string, today: string): string {
  const [year, month, day] = observedDay.split('-').map(Number)
  const prefix = year === Number(today.slice(0, 4)) - 1 ? '去年は' : `${year}年`
  return `${prefix}${month}月${day}日に「いた」と記録しています。`
}

export async function loadPestAdvice(userId: string, crop: NonNullable<Awaited<ReturnType<typeof ownedPestCrop>>>, key: string) {
  const pest = findPest(key)
  if (!pest) return null
  const code = crop.farm?.prefectureCode
  const rank = (scope: string, pref?: string) => scope === 'national' ? 0 : scope === 'general' ? 1 : pref === code ? 2 : 3
  const { matching, emptyMessage } = pestMeasuresForSite(pest.measures, crop.growingSite)
  const measures = matching.sort((a, b) => rank(a.scope, a.code) - rank(b.scope, b.code)).slice(0, 3)
  const records = await prisma.pesticideRecord.findMany({
    where: { userId, cropId: crop.id }, select: pesticideSafetySelect,
    orderBy: [{ appliedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  })
  const count = pesticideCounts(records)
  const latest = [...new Map([...records].reverse().map(record => [record.productName.trim(), record])).values()]
  return {
    measures, emptyMessage, searchCrop: pest.searchCrop, searchPest: pest.searchPest,
    guide: pestGuide(code), forecast: forecastOffice(code),
    harvestFrom: harvestDatesByCrop(records).get(crop.id),
    usages: latest.map(record => ({
      ...pesticideUsage(count(record.id), record.applicationCount ?? 0, record.applicationLimit),
      id: record.id, day: japanDateKey(record.appliedAt),
    })),
    recordHref: '/pesticides/new?' + new URLSearchParams({ cropId: crop.id, ...(crop.farmId ? { farmId: crop.farmId } : {}) }),
  }
}
