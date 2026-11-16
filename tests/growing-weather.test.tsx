import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { calculateHarvestWindow } from '@/lib/insights/harvest-date-window'

Object.assign(globalThis, { React })
process.env.TZ = 'Asia/Tokyo'

test('生育ナビは終了日に積算を止め、気温が取れないときは0℃日や未到達を出さない', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  const { default: GddCropPage } = await import('../app/gdd/[cropId]/page')
  const { getRetrospectiveGdd } = await import('../lib/insights/crop-season-retrospective')
  const { getTodayProposals } = await import('../lib/ai-proposal')
  const { getAccumulatedGDDFromApi } = await import('../lib/weather-forecast')
  runtime.prisma = savedPrisma
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 16, 12) })

  await db.user.create({ data: { id: 'user', email: 'user@example.invalid', password: 'unused' } })
  await db.farm.createMany({ data: [
    { id: 'end', userId: 'user', name: '終了', latitude: 36.5551, longitude: 139.8828 },
    { id: 'missing', userId: 'user', name: '欠測', latitude: 36.5552, longitude: 139.8828 },
  ] })
  const plantingDate = new Date(2026, 10, 10)
  const harvestDate = new Date(2026, 10, 12)
  await db.crop.createMany({ data: [
    { id: 'ended', name: 'ダイコン・終了', cropKind: 'daikon', plantingMethod: 'direct', farmId: 'end',
      plantingDate, status: 'harvested' },
    { id: 'unknown-end', name: 'ダイコン・終了日なし', cropKind: 'daikon', plantingMethod: 'direct', farmId: 'end',
      plantingDate, status: 'harvested' },
    { id: 'missing-history', name: 'さつまいも・履歴不足', cropKind: 'sweet-potato', farmId: 'missing', plantingDate },
    { id: 'missing-archive', name: 'さつまいも・過去年不足', cropKind: 'sweet-potato', farmId: 'end', plantingDate },
  ] })
  await db.harvest.create({ data: { cropId: 'ended', date: harvestDate, quantity: 1 } })
  const fetchedAt = new Date()
  await db.openMeteoDaily.createMany({ data: ['36.5551', '36.5552'].flatMap((latitude, index) =>
    Array.from({ length: index === 0 ? 7 : 6 }, (_, day) => ({
      location: `${latitude},139.8828`, date: `2026-11-${day + 10}`, fetchedAt,
      tempMean: 20, precip: 1, radiation: 10,
    }))) })

  const calls: URL[] = []
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.pathname.endsWith('/forecast')) return new Response(JSON.stringify({ daily: { time: [] } }))
    const start = url.searchParams.get('start_date')!
    const end = url.searchParams.get('end_date')!
    if (start.startsWith('2026')) return new Response(null, { status: 503 })
    const time = []
    for (let day = Date.parse(start); day <= Date.parse(end); day += 86_400_000) {
      time.push(new Date(day).toISOString().slice(0, 10))
    }
    return new Response(JSON.stringify({ daily: {
      time, temperature_2m_mean: time.map(() => null), temperature_2m_max: time.map(() => null),
      temperature_2m_min: time.map(() => null), precipitation_sum: time.map(() => 1),
      shortwave_radiation_sum: time.map(() => 10), sunshine_duration: time.map(() => null),
    } }))
  })
  const render = (cropId: string): Promise<string> =>
    withRequestCookies({ get: name => name === 'userId' ? { value: 'user' } : undefined },
      async () => renderWithRouter(await GddCropPage({ params: Promise.resolve({ cropId }) })))

  const ended = await render('ended')
  assert.match(ended, /終了時点：60 ℃日/)
  assert.match(ended, /11月12日までの実績雨量/)
  assert.doesNotMatch(ended, /14日後見込み|今季は.*届かない/)
  assert.equal(calls.some(url => url.pathname.endsWith('/forecast')), false)
  assert.deepEqual(await getRetrospectiveGdd('user', 'ended'), { accumulatedGdd: 60 })
  assert.match(await render('unknown-end'), /作付けの終わりの日を決められません/)

  const missingHistory = await render('missing-history')
  assert.ok(calls.some(url => url.searchParams.get('start_date') === '2026-11-16' &&
    url.searchParams.get('latitude') === '36.5552'))
  assert.match(missingHistory, /日平均気温を取得できなかった日があるため、積算温度は計算できません/)
  assert.doesNotMatch(missingHistory, /現在：0 ℃日|今季は.*届かない|14日後見込み/)
  assert.equal(await db.openMeteoDaily.count({ where: { location: '36.5552,139.8828' } }), 6)

  const missingArchive = await render('missing-archive')
  assert.match(missingArchive, /現在：140 ℃日/)
  assert.match(missingArchive, /収穫の見込みは計算できません/)
  assert.doesNotMatch(missingArchive, /今季は.*届かない/)

  const now = new Date(2026, 10, 16, 12)
  const archive = { times: ['2025-11-16'], tempMean: [null], tempMin: null, tempMax: null, precip: [1], radiation: [10] }
  const proposals = await getTodayProposals('user', { now, weather: {
    forecast: async () => [],
    archive: async () => archive,
    accumulatedGdd: async () => 140,
    frost: async () => ({ source: 'estimate', summary: { mean: { month: 11, day: 20 }, earliest: { month: 11, day: 19 }, years: 10 },
      stationName: null, distanceKm: null, elevationDiffM: null, near: false }),
    coolNight: async () => ({ date: null, source: 'estimate', stationName: null, distanceKm: null }),
    precipitation: async () => [],
  } })
  assert.ok(proposals.every(proposal => proposal.trigger !== 'frost-season'))

  await db.openMeteoDaily.updateMany({ where: { location: '36.5551,139.8828', date: '2026-11-10' }, data: { tempMean: 0 } })
  assert.equal(await getAccumulatedGDDFromApi({ startDate: plantingDate, endDate: plantingDate,
    count: 'simple', baseTemp: 0, point: { latitude: 36.5551, longitude: 139.8828 } }), 0)
  assert.equal(calculateHarvestWindow({ today: now, currentGdd: 140, targetGdd: 2400, count: 'simple', baseTemp: 0,
    archive: { ...archive, tempMean: [null] } }).status, 'unavailable')
  assert.equal(calculateHarvestWindow({ today: now, currentGdd: 140, targetGdd: 2400, count: 'simple', baseTemp: 0,
    archive: { ...archive, times: ['2025-11-17', '2025-11-18'], tempMean: [0, 0] } }).status, 'unreachable')
})

test('地域の降水量は同じ暦日の全日がそろってから比較する', async () => {
  const { getRegionalRainSummary } = await import('../lib/insights/regional-context')
  const now = new Date(2026, 0, 9, 12)
  const point = { latitude: 36.5551, longitude: 139.8828 }
  const summarize = (current: number[], previous: number[], normalsMissing?: boolean) => getRegionalRainSummary(point, {
    now, archive: async () => {
      if (normalsMissing == null) return null
      const times = Array.from({ length: 365 }, (_, i) =>
        new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10))
      return { times, tempMean: times.map(() => 20), tempMin: null, tempMax: null,
        precip: times.map((_, i) => normalsMissing && i === 2 ? null : 2), radiation: times.map(() => 10) }
    },
    precipitation: async ({ startDate }) => (startDate.getFullYear() === 2026 ? current : previous)
      .map((precipitationMm, i) => ({ date: new Date(startDate.getFullYear(), 0, i + 1), precipitationMm })),
  })
  const missing = await summarize([10, 10], [5, 10, 10, 5, 5, 5, 5])
  assert.equal(missing?.thisYearMm, null)
  assert.equal(missing?.diffPct, null)
  assert.equal(missing?.normalRatioPct, null)
  assert.doesNotMatch(missing?.shortLine ?? '', /-56%/)
  const missingPrevious = await summarize([4, 4, 4, 4, 4, 4, 4], [5, 10])
  assert.equal(missingPrevious?.thisYearMm, 28)
  assert.equal(missingPrevious?.lastYearMm, null)
  assert.equal(missingPrevious?.diffPct, null)
  const complete = await summarize([4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 1])
  assert.equal(complete?.diffPct, 12)
  assert.match(complete?.shortLine ?? '', /\+12%/)
  const rain = Array(7).fill(4) as number[]
  assert.equal((await summarize(rain, rain, false))?.normalRatioPct, 200)
  assert.equal((await summarize(rain, rain, true))?.normalRatioPct, null)
  assert.equal((await summarize([10, 10], rain, false))?.normalRatioPct, null)
})
