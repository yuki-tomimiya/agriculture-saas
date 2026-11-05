import type { FarmSoil } from '@prisma/client'
import { resolveEffectiveSoil, type EffectiveSoil } from './resolve'
export const SOIL_MAPPING_VERSION = 'soil-groups-20261105-v1'
export type SoilGroup = 'black' | 'ordinary' | 'sandy' | 'fallback'
export type SoilClassification = {
  group: SoilGroup; source: EffectiveSoil['source']; label: string | null; reason: string; mappingVersion: string
}
/** 設計4と台帳E11。名前の文字列では分類しない。D5は11-01の決定。 */
const MAP_GROUPS: Record<string, Exclude<SoilGroup, 'fallback'>> = {
  D1: 'black', D3: 'black', D5: 'black', D6: 'black',
  B1: 'ordinary', E1: 'ordinary', E2: 'ordinary', E3: 'ordinary',
  F2: 'ordinary', F3: 'ordinary', F4: 'ordinary', G1: 'ordinary', G2: 'ordinary', H2: 'ordinary', I1: 'ordinary',
  J2: 'sandy', J3: 'sandy',
}
const MANUAL_GROUPS: Record<string, Exclude<SoilGroup, 'fallback'>> = {
  'brown-forest': 'ordinary', 'brown-lowland': 'ordinary', yellow: 'ordinary', 'gray-lowland': 'ordinary',
  'gray-upland': 'ordinary', peat: 'ordinary', 'dark-red': 'ordinary', red: 'ordinary', gley: 'ordinary',
  andosol: 'black', 'wet-andosol': 'black', lithosol: 'sandy', 'dune-regosol': 'sandy',
}
export function classifyEffectiveSoil(soil: EffectiveSoil): SoilClassification {
  const result = (group: SoilGroup, reason: string, label: string | null): SoilClassification =>
    ({ group, source: soil.source, label: label ?? (soil.source === 'map' ? soil.seriesCode ?? soil.groupCode : null), reason, mappingVersion: SOIL_MAPPING_VERSION })
  if (soil.source === 'unknown') return result('fallback', soil.reason, null)
  if (soil.source === 'manual') return result(Object.hasOwn(MANUAL_GROUPS, soil.key) ? MANUAL_GROUPS[soil.key] : 'fallback', soil.key === 'unknown' ? 'manual_unknown' : 'manual_choice', soil.label)
  let group = soil.groupCode?.replace(/\s/g, '') ?? ''
  const subgroup = soil.subgroupCode?.replace(/\s/g, '') ?? ''
  const series = soil.seriesCode?.replace(/\s/g, '') ?? ''
  if (!group || !subgroup || !series) return result('fallback', 'missing_code', soil.soilName)
  // G/G_だけから区分を推測せず、下位コードが同じG1又はG2を指す場合だけ別名を許す。
  if (group === 'G' || group === 'G_') {
    const alias = /^(G[12])/.exec(subgroup)?.[1]
    if (!alias || !series.startsWith(alias)) return result('fallback', 'unknown_alias', soil.soilName)
    group = alias
  }
  if (!subgroup.startsWith(group) || !series.startsWith(group) || !series.startsWith(subgroup)) return result('fallback', 'code_conflict', soil.soilName)
  if (group === 'B1' && (subgroup.startsWith('B1e1') || series.startsWith('B1e1'))) return result('fallback', 'decayed_peat', soil.soilName)
  if (group.startsWith('Z')) return result('fallback', 'non_soil_code', soil.soilName)
  const mapped = Object.hasOwn(MAP_GROUPS, group) ? MAP_GROUPS[group] : undefined
  return result(mapped ?? 'fallback', mapped ? 'map_code' : ['D2', 'D4', 'J4', 'F1', 'F5', 'H1', 'A1', 'A2', 'C1', 'J1'].includes(group) ? 'not_in_guideline' : 'unknown_code', soil.soilName)
}
export function soilClassificationForFarm(farm: {
  latitude: number | null; longitude: number | null; locationVersion: number; soil: FarmSoil | null
}): SoilClassification {
  let effective = resolveEffectiveSoil(farm)
  // 生コードのprefix検査ではG_とG1/G2も矛盾印になる。明示した別名だけを再検査する。
  if (effective.source === 'unknown' && effective.reason === 'code_conflict' &&
    farm.soil && ['G', 'G_'].includes(farm.soil.rawGroupCode?.replace(/\s/g, '') ?? '')) {
    effective = { source: 'map', soilName: farm.soil.rawSoilName, groupCode: farm.soil.rawGroupCode,
      subgroupCode: farm.soil.rawSubgroupCode, seriesCode: farm.soil.rawSeriesCode,
      mapScale: farm.soil.mapScale, datasetId: farm.soil.datasetId }
  }
  return classifyEffectiveSoil(effective)
}
export const FALLBACK_SOIL = classifyEffectiveSoil({ source: 'unknown', reason: 'not_looked_up' })
export function soilNutrientBasis(soil: SoilClassification): string {
  if (soil.group === 'fallback') return 'この土は普通畑の基準の表との対応が確かめられていないため、これまでの目安を使っています。'
  return `普通畑の目安です（${soil.source === 'manual' ? '本人の選択' : '地図の目安'}：${soil.label ?? '土壌図のコード'}）。`
}
export function soilNutrientTrigger(farmId: string, soil: SoilClassification): string {
  // 今の基準では、導入前に閉じたカードのキーを引き継ぐ。
  return `soil-nutrient:${farmId}${soil.group === 'fallback' ? '' : `:${soil.group}`}`
}
