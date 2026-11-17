import { CLIMATE_REGION_SOURCE, climateRegionSentence, meanAnnualTemp } from '@/lib/benchmarks/climate-region'
import { classifyEffectiveSoil } from '@/lib/farm-soil/classification'
import { soilGuidelineColumn } from '@/lib/farm-soil/presentation'
import { autumnFirstFrostSentence, chooseStation, frostStationLine, readFarmAutumnFrost, readFarmSpringFrost, springFrostSentence } from '@/lib/jma/frost-record'
import { suggestPrefecture, type PlaceSuggestion } from '@/lib/places/suggest'
import { lookupSoilMap, type SoilLookupResult } from '@/lib/soil-map/lookup'
import { FROST_RISK_MAX_C } from '@/lib/weather-frost'
import { dailyNormalsFromArchive, loadLocationArchive } from '@/lib/weather-normals'
import type { FarmCoordinates } from './coordinates'

type FrostText = { text: string; source: 'station' | 'estimate' }
type PlaceSoil = {
  status: 'matched'
  name: string | null
  column: string | null
  scale: '50000' | '200000'
} | { status: 'data_unavailable' | 'ambiguous' | 'no_polygon' }

export type PlaceCard = {
  suggestion: PlaceSuggestion | null
  frost: { autumn: FrostText | null; spring: FrostText | null; stationLine: string | null; usesElevation: boolean }
  normal: { meanAnnualTemp: number; text: string; source: typeof CLIMATE_REGION_SOURCE } | null
  soil: PlaceSoil
  missing: ('autumn_frost' | 'spring_frost' | 'estimated_frost' | 'normal' | 'soil')[]
}

function placeSoil(lookup: SoilLookupResult): PlaceSoil {
  if (lookup.status === 'ambiguous' || lookup.status === 'no_polygon') return { status: lookup.status }
  if (lookup.status !== 'matched') return { status: 'data_unavailable' }
  const { candidate } = lookup
  const { group, subgroup, series } = candidate.codes
  if ([group, subgroup, series].some(code => code?.trim().startsWith('Z'))) return { status: 'no_polygon' }
  const soil = classifyEffectiveSoil({
    source: 'map', soilName: candidate.soilName, groupCode: group, subgroupCode: subgroup,
    seriesCode: series, mapScale: candidate.scale, datasetId: candidate.datasetId,
  })
  if (candidate.soilName == null && soil.group === 'fallback') return { status: 'no_polygon' }
  return { status: 'matched', name: candidate.soilName, column: soilGuidelineColumn(soil.group), scale: candidate.scale }
}

export async function buildFarmPlaceCard(
  point: FarmCoordinates, { findSoil = lookupSoilMap, retryWeather = false } = {},
): Promise<PlaceCard> {
  const suggestion = suggestPrefecture(point.latitude, point.longitude)
  const now = new Date()
  const archive = loadLocationArchive(point, now, { retry: retryWeather })
  // 個別の取得に失敗しても、そろった項目は表示する。
  const [autumn, spring, pick, normals, soilLookup] = await Promise.all([
    readFarmAutumnFrost(point, now, () => archive).catch(() => null),
    readFarmSpringFrost(point, () => archive).catch(() => null),
    chooseStation(point).catch(() => null),
    archive.then(dailyNormalsFromArchive).catch(() => null),
    findSoil({ ...point, prefectureCode: suggestion?.prefectureCode }).catch((): SoilLookupResult =>
      ({ status: 'data_unavailable', reason: '土壌図を読めません' })),
  ])
  const autumnText: FrostText | null = autumn && {
    text: autumn.summary ? autumnFirstFrostSentence(autumn)
      : `この観測所の記録のそろった${autumn.usableYears}年では、秋に最低気温が${FROST_RISK_MAX_C}℃以下になった日はありません。`,
    source: autumn.source,
  }
  const springText: FrostText | null = spring && {
    text: springFrostSentence(spring),
    source: spring.source === 'estimate' ? 'estimate' : 'station',
  }
  const observed = autumnText?.source === 'station' || springText?.source === 'station'
  const estimated = autumnText?.source === 'estimate' || springText?.source === 'estimate'
  const mean = normals ? meanAnnualTemp(normals.values()) : null
  const soil = placeSoil(soilLookup)
  const missing: PlaceCard['missing'] = []
  if (!autumnText) missing.push('autumn_frost')
  if (!springText) missing.push('spring_frost')
  if (estimated) missing.push('estimated_frost')
  if (mean == null) missing.push('normal')
  if (soil.status !== 'matched') missing.push('soil')
  return {
    suggestion,
    frost: {
      autumn: autumnText, spring: springText,
      stationLine: observed || estimated ? frostStationLine(pick, observed) : null,
      usesElevation: observed && pick?.elevationDiffM != null,
    },
    normal: mean == null ? null : { text: climateRegionSentence(mean), meanAnnualTemp: mean, source: CLIMATE_REGION_SOURCE },
    soil,
    missing,
  }
}
