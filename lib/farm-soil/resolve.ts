import type { FarmSoil } from '@prisma/client'
import { manualSoilOption, type ManualSoilKey } from './options'

export type EffectiveSoil =
  | { source: 'manual'; key: ManualSoilKey; label: string }
  | { source: 'map'; soilName: string | null; groupCode: string | null; subgroupCode: string | null;
      seriesCode: string | null; mapScale: string | null; datasetId: string | null }
  | { source: 'unknown'; reason: string }

/** 土の選択だけを解決する。診断基準やコード対応表はここでは持たない。 */
export function resolveEffectiveSoil(farm: {
  latitude: number | null; longitude: number | null; locationVersion: number; soil: FarmSoil | null
}): EffectiveSoil {
  const soil = farm.soil
  if (!soil) return { source: 'unknown', reason: 'not_looked_up' }
  if (soil.locationVersion !== farm.locationVersion || soil.latitude !== farm.latitude || soil.longitude !== farm.longitude) {
    return { source: 'unknown', reason: 'location_changed' }
  }
  if (soil.manualStatus === 'needs_review') return { source: 'unknown', reason: 'manual_needs_review' }
  if (soil.manualStatus === 'active') {
    const option = manualSoilOption(soil.manualSoilKey)
    if (!option) return { source: 'unknown', reason: 'invalid_manual_key' }
    return { source: 'manual', ...option }
  }
  if (soil.lookupStatus === 'matched' && !soil.codeConflict) {
    return { source: 'map', soilName: soil.rawSoilName, groupCode: soil.rawGroupCode,
      subgroupCode: soil.rawSubgroupCode, seriesCode: soil.rawSeriesCode,
      mapScale: soil.mapScale, datasetId: soil.datasetId }
  }
  return { source: 'unknown', reason: soil.codeConflict ? 'code_conflict' : soil.lookupStatus }
}
