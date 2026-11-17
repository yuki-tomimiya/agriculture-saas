import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { calculateHarvestWindow } from '@/lib/insights/harvest-date-window'
import type { LocationArchive } from '@/lib/weather-normals'

Object.assign(globalThis, { React })
process.env.TZ = 'Asia/Tokyo'

function weatherArchive(years: number): LocationArchive {
  const first = Date.UTC(2016, 0, 1)
  const end = Date.UTC(2016 + years, 0, 1)
  const times = Array.from({ length: (end - first) / 86_400_000 }, (_, i) =>
    new Date(first + i * 86_400_000).toISOString().slice(0, 10))
  return {
    times, tempMean: times.map(() => 20), tempMin: null, tempMax: times.map(() => 25),
    precip: times.map(() => 2), radiation: times.map(() => 10),
  }
}

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
  const cardWithTitle = (html: string, title: string) =>
    html.split('</section>').find(section => section.includes(title)) ?? ''

  const ended = await render('ended')
  assert.match(ended, /終了時点：60 ℃日/)
  const endedRain = cardWithTitle(ended, 'の積算雨量の推移')
  assert.match(endedRain, /11月12日までの実績雨量/)
  assert.doesNotMatch(endedRain, /先の値は数値予報モデルの計算結果です|日降水量20mm以上の計算結果|該当日はありません/)
  const endedSun = cardWithTitle(ended, 'の積算日射量の推移')
  assert.equal((endedSun.match(/終了時点：30 MJ\/㎡/g) ?? []).length, 2)
  assert.match(endedSun, /11月12日までの積算日射量を、同じ期間の10年平均/)
  assert.doesNotMatch(endedSun, /現在：|今年/)
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
  const growingRain = cardWithTitle(missingArchive, 'の積算雨量の推移')
  assert.match(growingRain, /今日までの実績雨量/)
  assert.match(growingRain, /先の値は数値予報モデルの計算結果です/)
  assert.match(growingRain, /日降水量20mm以上の計算結果/)
  assert.match(growingRain, /該当日はありません/)
  const growingSun = cardWithTitle(missingArchive, 'の積算日射量の推移')
  assert.match(growingSun, /現在：70 MJ\/㎡/)
  assert.match(growingSun, /今年：70 MJ\/㎡/)

  await db.openMeteoDaily.updateMany({
    where: { location: '36.5551,139.8828', date: { lte: '2025-12-31' } },
    data: { tempMean: 20 },
  })
  const endedComparison = cardWithTitle(await render('ended'), 'の積算日射量の推移')
  assert.match(endedComparison, /11月12日までの10年平均/)
  assert.match(endedComparison, /終了時点の積算は10年平均より/)
  assert.doesNotMatch(endedComparison, /今年は/)
  assert.match(cardWithTitle(await render('missing-archive'), 'の積算日射量の推移'), /今年は10年平均より/)

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

test('10年平均は要素別に8年以上そろう月日を300日以上必要とする', async () => {
  const { accumulateNormals, dailyNormalsFromArchive, meanNormalMaxTemp } = await import('@/lib/weather-normals')
  const archive = weatherArchive(10)
  const full = dailyNormalsFromArchive(archive)
  assert.equal(full?.size, 365)
  assert.deepEqual(full?.get('1-1'), { precipMm: 2, radiationMj: 10, tempMean: 20, tempMax: 25 })
  assert.equal(dailyNormalsFromArchive(weatherArchive(1)), null)
  assert.equal(dailyNormalsFromArchive(weatherArchive(7)), null)
  assert.deepEqual(dailyNormalsFromArchive(weatherArchive(8)), full)

  const wetDay = archive.times.indexOf('2016-01-01')
  archive.precip[wetDay] = 20
  assert.equal(dailyNormalsFromArchive(archive)?.get('1-1')?.precipMm, 3.8)
  archive.precip[wetDay] = null
  const oneMissing = dailyNormalsFromArchive(archive)
  assert.deepEqual(oneMissing, full)

  // 雨の有効な月日を299日、最高気温は300日にする。値がある年はどちらも8年。
  for (let i = 0; i < archive.times.length; i++) {
    const day = archive.times[i]
    const keepYear = day < '2024'
    const keepRain = day.slice(5) <= '10-26'
    const keepMax = day.slice(5) <= '10-27'
    archive.precip[i] = keepYear && keepRain ? 2 : null
    archive.tempMax![i] = keepYear && keepMax ? 25 : null
  }
  const partial = dailyNormalsFromArchive(archive)
  assert.ok(partial)
  assert.deepEqual(partial.get('1-1'), { precipMm: null, radiationMj: 10, tempMean: 20, tempMax: 25 })
  assert.equal(meanNormalMaxTemp(partial, ['2026-10-27']), 25)
  assert.equal(meanNormalMaxTemp(partial, ['2026-10-27', '2026-10-28']), null)
  assert.deepEqual(accumulateNormals({
    normals: partial, plantingDate: new Date(2026, 0, 1), days: 1, count: 'simple', baseTemp: 0,
  }), { precipMm: null, radiationMj: [10, 20], gdd: [20, 40] })
})

test('地域の降水量は同じ暦日の全日がそろってから比較する', async () => {
  const { getRegionalRainSummary } = await import('../lib/insights/regional-context')
  const now = new Date(2026, 0, 9, 12)
  const point = { latitude: 36.5551, longitude: 139.8828 }
  const summarize = (current: number[], previous: number[], normalsMissing?: boolean) => getRegionalRainSummary(point, {
    now, archive: async () => {
      if (normalsMissing == null) return null
      const archive = weatherArchive(10)
      if (normalsMissing) archive.precip = archive.times.map(day => day.endsWith('-01-03') ? null : 2)
      return archive
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
