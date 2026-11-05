import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createSoilLookup } from '../lib/soil-map/lookup'
import { FORMAT_VERSION, COORDINATE_POLICY, geometryBbox, unionBoxes, rawFeature,
  type Geometry, type Scale, type RawProperties, type Manifest, type SoilIndex } from '../lib/soil-map/format'
import { digestFile, loadDataset } from '../lib/soil-map/storage'
import { importSoilMaps } from '../scripts/soil-map/import'

const square = (x: number, y: number, size = 1): Geometry => ({ type: 'Polygon', coordinates: [
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]],
] })
type Shape = { geometry: Geometry; properties?: RawProperties }
async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'tilltol-soil-test-'))
  t.after(async () => {
    if (path.dirname(path.resolve(root)) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('tilltol-soil-test-')) throw new Error('一時フォルダの範囲が不正')
    await rm(root, { recursive: true, force: true })
  })
  return root
}
async function fixture(root: string, shapes: Record<Scale, Shape[]>, pref = '12', id = 'test-v1') {
  const directory = path.join(root, id, pref)
  await mkdir(directory, { recursive: true })
  const manifest: Manifest = { formatVersion: FORMAT_VERSION, generatorVersion: 'test', datasetId: id, prefecture: pref,
    createdAt: '2026-11-05', coordinatePolicy: COORDINATE_POLICY,
    attribution: '合成テスト', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    processing: '合成形状のみ', layers: {} as Manifest['layers'] }
  for (const scale of ['50000', '200000'] as const) {
    const entries: SoilIndex['entries'] = []
    const records: Buffer[] = []
    let offset = 0; let conflicts = 0
    for (const [n, shape] of shapes[scale].entries()) {
      const feature = rawFeature(`${pref}-${scale}-${n}`, shape.geometry, shape.properties ?? (scale === '50000'
        ? { '群コード': 'F2', '亜群コード': 'F2a2', '統群コード': 'F2a2t1', '包括_統群': '日本語の土壌名', '地目区分': '田' }
        : { SG_CD: 'Z3', SSbG_CD: 'Z3', SSerGrCD: 'Z3', SoilName: '市街地' }), scale)
      if (feature.codeConflict) conflicts++
      const buffer = Buffer.from(JSON.stringify(feature) + '\n')
      entries.push({ id: feature.id, bbox: geometryBbox(feature.geometry), offset, length: buffer.length })
      records.push(buffer); offset += buffer.length
    }
    const box = unionBoxes(entries.map(e => e.bbox))
    const index: SoilIndex = { formatVersion: FORMAT_VERSION, datasetId: id, prefecture: pref, scale, bbox: box, entries }
    const indexFile = path.join(directory, `${scale}.index.json`)
    const featureFile = path.join(directory, `${scale}.ndjson`)
    await writeFile(indexFile, JSON.stringify(index)); await writeFile(featureFile, Buffer.concat(records))
    manifest.layers[scale] = { scale, sourceUrl: 'synthetic', fetchedAt: '2026-11-05', zipSha256: '', sourceCrs: 'JGD2000',
      sourcePrj: '', encoding: 'UTF-8', count: entries.length, codeConflictCount: conflicts, bbox: box,
      index: await digestFile(indexFile), features: await digestFile(featureFile) }
  }
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest))
  let active = { formatVersion: FORMAT_VERSION, prefectures: {} as Record<string, string> }
  try { active = JSON.parse(await readFile(path.join(root, 'active.json'), 'utf8')) } catch { /* 初回 */ }
  active.prefectures[pref] = id
  await writeFile(path.join(root, 'active.json'), JSON.stringify(active))
  return directory
}
const coarse = [{ geometry: square(0, 0, 10) }]

test('位置なし・不正・配備なしを状態で返す', async t => {
  const root = await temporary(t); const lookup = createSoilLookup(root)
  assert.equal((await lookup({})).status, 'no_location')
  for (const latitude of [NaN, Infinity, 91]) assert.equal((await lookup({ latitude, longitude: 140 })).status, 'invalid_location')
  assert.equal((await lookup({ latitude: 35, longitude: 181 })).status, 'invalid_location')
  assert.equal((await lookup({ latitude: 35, longitude: 140 })).status, 'data_unavailable')
})
test('日本語バイト位置、5万優先、ヒント違い、Zコードの保持', async t => {
  const root = await temporary(t)
  const dir = await fixture(root, { '50000': [{ geometry: square(1, 1) }, { geometry: square(3, 3) }], '200000': coarse })
  await loadDataset(dir, 'test-v1', '12', true)
  const lookup = createSoilLookup(root)
  const detailed = await lookup({ latitude: 3.5, longitude: 3.5, prefectureCode: '05' })
  assert.equal(detailed.status, 'matched')
  if (detailed.status === 'matched') {
    assert.equal(detailed.candidate.scale, '50000'); assert.equal(detailed.candidate.soilName, '日本語の土壌名')
  }
  const fallback = await lookup({ latitude: 5, longitude: 5 })
  assert.equal(fallback.status, 'matched')
  if (fallback.status === 'matched') assert.equal(fallback.candidate.codes.group, 'Z3')
})
test('穴では詳細図を採らず、MultiPolygonの別部分を採る', async t => {
  const root = await temporary(t)
  const outer = square(0, 0, 4) as Extract<Geometry, { type: 'Polygon' }>
  const hole = square(1, 1) as Extract<Geometry, { type: 'Polygon' }>
  outer.coordinates.push(hole.coordinates[0])
  const second = square(6, 6) as Extract<Geometry, { type: 'Polygon' }>
  await fixture(root, { '50000': [{ geometry: { type: 'MultiPolygon', coordinates: [outer.coordinates, second.coordinates] } }], '200000': coarse })
  const lookup = createSoilLookup(root)
  const insideHole = await lookup({ latitude: 1.5, longitude: 1.5 })
  assert.equal(insideHole.status, 'matched'); if (insideHole.status === 'matched') assert.equal(insideHole.candidate.scale, '200000')
  const island = await lookup({ latitude: 6.5, longitude: 6.5 })
  assert.equal(island.status, 'matched'); if (island.status === 'matched') assert.equal(island.candidate.scale, '50000')
})
test('境界と複数候補を選ばず粗い図にも戻らない', async t => {
  const root = await temporary(t)
  await fixture(root, { '50000': [{ geometry: square(1, 1) }, { geometry: square(1.25, 1.25) }], '200000': coarse })
  const lookup = createSoilLookup(root)
  assert.equal((await lookup({ latitude: 1.5, longitude: 1.5 })).status, 'ambiguous')
  assert.equal((await lookup({ latitude: 1, longitude: 1 })).status, 'ambiguous')
})
test('隣県も調べ、県境の重複は候補を保持する', async t => {
  const root = await temporary(t)
  await fixture(root, { '50000': [{ geometry: square(1, 1) }], '200000': coarse }, '12')
  await fixture(root, { '50000': [{ geometry: square(5, 5) }], '200000': [{ geometry: square(5, 5) }] }, '13')
  const lookup = createSoilLookup(root)
  const neighbor = await lookup({ latitude: 5.5, longitude: 5.5, prefectureCode: '12' })
  assert.equal(neighbor.status, 'matched'); if (neighbor.status === 'matched') assert.equal(neighbor.candidate.prefecture, '13')
  await fixture(root, { '50000': [{ geometry: square(1, 1) }], '200000': coarse }, '13', 'test-v2')
  const overlapping = await lookup({ latitude: 1.5, longitude: 1.5, prefectureCode: '12' })
  assert.equal(overlapping.status, 'ambiguous'); if (overlapping.status === 'ambiguous') assert.equal(overlapping.candidates.length, 2)
})
test('区画なしと配備なしを分ける', async t => {
  const root = await temporary(t)
  const separated = [{ geometry: square(0, 0) }, { geometry: square(4, 4) }]
  await fixture(root, { '50000': separated, '200000': separated })
  const lookup = createSoilLookup(root)
  assert.equal((await lookup({ latitude: 2, longitude: 2 })).status, 'no_polygon')
  assert.equal((await lookup({ latitude: 39.7, longitude: 140.1, prefectureCode: '05' })).status, 'data_unavailable')
})
test('矛盾コードを補正せず返す', async t => {
  const root = await temporary(t)
  const dir = await fixture(root, { '50000': [{ geometry: square(1, 1), properties: {
    '群コード': 'F2', '亜群コード': 'D6h1', '統群コード': 'D6h1v3', '包括_統群': '未知の名前' } }], '200000': coarse })
  const data = await loadDataset(dir, 'test-v1', '12', true)
  assert.equal(data.manifest.layers['50000'].codeConflictCount, 1)
  const result = await createSoilLookup(root)({ latitude: 1.5, longitude: 1.5 })
  assert.equal(result.status, 'matched'); if (result.status === 'matched') {
    assert.equal(result.candidate.codeConflict, true); assert.equal(result.candidate.codes.group, 'F2')
    assert.equal(result.candidate.codes.subgroup, 'D6h1')
  }
})
test('未知のコードも意味づけず5万図の原値を返す', async t => {
  const root = await temporary(t)
  await fixture(root, { '50000': [{ geometry: square(1, 1), properties: {
    '群コード': 'UNKNOWN', '亜群コード': 'UNKNOWN-x', '統群コード': 'UNKNOWN-x-y', '包括_統群': '未知' } }], '200000': coarse })
  const result = await createSoilLookup(root)({ latitude: 1.5, longitude: 1.5 })
  assert.equal(result.status, 'matched'); if (result.status === 'matched') {
    assert.equal(result.candidate.scale, '50000'); assert.equal(result.candidate.codes.group, 'UNKNOWN')
  }
})
test('キャッシュ後の破損と未配備の片方の図は区画なしにしない', async t => {
  const root = await temporary(t)
  const dir = await fixture(root, { '50000': [{ geometry: square(1, 1) }], '200000': coarse })
  const lookup = createSoilLookup(root)
  assert.equal((await lookup({ latitude: 1.5, longitude: 1.5 })).status, 'matched')
  await writeFile(path.join(dir, '50000.ndjson'), 'broken\n')
  assert.equal((await lookup({ latitude: 1.5, longitude: 1.5 })).status, 'data_unavailable')
  await rm(path.join(dir, '50000.index.json'))
  assert.equal((await lookup({ latitude: 5, longitude: 5 })).status, 'data_unavailable')
})
test('版違い、ハッシュ違い、再ハッシュしても不正なバイト位置は検出', async t => {
  for (const mode of ['version', 'hash', 'offset']) {
    const root = await temporary(t)
    const dir = await fixture(root, { '50000': [{ geometry: square(1, 1) }], '200000': coarse })
    const file = path.join(dir, '50000.index.json'); const index = JSON.parse(await readFile(file, 'utf8'))
    if (mode === 'version') index.datasetId = 'wrong-version'
    else index.entries[0].offset++
    await writeFile(file, JSON.stringify(index))
    if (mode === 'offset') {
      const mf = path.join(dir, 'manifest.json'); const manifest = JSON.parse(await readFile(mf, 'utf8'))
      manifest.layers['50000'].index = await digestFile(file); await writeFile(mf, JSON.stringify(manifest))
    }
    await assert.rejects(loadDataset(dir, 'test-v1', '12', true))
  }
})
test('失敗した取り込みで既存の公開版を切り替えない', async t => {
  const root = await temporary(t)
  await fixture(root, { '50000': [{ geometry: square(1, 1) }], '200000': coarse })
  const before = await readFile(path.join(root, 'active.json'), 'utf8')
  const brokenZip = path.join(root, 'invalid.zip'); await writeFile(brokenZip, 'not a zip')
  await assert.rejects(importSoilMaps({ root, prefecture: '12', sources: {
    '50000': { url: 'synthetic', localZip: brokenZip }, '200000': { url: 'synthetic', localZip: brokenZip },
  } }))
  assert.equal(await readFile(path.join(root, 'active.json'), 'utf8'), before)
})
