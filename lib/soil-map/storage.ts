// Node専用。ブラウザからは取り込まない。
import { createReadStream } from 'node:fs'
import { open, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  FORMAT_VERSION, COORDINATE_POLICY, geometryBbox, unionBoxes, safeId, validPref, validBbox,
  type ActiveCatalog, type FileDigest, type Manifest, type Scale, type SoilFeature, type SoilIndex,
} from './format'

export const DEFAULT_SOIL_ROOT = path.join(process.cwd(), 'data', 'soil')
export async function digestFile(file: string): Promise<FileDigest> {
  const hash = createHash('sha256'); let bytes = 0
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length }
  return { bytes, sha256: hash.digest('hex') }
}
export async function readCatalog(root: string): Promise<ActiveCatalog> {
  const catalog: ActiveCatalog = JSON.parse(await readFile(path.join(root, 'active.json'), 'utf8'))
  if (!catalog || catalog.formatVersion !== FORMAT_VERSION || !catalog.prefectures || typeof catalog.prefectures !== 'object' || Array.isArray(catalog.prefectures) ||
    Object.entries(catalog.prefectures).some(([pref, id]) => !validPref(pref) || !safeId(id))) throw new Error('不正なactive.json')
  return catalog
}
export function datasetDirectory(root: string, id: string, pref: string): string {
  if (!safeId(id) || !validPref(pref)) throw new Error('不正な版または県番号')
  return path.join(root, id, pref)
}
function checkDigest(actual: FileDigest, expected: FileDigest): void {
  if (!expected || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) throw new Error('ハッシュまたは長さが一致しません')
}
export type LoadedLayer = { index: SoilIndex; file: string }
export type LoadedDataset = { manifest: Manifest; layers: Record<Scale, LoadedLayer> }
export async function readFeature(file: string, entry: { id: string; offset: number; length: number }): Promise<SoilFeature> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(entry.length)
    let total = 0
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, entry.offset + total)
      if (!bytesRead) throw new Error('区画の途中でファイルが終わりました')
      total += bytesRead
    }
    if (buffer[buffer.length - 1] !== 10) throw new Error('区画の終端が不正です')
    const feature: SoilFeature = JSON.parse(buffer.toString('utf8'))
    if (feature.id !== entry.id || !feature.properties || !feature.codes) throw new Error('区画と索引のIDが一致しません')
    return feature
  } finally { await handle.close() }
}
/** fullなら全区画のバイト位置・日本語・形状・範囲も検査する。 */
export async function loadDataset(directory: string, id: string, pref: string, full = false): Promise<LoadedDataset> {
  const manifest: Manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'))
  if (manifest.formatVersion !== FORMAT_VERSION || manifest.datasetId !== id || manifest.prefecture !== pref ||
    manifest.coordinatePolicy !== COORDINATE_POLICY || !manifest.layers) throw new Error('manifestの版が一致しません')
  const layers = {} as Record<Scale, LoadedLayer>
  for (const scale of ['50000', '200000'] as const) {
    const meta = manifest.layers[scale]
    const indexPath = path.join(directory, `${scale}.index.json`)
    const file = path.join(directory, `${scale}.ndjson`)
    const index: SoilIndex = JSON.parse(await readFile(indexPath, 'utf8'))
    if (!meta || meta.scale !== scale || index.formatVersion !== FORMAT_VERSION || index.datasetId !== id ||
      index.prefecture !== pref || index.scale !== scale || !validBbox(index.bbox) || !Array.isArray(index.entries) ||
      !index.entries.length || index.entries.length !== meta.count || !validBbox(meta.bbox) ||
      JSON.stringify(meta.bbox) !== JSON.stringify(index.bbox)) throw new Error('索引の版・件数・範囲が一致しません')
    checkDigest(await digestFile(indexPath), meta.index)
    checkDigest(await digestFile(file), meta.features)
    let offset = 0; let conflicts = 0
    const ids = new Set<string>()
    for (const entry of index.entries) {
      if (typeof entry.id !== 'string' || ids.has(entry.id) || !validBbox(entry.bbox) ||
        !Number.isSafeInteger(entry.offset) || entry.offset !== offset ||
        !Number.isSafeInteger(entry.length) || entry.length < 2 || entry.length > 16 * 1024 * 1024) throw new Error('不正な索引のバイト位置')
      ids.add(entry.id); offset += entry.length
      if (full) {
        const feature = await readFeature(file, entry)
        if (JSON.stringify(geometryBbox(feature.geometry)) !== JSON.stringify(entry.bbox)) throw new Error('区画と索引のbboxが違います')
        if (feature.codeConflict) conflicts++
      }
    }
    if (offset !== meta.features.bytes || JSON.stringify(unionBoxes(index.entries.map(e => e.bbox))) !== JSON.stringify(index.bbox) ||
      (full && conflicts !== meta.codeConflictCount)) throw new Error('本体の長さ・範囲・矛盾件数が違います')
    layers[scale] = { index, file }
  }
  return { manifest, layers }
}

// 公開済みの版は不変。改変された場合はstatを見て再検証する。
export async function datasetStamp(directory: string): Promise<string> {
  const files = ['manifest.json', '50000.index.json', '50000.ndjson', '200000.index.json', '200000.ndjson']
  return (await Promise.all(files.map(async name => {
    const info = await stat(path.join(directory, name)); return `${info.size}:${info.mtimeMs}:${info.ctimeMs}`
  }))).join('/')
}
