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
import { offsetDay } from './dates'
import type { CalendarRecord, CropOutlook, FarmOutlook } from './outlook'

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
