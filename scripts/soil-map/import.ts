import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { unzipSync } from 'fflate'
import {
  FORMAT_VERSION, COORDINATE_POLICY, geometryBbox, unionBoxes, rawFeature, validPref,
  type Geometry, type RawProperties, type SoilIndex, type Manifest, type Scale,
} from '../../lib/soil-map/format'
import { digestFile, loadDataset, readCatalog } from '../../lib/soil-map/storage'

// shapefileは取り込みCLIだけから読む。実行時の検索へは依存させない。
const shapefile = require('shapefile') as {
  open(shp: Uint8Array, dbf: Uint8Array, options: { encoding: string }): Promise<{
    read(): Promise<{ done: boolean; value: { geometry: Geometry; properties: RawProperties } }>
  }>
}
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export type ImportSource = { url: string; localZip?: string }

export async function importSoilMaps(args: {
  root: string; prefecture: string; sources: Record<Scale, ImportSource>
}): Promise<{ datasetId: string; manifest: Manifest }> {
  if (!validPref(args.prefecture)) throw new Error('県番号は01〜47です')
  const datasetId = `naro-soil-v1-${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID().slice(0, 8)}`
  const staging = path.join(args.root, `.staging-${datasetId}`)
  const directory = path.join(staging, args.prefecture)
  await mkdir(directory, { recursive: true })
  const manifest: Manifest = {
    formatVersion: FORMAT_VERSION, generatorVersion: 'soil-import-1', datasetId,
    prefecture: args.prefecture, createdAt: new Date().toISOString(), coordinatePolicy: COORDINATE_POLICY,
    attribution: '農研機構、日本土壌インベントリー', license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    processing: '県別ShapeをShift_JISで読み、原属性とPolygon/MultiPolygonを保持して索引JSON・NDJSONに変換。座標変換・丸め・簡略化・コードの補正はしない。',
    layers: {} as Manifest['layers'],
  }
  for (const scale of ['50000', '200000'] as const) {
    const source = args.sources[scale]
    let zip: Uint8Array
    if (source.localZip) zip = await readFile(source.localZip)
    else {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) throw new Error(`土壌図の取得失敗: ${response.status} ${source.url}`)
      zip = new Uint8Array(await response.arrayBuffer())
    }
    const zipHash = sha(zip)
    const archiveName = `${scale}.source.zip`
    await writeFile(path.join(directory, archiveName), zip)
    const unzipped = unzipSync(zip, { filter: entry => {
      if (entry.originalSize > 512 * 1024 * 1024) throw new Error('ZIPのファイルが大きすぎます')
      return /\.(shp|dbf|prj)$/i.test(entry.name)
    } })
    const shpKeys = Object.keys(unzipped).filter(key => /\.shp$/i.test(key))
    if (shpKeys.length !== 1) throw new Error('ZIPには1組のShapeが必要です')
    const stem = shpKeys[0].slice(0, -4)
    const byExtension = (ext: string) => {
      const key = Object.keys(unzipped).find(k => k.toLowerCase() === (stem + ext).toLowerCase())
      if (!key) throw new Error(`ZIPに${ext}がありません`)
      return unzipped[key]
    }
    const prj = new TextDecoder().decode(byExtension('.prj'))
    if (!prj.includes('GCS_JGD_2000') || !prj.includes('Degree')) throw new Error('対応していない座標系です')
    const sourceReader = await shapefile.open(byExtension('.shp'), byExtension('.dbf'), { encoding: 'shift_jis' })
    const index: SoilIndex = { formatVersion: FORMAT_VERSION, datasetId, prefecture: args.prefecture, scale,
      bbox: [0, 0, 0, 0], entries: [] }
    const featureFile = path.join(directory, `${scale}.ndjson`)
    const writer = await open(featureFile, 'wx')
    let offset = 0; let conflictCount = 0
    try {
      for (;;) {
        const result = await sourceReader.read()
        if (result.done) break
        const id = `${args.prefecture}-${scale}-${index.entries.length + 1}`
        const bbox = geometryBbox(result.value.geometry)
        const feature = rawFeature(id, result.value.geometry, result.value.properties, scale)
        if (feature.codeConflict) conflictCount++
        const buffer = Buffer.from(JSON.stringify(feature) + '\n', 'utf8')
        await writer.writeFile(buffer)
        index.entries.push({ id, bbox, offset, length: buffer.length })
        offset += buffer.length
      }
      await writer.sync()
    } finally { await writer.close() }
    index.bbox = unionBoxes(index.entries.map(e => e.bbox))
    const indexPath = path.join(directory, `${scale}.index.json`)
    await writeFile(indexPath, JSON.stringify(index))
    manifest.layers[scale] = {
      scale, sourceUrl: source.url, fetchedAt: new Date().toISOString(), zipSha256: zipHash,
      sourceCrs: 'JGD2000 (EPSG:4612)', sourcePrj: prj, encoding: 'Shift_JIS',
      count: index.entries.length, codeConflictCount: conflictCount, bbox: index.bbox,
      index: await digestFile(indexPath), features: await digestFile(featureFile),
    }
  }
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  // 日本語を含む全区画のバイト範囲を検査してから公開する。
  await loadDataset(directory, datasetId, args.prefecture, true)
  await rename(staging, path.join(args.root, datasetId))
  // 県を追加するとき、他県の参照を消さない。並行実行はCLIでロックする。
  let active: Awaited<ReturnType<typeof readCatalog>>
  try { active = await readCatalog(args.root) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    active = { formatVersion: FORMAT_VERSION, prefectures: {} }
  }
  active.prefectures[args.prefecture] = datasetId
  const temporary = path.join(args.root, `.active-${randomUUID()}.json`)
  await writeFile(temporary, JSON.stringify(active, null, 2) + '\n')
  await rename(temporary, path.join(args.root, 'active.json'))
  return { datasetId, manifest }
}
