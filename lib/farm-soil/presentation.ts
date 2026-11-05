import type { FarmSoil } from '@prisma/client'
import { soilClassificationForFarm } from './classification'

export type SoilFarm = {
  id: string; latitude: number | null; longitude: number | null; locationVersion: number; soil: FarmSoil | null
}

/** 表示にも、助言と同じ有効な土と区分を使う（台帳E11）。 */
export function farmSoilPresentation(farm: SoilFarm) {
  const soil = soilClassificationForFarm(farm)
  const saved = farm.soil
  const currentMap = saved?.locationVersion === farm.locationVersion &&
    saved.latitude === farm.latitude && saved.longitude === farm.longitude
  const nonSoil = [saved?.rawGroupCode, saved?.rawSubgroupCode, saved?.rawSeriesCode]
    .some(code => code?.trim().startsWith('Z'))
  const mapName = currentMap && saved?.lookupStatus === 'matched' && !nonSoil ? saved.rawSoilName : null
  let status = ''
  if (soil.group === 'fallback') {
    if (soil.source === 'manual') status = '土の種類が分からないため、これまでの目安を使っています。'
    else if (['location_changed', 'manual_needs_review'].includes(soil.reason)) status = '位置が変わりました。以前に選んだ土の種類を、もう一度確認してください。これまでの目安を使っています。'
    else if (farm.latitude == null || farm.longitude == null) status = '農場の位置を登録すると、土壌図の目安を確認できます。これまでの目安を使っています。'
    else if (nonSoil || soil.reason === 'no_polygon') status = '地図から土の種類を推定できませんでした。分かる場合は選択できます。これまでの目安を使っています。'
    else if (['data_unavailable', 'not_looked_up', 'pending', 'invalid_location'].includes(soil.reason)) status = '土壌図のデータを読み取れないため、これまでの目安を使っています。'
    else if (soil.reason === 'not_in_guideline' && ['D4', 'J4'].includes(saved?.rawGroupCode?.trim() ?? '')) status = 'この土の基準は確認中です。これまでの目安を使っています。'
    else status = 'この土は、普通畑の基準表との対応が確認できていないため、これまでの目安を使っています。'
  }
  const column = soil.group === 'black' ? '黒ボク土・多湿黒ボク土'
    : soil.group === 'sandy' ? '砂丘未熟土・岩屑土'
    : soil.group === 'ordinary' ? 'その他の土（黒ボク土・多湿黒ボク土・砂丘未熟土・岩屑土以外）' : null
  return { soil, status, mapName, column, mapScale: currentMap ? saved?.mapScale : null }
}
