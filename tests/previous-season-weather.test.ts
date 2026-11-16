import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('前回の作付けと作業を利用者で分け、位置なしの天気は取得しない', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const original = runtime.prisma
  runtime.prisma = db
  const { getPreviousSeasonWeather } = await import('../lib/insights/previous-season-weather')
  const { buildPersonalLayerForCrop } = await import('../lib/ai-proposal-context')
  const { hasWeatherCoordinates, getHistoricalDailyTemps } = await import('../lib/weather-forecast')
  const { getTodayProposals } = await import('../lib/ai-proposal')
  runtime.prisma = original
  const assertNoFetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('外部通信は使わない') })

  const coordinates = { latitude: 36.5551, longitude: 139.8828 }
  const missing = { latitude: null, longitude: null }
  for (const point of [
    undefined, missing, { ...coordinates, latitude: null }, { ...coordinates, longitude: null },
    { ...coordinates, longitude: undefined }, { ...coordinates, latitude: '  ' },
    { ...coordinates, longitude: '不明' }, { ...coordinates, latitude: Infinity },
  ]) assert.equal(hasWeatherCoordinates(point), false)
  for (const point of [coordinates, { latitude: 34.9966, longitude: 139.8697 }, { latitude: 0, longitude: 0 }]) {
    assert.equal(hasWeatherCoordinates(point), true)
  }

  const plantingDate = new Date(2026, 10, 1)
  const now = new Date(2026, 10, 16)
  const previousDate = new Date(2025, 10, 1)
  const shared = { name: 'さつまいも', cropKind: 'sweet-potato', variety: '紅はるか', farmId: null }
  await db.user.createMany({ data: [
    { id: 'A', email: 'a@example.invalid', password: 'unused' },
    { id: 'B', email: 'b@example.invalid', password: 'unused' },
  ] })
  await db.farm.createMany({ data: [
    { id: 'A-farm', userId: 'A', name: 'Aの農場' },
    { id: 'B-farm', userId: 'B', name: 'Bの農場' },
  ] })
  await db.crop.createMany({ data: [
    { ...shared, id: 'current', userId: 'A', plantingDate },
    { ...shared, id: 'foreign', userId: 'B', plantingDate: previousDate, status: 'harvested' },
  ] })
  await db.workRecord.create({ data: {
    cropId: 'foreign', farmId: 'B-farm', date: new Date(2025, 10, 13), taskType: 'Bの作業',
  } })
  const input = { ...shared, userId: 'A', cropId: 'current', plantingDate, count: 'simple' as const, baseTemp: 0 }
  const personal = { ...input, cropName: input.name, farmName: '農場未設定', now }
  assert.equal(await getPreviousSeasonWeather({ ...input, ...coordinates }), null)
  assert.doesNotMatch(await buildPersonalLayerForCrop(personal) ?? '', /前回作付け|Bの作業/)

  await db.crop.create({ data: {
    ...shared, id: 'own', userId: 'A', plantingDate: previousDate, harvestDate: new Date(2025, 10, 14), status: 'harvested',
  } })
  await db.workRecord.createMany({ data: [
    { cropId: 'own', farmId: 'A-farm', date: new Date(2025, 10, 13), taskType: 'Aの作業' },
    { cropId: 'own', farmId: 'B-farm', date: new Date(2025, 10, 13), taskType: '別の農場の作業' },
  ] })
  await db.openMeteoDaily.createMany({ data: Array.from({ length: 14 }, (_, i) => ({
    date: `2025-11-${String(i + 1).padStart(2, '0')}`,
    location: '36.5551,139.8828', tempMean: 20, tempMax: 25, tempMin: 15, precip: 1, radiation: 10,
  })) })
  assert.equal((await getPreviousSeasonWeather({ ...input, ...coordinates }))?.previousCropId, 'own')
  const layer = await buildPersonalLayerForCrop(personal) ?? ''
  assert.match(layer, /前回作付けの同時期.*Aの作業/)
  assert.doesNotMatch(layer, /Bの作業|別の農場の作業/)

  assert.equal(await getPreviousSeasonWeather({ ...input, ...missing }), null)
  assert.deepEqual(await getHistoricalDailyTemps({
    startDate: plantingDate, endDate: now, point: missing as unknown as typeof coordinates,
  }), [])
  await db.crop.update({ where: { id: 'current' }, data: { farmId: 'A-farm' } })
  await getTodayProposals('A', { now })
  assert.equal(assertNoFetch.mock.callCount(), 0)
})
