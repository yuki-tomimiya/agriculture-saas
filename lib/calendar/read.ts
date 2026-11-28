import { formatHarvestGddOutlook } from '@/lib/gdd'
import { prisma } from '@/lib/prisma'
import { japanDateKey, harvestDatesByCrop } from '@/lib/pesticide-safety'
import { getCropWhere } from '@/lib/queries'
import { hasWeatherCoordinates, getForecastDays, getAccumulatedGDDFromApi } from '@/lib/weather-forecast'
import { loadLocationArchive } from '@/lib/weather-normals'
import { readFarmAutumnFrost, readFarmSpringFrost, autumnFirstFrostSentence, springFrostSentence, stationDistanceLabel } from '@/lib/jma/frost-record'
import { formatHarvestWindow, forecastAvgByYmd, projectHarvestWindow, ymdKey } from '@/lib/insights/harvest-date-window'
import { pickHarvestBasis, loadHarvestSamples } from '@/lib/insights/harvest-gdd-basis'
import { gddStartDate } from '@/lib/benchmarks/gdd-methods'
import { concernChoiceLabels, concernLocations, concernSymptoms } from '@/lib/crops/field-concerns'
import { FROST_ARCHIVE_YEARS } from '@/lib/weather-frost'
import { findPest } from '@/lib/pests/catalog'
import { milestoneTerm } from '@/lib/proposals/milestones'
import { offsetDay } from './dates'
import type { CalendarRecord, CropOutlook, FarmOutlook, RecordEntry } from './outlook'

export async function calendarRecords(userId: string, first: string, last: string): Promise<CalendarRecord[]> {
  const dates = { gte: new Date(first + 'T00:00:00+09:00'), lt: new Date(offsetDay(last, 1) + 'T00:00:00+09:00') }
  const [work, fertilizer] = await Promise.all([
    prisma.workRecord.findMany({ where: { farm: { userId }, date: dates }, select: {
      id: true, date: true, taskType: true, farmId: true, farm: { select: { name: true } }, crop: { select: { name: true } },
    }, orderBy: { date: 'asc' } }),
    prisma.fertilizerRecord.findMany({ where: { userId, appliedAt: dates }, select: {
      id: true, appliedAt: true, productName: true, farmId: true, farm: { select: { name: true } }, crop: { select: { name: true, farmId: true, farm: { select: { name: true } } } },
    }, orderBy: { appliedAt: 'asc' } }),
  ])
  return [
    ...work.map(r => ({ id: 'work-' + r.id, farmId: r.farmId, farmName: r.farm.name, cropName: r.crop?.name, date: japanDateKey(r.date), label: r.taskType + (r.crop ? '（' + r.crop.name + '）' : '') })),
    ...fertilizer.map(r => ({ id: 'fertilizer-' + r.id, farmId: r.farmId ?? r.crop?.farmId ?? null, farmName: r.farm?.name ?? r.crop?.farm?.name, cropName: r.crop?.name, date: japanDateKey(r.appliedAt), label: '施肥：' + r.productName })),
  ]
}

const cropSubject = { select: { id: true, name: true, farmId: true, farm: { select: { name: true } } } } as const
type CropSubject = { id: string; name: string; farmId: string | null; farm: { name: string } | null } | null
const subjectOf = (crop: CropSubject, farm?: { id: string | null; name?: string | null }) => ({
  farmId: farm?.id ?? crop?.farmId ?? null, farmName: farm?.name ?? crop?.farm?.name ?? undefined,
  cropName: crop?.name, cropId: crop?.id ?? null,
})
const withCrop = (text: string, crop: CropSubject) => text + (crop ? '（' + crop.name + '）' : '')

/** カレンダーに点で出す自分の記録（109）。作業・施肥／農薬・収穫／畑で見たこと（気になること・病害虫を見かけた・節目） */
export async function calendarEntries(userId: string, first: string, last: string): Promise<RecordEntry[]> {
  const dates = { gte: new Date(first + 'T00:00:00+09:00'), lt: new Date(offsetDay(last, 1) + 'T00:00:00+09:00') }
  const crop = getCropWhere(userId).where
  const [work, fertilizer, pesticide, harvest, concern, pest, milestone] = await Promise.all([
    prisma.workRecord.findMany({ where: { farm: { userId }, date: dates }, select: {
      id: true, date: true, taskType: true, farmId: true, farm: { select: { name: true } }, crop: cropSubject } }),
    prisma.fertilizerRecord.findMany({ where: { userId, appliedAt: dates }, select: {
      id: true, appliedAt: true, productName: true, farmId: true, farm: { select: { name: true } }, crop: cropSubject } }),
    prisma.pesticideRecord.findMany({ where: { userId, appliedAt: dates }, select: {
      id: true, appliedAt: true, productName: true, farmId: true, farm: { select: { name: true } }, crop: cropSubject } }),
    prisma.harvest.findMany({ where: { crop, date: dates }, select: { id: true, date: true, crop: cropSubject } }),
    prisma.fieldConcern.findMany({ where: { crop, observedAt: dates }, select: { id: true, observedAt: true, locations: true, symptoms: true, crop: cropSubject } }),
    prisma.pestCheck.findMany({ where: { crop, present: true, observedAt: dates }, select: { id: true, observedAt: true, pestKey: true, crop: cropSubject } }),
    prisma.cropMilestone.findMany({ where: { crop, observedAt: dates }, select: { id: true, observedAt: true, key: true, crop: cropSubject } }),
  ])
  const farmOf = (r: { farmId: string | null; farm: { name: string } | null }) => r.farmId ? { id: r.farmId, name: r.farm?.name } : undefined
  const entries: RecordEntry[] = [
    ...work.map(r => ({ ...subjectOf(r.crop, { id: r.farmId, name: r.farm.name }), id: 'work-' + r.id, date: japanDateKey(r.date), kind: 'work' as const,
      title: withCrop(r.taskType, r.crop), term: r.taskType, note: '作業の記録', href: '/work-records/' + r.id })),
    ...fertilizer.map(r => ({ ...subjectOf(r.crop, farmOf(r)), id: 'fertilizer-' + r.id, date: japanDateKey(r.appliedAt), kind: 'work' as const,
      title: '施肥：' + r.productName, term: '施肥', note: '施肥の記録', href: '/fertilizers/' + r.id })),
    ...pesticide.map(r => ({ ...subjectOf(r.crop, farmOf(r)), id: 'pesticide-' + r.id, date: japanDateKey(r.appliedAt), kind: 'spray' as const,
      title: '農薬：' + r.productName, term: '農薬', note: '農薬の記録', href: '/pesticides/' + r.id })),
    ...harvest.map(r => ({ ...subjectOf(r.crop), id: 'harvest-' + r.id, date: japanDateKey(r.date), kind: 'spray' as const,
      title: withCrop('収穫', r.crop), term: '収穫', note: '収穫の記録', href: '/harvests/' + r.id })),
    ...concern.map(r => {
      const words = [...concernChoiceLabels(concernLocations, r.locations), ...concernChoiceLabels(concernSymptoms, r.symptoms)]
      const title = '気になること' + (words.length ? '（' + words.join('・') + '）' : '')
      return { ...subjectOf(r.crop), id: 'field-' + r.id, date: japanDateKey(r.observedAt), kind: 'field' as const,
        title, term: title, note: '畑で見たことの記録', href: '/crops/' + r.crop.id }
    }),
    ...pest.map(r => {
      const name = findPest(r.pestKey)?.name ?? r.pestKey
      return { ...subjectOf(r.crop), id: 'pest-' + r.id, date: japanDateKey(r.observedAt), kind: 'field' as const,
        title: name + 'を見かけた', term: name, note: '畑で見たことの記録', href: '/crops/' + r.crop.id }
    }),
    ...milestone.map(r => {
      const term = milestoneTerm(r.key) ?? '節目'
      return { ...subjectOf(r.crop), id: 'milestone-' + r.id, date: japanDateKey(r.observedAt), kind: 'field' as const,
        title: '節目：' + term, term, note: '節目の記録', href: '/crops/' + r.crop.id }
    }),
  ]
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

/** 記録のある最も古い日（日本時間）。農場を選んでいれば、その農場の記録だけ。記録が無ければ null（台帳 I28） */
export async function oldestRecordDay(userId: string, farmId?: string): Promise<string | null> {
  const crop = getCropWhere(userId, farmId ? { farmId } : undefined).where
  const byFarm = farmId ? { OR: [{ farmId }, { farmId: null, crop: { farmId } }] } : {}
  const firsts = await Promise.all([
    prisma.workRecord.findFirst({ where: { farm: { userId }, ...(farmId ? { farmId } : {}) }, orderBy: { date: 'asc' }, select: { date: true } }).then(r => r?.date),
    prisma.fertilizerRecord.findFirst({ where: { userId, ...byFarm }, orderBy: { appliedAt: 'asc' }, select: { appliedAt: true } }).then(r => r?.appliedAt),
    prisma.pesticideRecord.findFirst({ where: { userId, ...byFarm }, orderBy: { appliedAt: 'asc' }, select: { appliedAt: true } }).then(r => r?.appliedAt),
    prisma.harvest.findFirst({ where: { crop }, orderBy: { date: 'asc' }, select: { date: true } }).then(r => r?.date),
    prisma.fieldConcern.findFirst({ where: { crop }, orderBy: { observedAt: 'asc' }, select: { observedAt: true } }).then(r => r?.observedAt),
    prisma.pestCheck.findFirst({ where: { crop, present: true }, orderBy: { observedAt: 'asc' }, select: { observedAt: true } }).then(r => r?.observedAt),
    prisma.cropMilestone.findFirst({ where: { crop }, orderBy: { observedAt: 'asc' }, select: { observedAt: true } }).then(r => r?.observedAt),
  ])
  const days = firsts.filter((d): d is Date => d != null).map(japanDateKey).sort()
  return days[0] ?? null
}

/** 霜の行の2行目の出典の一言。観測所は名前と年数、ほかは農場の座標の推計 */
function frostNote(stationName: string | null, usableYears: number | null) {
  if (usableYears == null || !stationName) return '過去' + FROST_ARCHIVE_YEARS + '年の推計'
  return stationName + '観測所の' + (usableYears < FROST_ARCHIVE_YEARS ? '記録のそろった' + usableYears + '年' : '過去' + FROST_ARCHIVE_YEARS + '年')
}

export async function loadOutlookMaterial(userId: string, now: Date) {
  const [farmData, cropData, sprays] = await Promise.all([
    prisma.farm.findMany({ where: { userId }, select: { id: true, name: true, prefectureCode: true, latitude: true, longitude: true }, orderBy: { name: 'asc' } }),
    prisma.crop.findMany({ where: getCropWhere(userId).where, select: {
      id: true, name: true, farmId: true, cropKind: true, variety: true, growingSite: true, plantingMethod: true, plantingDate: true, status: true,
      milestones: { select: { key: true, observedAt: true } }, _count: { select: { harvests: true } },
      fieldConcerns: { where: { followUpResult: null }, select: { id: true, observedAt: true, locations: true, symptoms: true } },
    } }),
    prisma.pesticideRecord.findMany({ where: { userId, daysBeforeHarvest: { not: null } }, select: { cropId: true, appliedAt: true, daysBeforeHarvest: true } }),
  ])
  const harvestFrom = harvestDatesByCrop(sprays)
  const todayKey = japanDateKey(now)
  // The harvest projection API takes a local calendar date, independent of the server time zone.
  const today = new Date(todayKey + 'T12:00:00')
  const farms = await Promise.all(farmData.map(async farm => {
    const frost: FarmOutlook['frost'] = []
    const point = hasWeatherCoordinates(farm) ? { latitude: Number(farm.latitude), longitude: Number(farm.longitude) } : null
    const active = cropData.some(c => c.farmId === farm.id && c.status === 'growing')
    const [autumn, spring, forecast] = point ? await Promise.all([
      readFarmAutumnFrost(point, now).catch(() => null), readFarmSpringFrost(point).catch(() => null),
      active ? getForecastDays(point, now).catch(() => []) : [],
    ]) : [null, null, []]
    if (autumn?.summary) {
      const source = autumn.source === 'station' ? 'station' : 'archive'
      const distance = autumn.source === 'station' && autumn.distanceKm != null ? '。' + stationDistanceLabel(autumn.distanceKm, autumn.elevationDiffM) + (autumn.near ? '' : '離れているので目安です') : ''
      const text = autumnFirstFrostSentence(autumn) + distance
      const note = frostNote(autumn.stationName, autumn.source === 'station' ? autumn.usableYears : null)
      frost.push({ ...autumn.summary.earliest, label: '初霜が最も早かった日', source, text, note }, { ...autumn.summary.mean, label: '初霜の平均の日', source, text, note })
    }
    if (spring?.summary) {
      const source = spring.source === 'station' ? 'station' : 'archive'
      const text = springFrostSentence(spring, { withStationDistance: true })
      const note = frostNote(spring.stationName, spring.source === 'station' ? spring.usableYears : null)
      frost.push({ ...spring.summary.mean, label: '終霜の平均の日', source, text, note }, { ...spring.summary.latest, label: '終霜が最も遅かった日', source, text, note })
    }
    return { ...farm, point, frost, forecast }
  }))
  const samples = cropData.some(c => c.status === 'growing' && c.plantingDate && farms.some(f => f.id === c.farmId && f.point))
    ? await loadHarvestSamples(userId) : []
  const archives = new Map<string, ReturnType<typeof loadLocationArchive>>()
  const crops: CropOutlook[] = await Promise.all(cropData.map(async crop => {
    const farm = farms.find(f => f.id === crop.farmId)
    const growing = crop.status === 'growing'
    let window: CropOutlook['window'] = null
    if (growing && crop.plantingDate && farm?.point && japanDateKey(crop.plantingDate) <= todayKey) {
      const basis = pickHarvestBasis(samples, crop)
      if (basis.view.status === 'active' && basis.gdd != null && basis.gdd > 0) {
        if (!archives.has(farm.id)) archives.set(farm.id, loadLocationArchive(farm.point, now).catch(() => null))
        const { count, baseTemp } = basis.view
        const [archive, currentGdd] = await Promise.all([archives.get(farm.id), getAccumulatedGDDFromApi({
          point: farm.point, startDate: gddStartDate(basis.view, crop.plantingDate), endDate: today, count, baseTemp,
        }).catch(() => null)])
        if (archive && currentGdd != null && currentGdd < basis.gdd) {
          const span = projectHarvestWindow({ today, currentGdd, targetGdd: basis.gdd, count, baseTemp, archive, forecastByYmd: forecastAvgByYmd(farm.forecast) })
          if (span) window = { start: ymdKey(span.early), end: ymdKey(span.late), text: formatHarvestGddOutlook({ currentGdd, targetGdd: basis.gdd, reference: { sampleCount: basis.sampleCount, method: basis.view }, windowText: formatHarvestWindow(span) }) }
        }
      }
    }
    return { ...crop, planted: crop.plantingDate && japanDateKey(crop.plantingDate), growing, hasHarvest: crop._count.harvests > 0,
      concerns: crop.fieldConcerns.map(c => ({ id: c.id, observed: japanDateKey(c.observedAt), answered: false,
        labels: [...concernChoiceLabels(concernLocations, c.locations), ...concernChoiceLabels(concernSymptoms, c.symptoms)] })),
      harvestFrom: harvestFrom.get(crop.id), window }
  }))
  return { farms, crops }
}
