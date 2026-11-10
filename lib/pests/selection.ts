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

export function selectPestQuestion(
  crop: Target, today: string, checks: Check[], history: History[], deferred: ReadonlySet<string>,
) {
  const kind = cropKindByKey(crop.cropKind)
  if (!kind || kind.recordOnly || checks.some(check => dayGap(today, check.answeredDay) < 7)) return null

  const [year, month] = today.split('-').map(Number)
  const candidates = pests.filter(pest => pest.cropKind === kind.key).flatMap(pest => {
    const latest = checks.filter(check => check.pestKey === pest.key)
      .sort((a, b) => b.answeredDay.localeCompare(a.answeredDay))[0]
    if (deferred.has(pest.key) || (latest && dayGap(today, latest.answeredDay) < (latest.present ? 14 : 28))) return []

    const previous = history.filter(check => check.pestKey === pest.key && Number(check.observedDay.slice(0, 4)) === year - 1)
      .map(check => {
        const [, m, d] = check.observedDay.split('-').map(Number)
        const anniversary = new Date(Date.UTC(year, m - 1, Math.min(d, new Date(Date.UTC(year, m, 0)).getUTCDate())))
        return { ...check, gap: Math.abs(dayGap(today, anniversary.toISOString().slice(0, 10))) }
      })
      .filter(check => check.gap <= 14)
      .sort((a, b) => Number(!!crop.farmId && b.farmId === crop.farmId) -
        Number(!!crop.farmId && a.farmId === crop.farmId) || a.gap - b.gap)[0]
    const season: PestSeason | undefined = pest.seasons.find(item =>
      item.code === crop.prefectureCode && item.months.includes(month) && (!item.site || item.site === crop.growingSite))
    if (!previous && !season && (!crop.plantingDay || dayGap(today, crop.plantingDay) <= 7)) return []

    return [{
      pest, previous, season, latest,
      rank: previous ? (crop.farmId && previous.farmId === crop.farmId ? 0 : 1) : season ? 2 : 3,
    }]
  })
  return candidates.sort((a, b) => a.rank - b.rank ||
    Number(!!b.latest?.present) - Number(!!a.latest?.present) ||
    (a.latest?.answeredDay ?? '').localeCompare(b.latest?.answeredDay ?? ''))[0] ?? null
}
