// サーバー専用（node:fsを使い、農場DBや外部APIは参照しない）。
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { contains, type Scale, type SoilFeature } from './format'
import { DEFAULT_SOIL_ROOT, readCatalog, datasetDirectory, datasetStamp, loadDataset, readFeature, type LoadedDataset } from './storage'

export type SoilCandidate = Omit<SoilFeature, 'geometry'> & {
  prefecture: string; scale: Scale; datasetId: string; boundary: boolean
}
export type SoilLookupResult =
  | { status: 'matched'; candidate: SoilCandidate }
  | { status: 'ambiguous'; candidates: SoilCandidate[] }
  | { status: 'no_polygon' }
  | { status: 'data_unavailable'; reason: string }
  | { status: 'no_location' | 'invalid_location' }

/** インスタンスごとに索引のみをキャッシュ。県番号は検索順のヒント。 */
export function createSoilLookup(root = DEFAULT_SOIL_ROOT) {
  const cache = new Map<string, { stamp: string; pending: Promise<LoadedDataset> }>()
  return async function lookup(input: {
    latitude?: number | null; longitude?: number | null; prefectureCode?: string | null
  }): Promise<SoilLookupResult> {
    const { latitude: lat, longitude: lon } = input
    if (lat == null || lon == null) return { status: 'no_location' }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { status: 'invalid_location' }
    try {
      const catalog = await readCatalog(root)
      const prefs = Object.keys(catalog.prefectures).sort((a, b) =>
        Number(b === input.prefectureCode) - Number(a === input.prefectureCode) || a.localeCompare(b))
      if (!prefs.length) return { status: 'data_unavailable', reason: '配備済みの県がありません' }
      const directories = new Set(prefs.map(pref => datasetDirectory(root, catalog.prefectures[pref], pref)))
      for (const directory of cache.keys()) if (!directories.has(directory)) cache.delete(directory)
      const loaded: { pref: string; data: LoadedDataset }[] = []
      // 他県の図のbboxも照合する。壊れた県を黙って無視して「区画なし」にしない。
      for (const pref of prefs) {
        const id = catalog.prefectures[pref]
        const directory = datasetDirectory(root, id, pref)
        const stamp = await datasetStamp(directory)
        let item = cache.get(directory)
        if (!item || item.stamp !== stamp) {
          item = { stamp, pending: loadDataset(directory, id, pref) }; cache.set(directory, item)
        }
        loaded.push({ pref, data: await item.pending })
      }
      let covered = false
      for (const scale of ['50000', '200000'] as const) {
        const candidates: SoilCandidate[] = []
        for (const { pref, data } of loaded) {
          const layer = data.layers[scale]
          if (!contains(layer.index.bbox, lon, lat)) continue
          covered = true
          for (const entry of layer.index.entries) {
            if (!contains(entry.bbox, lon, lat)) continue
            const feature = await readFeature(layer.file, entry)
            if (!booleanPointInPolygon([lon, lat], feature.geometry)) continue
            const boundary = !booleanPointInPolygon([lon, lat], feature.geometry, { ignoreBoundary: true })
            const { geometry: _, ...raw } = feature
            candidates.push({ ...raw, prefecture: pref, scale, datasetId: data.manifest.datasetId, boundary })
          }
        }
        if (candidates.length > 1 || candidates.some(c => c.boundary)) return { status: 'ambiguous', candidates }
        if (candidates.length === 1) return { status: 'matched', candidate: candidates[0] }
      }
      if (!covered || (input.prefectureCode && !catalog.prefectures[input.prefectureCode])) {
        return { status: 'data_unavailable', reason: 'この地点の県のデータが配備されていません' }
      }
      return { status: 'no_polygon' }
    } catch (error) {
      return { status: 'data_unavailable', reason: error instanceof Error ? error.message : '土壌図を読めません' }
    }
  }
}
export const lookupSoilMap = createSoilLookup()
