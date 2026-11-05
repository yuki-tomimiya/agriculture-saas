import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { createFarmSoilService, FarmSoilError } from '../lib/farm-soil/service'
import { parseFarmInput } from '../lib/farms/input'
import { MANUAL_SOIL_OPTIONS } from '../lib/farm-soil/options'
import type { SoilLookupResult } from '../lib/soil-map/lookup'

const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => { exec(sql: string): void; close(): void } }
const matched = (id = 'original'): SoilLookupResult => ({ status: 'matched', candidate: {
  id, prefecture: '12', scale: '50000', datasetId: 'test-v1', boundary: false,
  properties: { '群コード': 'F2', '地目区分': '田' }, codes: { group: 'F2', subgroup: 'F2a2', series: 'F2a2t1' },
  soilName: 'テスト土壌', landUse: '田', codeConflict: false,
} })
const data = { name: '一時DBだけの農場', description: null, latitude: 35, longitude: 140, prefectureCode: '12', municipalityCode: '122050' }
let schemaSql: string | undefined
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(tmpdir(), 'tilltol-farmsoil-test-'))
  const file = path.join(directory, 'test.db')
  const sql = new DatabaseSync(file)
  try {
    schemaSql ??= execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff',
      '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
    sql.exec(schemaSql)
  } finally { sql.close() }
  const db = new PrismaClient({ datasources: { db: { url: `file:${file.replace(/\\/g, '/')}` } } })
  t.after(async () => {
    await db.$disconnect()
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('tilltol-farmsoil-test-')) throw new Error('一時DBの範囲が不正')
    await rm(directory, { recursive: true, force: true })
  })
  await db.user.createMany({ data: [{ id: 'owner', email: 'owner@example.invalid', password: 'unused' }, { id: 'other', email: 'other@example.invalid', password: 'unused' }] })
  return db
}
test('選択肢は指針の13土壌名と不明、基準の区分は持たない', () => {
  assert.deepEqual(MANUAL_SOIL_OPTIONS.map(o => o.label), ['褐色森林土', '褐色低地土', '黄色土', '灰色低地土', '灰色台地土', '泥炭土', '暗赤色土', '赤色土', 'グライ土', '黒ボク土', '多湿黒ボク土', '岩屑土', '砂丘未熟土', '分からない／一覧にない'])
  assert.equal(new Set(MANUAL_SOIL_OPTIONS.map(o => o.key)).size, 14)
})
test('登録で県番号を渡し、訂正・地図へ戻す・明示的不明・不正キー・他人を検証', async t => {
  const db = await fixture(t)
  let received: unknown
  const service = createFarmSoilService(db, { catalogVersion: async () => 'catalog-v1', lookup: async input => { received = input; return matched() } })
  const farm = await service.create('owner', data)
  assert.deepEqual(received, { latitude: 35, longitude: 140, prefectureCode: '12' })
  assert.equal((await service.getOwned('owner', farm.id)).effective.source, 'map')
  const corrected = await service.correct('owner', farm.id, 'set', 'gley')
  assert.deepEqual(corrected.effective, { source: 'manual', key: 'gley', label: 'グライ土' })
  const reset = await service.correct('owner', farm.id, 'reset')
  assert.equal(reset.effective.source, 'map'); assert.equal(reset.farm.soil!.rawSeriesCode, 'F2a2t1')
  const unknown = await service.correct('owner', farm.id, 'set', 'unknown')
  assert.deepEqual(unknown.effective, { source: 'manual', key: 'unknown', label: '分からない／一覧にない' })
  await assert.rejects(service.correct('owner', farm.id, 'set', 'free-text'), (e: unknown) => e instanceof FarmSoilError && e.status === 400)
  for (const op of [() => service.getOwned('other', farm.id), () => service.correct('other', farm.id, 'reset'), () => service.update('other', farm.id, { name: '不可' })]) {
    await assert.rejects(op(), (e: unknown) => e instanceof FarmSoilError && e.status === 404)
  }
})
test('名前・説明だけでは引き直さず、位置変更では訂正を残して要再確認', async t => {
  const db = await fixture(t); let calls = 0
  const service = createFarmSoilService(db, { catalogVersion: async () => 'v1', lookup: async () => { calls++; return matched() } })
  const farm = await service.create('owner', data)
  await service.correct('owner', farm.id, 'set', 'andosol')
  const before = (await service.getOwned('owner', farm.id)).farm.soil!
  const patch = parseFarmInput({ name: '新しい名前', description: '説明' }, farm)
  assert.ok(!('error' in patch)); assert.ok(!Object.hasOwn(patch, 'latitude'))
  await service.update('owner', farm.id, patch)
  assert.equal(calls, 1)
  const unchanged = (await service.getOwned('owner', farm.id)).farm
  assert.equal(unchanged.locationVersion, 0); assert.equal(unchanged.latitude, 35)
  await service.update('owner', farm.id, { latitude: 35 })
  assert.equal(calls, 1)
  await service.update('owner', farm.id, { latitude: 36 })
  const moved = await service.getOwned('owner', farm.id)
  assert.equal(calls, 2); assert.equal(moved.farm.locationVersion, 1)
  assert.equal(moved.farm.soil!.manualSoilKey, 'andosol'); assert.equal(moved.farm.soil!.manualStatus, 'needs_review')
  assert.equal(moved.farm.soil!.manualUpdatedAt!.getTime(), before.manualUpdatedAt!.getTime())
  assert.deepEqual(moved.effective, { source: 'unknown', reason: 'manual_needs_review' })
  const reconfirmed = await service.correct('owner', farm.id, 'set', 'andosol')
  assert.equal(reconfirmed.effective.source, 'manual')
})
test('照合できなくても農場登録・位置保存は成功し、位置なしも保存', async t => {
  const db = await fixture(t)
  const service = createFarmSoilService(db, { catalogVersion: async () => null, lookup: async input => input.latitude == null
    ? { status: 'no_location' } : { status: 'data_unavailable', reason: '秋田は未配備' } })
  const outside = await service.create('owner', { ...data, prefectureCode: '05', latitude: 39.7, longitude: 140.1 })
  assert.equal((await service.getOwned('owner', outside.id)).farm.soil!.lookupStatus, 'data_unavailable')
  await service.update('owner', outside.id, { latitude: 39.8 })
  assert.equal((await service.getOwned('owner', outside.id)).farm.latitude, 39.8)
  const empty = await service.create('owner', { ...data, latitude: null, longitude: null })
  assert.equal((await service.getOwned('owner', empty.id)).farm.soil!.lookupStatus, 'no_location')
  const failed = createFarmSoilService(db, { lookup: async () => { throw new Error('壊れた土壌図') }, catalogVersion: async () => 'v1' })
  const saved = await failed.create('owner', data)
  assert.equal((await failed.getOwned('owner', saved.id)).farm.soil!.lookupStatus, 'data_unavailable')
})
test('座標が元へ戻っても位置の版で古い結果を棄却する', async t => {
  const db = await fixture(t)
  const farm = await db.farm.create({ data: { ...data, userId: 'owner' } })
  let release!: (value: SoilLookupResult) => void
  let entered!: () => void
  const waiting = new Promise<void>(resolve => { entered = resolve })
  let first = true
  const service = createFarmSoilService(db, { catalogVersion: async () => 'v1', lookup: async () => {
    if (first) { first = false; entered(); return new Promise<SoilLookupResult>(resolve => { release = resolve }) }
    return matched('new')
  } })
  const old = service.refresh(farm)
  await waiting
  await service.update('owner', farm.id, { latitude: 36 })
  await service.update('owner', farm.id, { latitude: 35 })
  release(matched('old'))
  assert.equal(await old, 'stale')
  const current = await service.getOwned('owner', farm.id)
  assert.equal(current.farm.soil!.featureId, 'new'); assert.equal(current.farm.locationVersion, 2)
})
test('同じ位置の並行照合と照合中の訂正を上書きしない', async t => {
  const db = await fixture(t)
  const farm = await db.farm.create({ data: { ...data, userId: 'owner' } })
  let release!: (value: SoilLookupResult) => void; let entered!: () => void; let first = true
  const waiting = new Promise<void>(resolve => { entered = resolve })
  const service = createFarmSoilService(db, { catalogVersion: async () => 'v1', lookup: async () => {
    if (first) { first = false; entered(); return new Promise<SoilLookupResult>(resolve => { release = resolve }) }
    return matched('new')
  } })
  const old = service.refresh(farm); await waiting
  await service.correct('owner', farm.id, 'set', 'unknown')
  await service.refresh(farm)
  release(matched('old')); assert.equal(await old, 'stale')
  const current = await service.getOwned('owner', farm.id)
  assert.equal(current.farm.soil!.featureId, 'new'); assert.equal(current.effective.source, 'manual')
})
test('一括照合は未取得・版変更だけを引き、所有者と本人の訂正を保持', async t => {
  const db = await fixture(t); let version = 'v1'; let calls = 0
  const service = createFarmSoilService(db, { catalogVersion: async () => version, lookup: async () => { calls++; return matched(version) } })
  const farm = await db.farm.create({ data: { ...data, userId: 'owner' } })
  const result = await service.refreshAll(); assert.equal(result.processed, 1); assert.equal(calls, 1)
  await service.correct('owner', farm.id, 'set', 'unknown')
  assert.equal((await service.refreshAll()).skipped, 1)
  version = 'v2'; assert.equal((await service.refreshAll()).processed, 1)
  const after = await service.getOwned('owner', farm.id)
  assert.equal(after.farm.userId, 'owner'); assert.equal(after.farm.soil!.manualSoilKey, 'unknown')
  assert.equal(after.effective.source, 'manual'); assert.equal(after.farm.soil!.datasetId, 'test-v1')
})
test('農場削除で土の記録も消える', async t => {
  const db = await fixture(t)
  const service = createFarmSoilService(db, { catalogVersion: async () => 'v1', lookup: async () => matched() })
  const farm = await service.create('owner', data)
  await db.farm.delete({ where: { id: farm.id } })
  assert.equal(await db.farmSoil.count(), 0)
})
