import { pests, type PestSeason } from '@/lib/pests/catalog'
import { cropKindByKey } from '@/lib/crops/conditions'

export type Check = { pestKey: string; observedDay: string; answeredDay: string; present: boolean }
type History = Pick<Check, 'pestKey' | 'observedDay'> & { farmId: string | null }
type Target = {
  cropKind: string | null
  farmId: string | null
  prefectureCode?: string | null
  growingSite: string | null
  plantingDay: string | null
}
const dayGap = (later: string, earlier: string) => (Date.parse(later) - Date.parse(earlier)) / 86_400_000
const previousYearWindowDays = 14

function previousYearDay(today: string): string {
  const [year, month, day] = today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate()
  return new Date(Date.UTC(year - 1, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function pestHistoryRange(today: string): { first: string; last: string } {
  const day = new Date(previousYearDay(today))
  const year = day.getUTCFullYear()
  const first = new Date(+day)
  first.setUTCDate(day.getUTCDate() - previousYearWindowDays)
  const last = new Date(+day)
  last.setUTCDate(day.getUTCDate() + previousYearWindowDays)
  return {
    first: [`${year}-01-01`, first.toISOString().slice(0, 10)].sort()[0],
    last: [`${year}-12-31`, last.toISOString().slice(0, 10)].sort()[1],
  }
}

export function selectPestQuestion(
  crop: Target, today: string, checks: Check[], history: History[], deferred: ReadonlySet<string>,
) {
  const kind = cropKindByKey(crop.cropKind)
  if (!kind || kind.recordOnly || checks.some(check => dayGap(today, check.answeredDay) < 7)) return null

  const [year, month] = today.split('-').map(Number)
  const anniversary = previousYearDay(today)
  const candidates = pests.filter(pest => pest.cropKind === kind.key).flatMap(pest => {
    const latest = checks.filter(check => check.pestKey === pest.key)
      .sort((a, b) => b.answeredDay.localeCompare(a.answeredDay))[0]
    if (deferred.has(pest.key) || (latest && dayGap(today, latest.answeredDay) < (latest.present ? 14 : 28))) return []

    const pastChecks = history.filter(check => check.pestKey === pest.key)
    const previous = pastChecks
      .map(check => ({ ...check, gap: Math.abs(dayGap(check.observedDay, anniversary)) }))
      .filter(check => check.gap <= previousYearWindowDays)
      .sort((a, b) => Number(!!crop.farmId && b.farmId === crop.farmId) -
        Number(!!crop.farmId && a.farmId === crop.farmId) || a.gap - b.gap)[0]
    if (!previous && pastChecks.some(check => Number(check.observedDay.slice(0, 4)) === year - 1)) return []

    const localSeasons = pest.seasons.filter(item =>
      item.code === crop.prefectureCode && (!item.site || item.site === crop.growingSite))
    const season: PestSeason | undefined = previous ? undefined : localSeasons.find(item => item.months.includes(month))
    if (!previous && !season &&
      (localSeasons.length || !crop.plantingDay || dayGap(today, crop.plantingDay) <= 7)) return []

    return [{
      pest, previous, season, latest,
      rank: previous ? (crop.farmId && previous.farmId === crop.farmId ? 0 : 1) : season ? 2 : 3,
    }]
  })
  return candidates.sort((a, b) => a.rank - b.rank ||
    Number(!!b.latest?.present) - Number(!!a.latest?.present) ||
    (a.latest?.answeredDay ?? '').localeCompare(b.latest?.answeredDay ?? ''))[0] ?? null
}
