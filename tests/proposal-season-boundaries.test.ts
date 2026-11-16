import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temporarySqlite } from './helpers/temporary-sqlite'
import type { ForecastDay } from '@/lib/weather-forecast'
import type { ProposalWeather } from '@/lib/proposals/weather'

test('霜の提案と前回の作付け比較を固定データで確かめる', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })

  const { assessSweetPotatoFrost } = await import('@/lib/proposals/frost')
  const { scoreCrops } = await import('@/lib/proposals/scoring')
  const { getCropSeasonComparisons } = await import('@/lib/insights/crop-season-compare')
  const setupUser = (id: string) => db.user.create({
    data: { id, email: `${id}@example.invalid`, password: 'unused' },
  })
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('固定データのテストでは外部へ接続しない') })

  await t.test('L1 例年の霜の30日前と、収穫見込みの遅い日の境目', () => {
    const day = (month: number, date: number) => new Date(2026, month - 1, date, 12)
    const args = {
      today: day(10, 16), targetGdd: 2400, currentGdd: 2200, forecast: [], hasSeenRoots: false,
      firstFrost: {
        summary: { earliest: { month: 11, day: 15 }, mean: { month: 11, day: 24 }, years: 10 },
        source: 'estimate' as const, stationName: null, distanceKm: null, elevationDiffM: null, near: false,
      },
      harvestWindow: { early: day(11, 14), late: day(11, 16), years: 10, reached: 10, inside: 8 },
      harvestWindowReady: true,
    }
    assert.equal(assessSweetPotatoFrost({ ...args, today: day(10, 15) }), null)
    const frost = assessSweetPotatoFrost(args)
    assert.equal(frost?.trigger, 'frost-season')
    assert.match(frost.conclusion, /見込みの時期より先に霜が来る年があります/)
    for (const late of [day(11, 14), day(11, 15)]) {
      assert.equal(assessSweetPotatoFrost({ ...args, harvestWindow: { ...args.harvestWindow, late } }), null)
    }
    const unreachable = assessSweetPotatoFrost({ ...args, harvestWindow: null })
    assert.match(unreachable?.harvestOutlook?.text ?? '', /今季は.*には届かない見込み/)
    assert.equal(assessSweetPotatoFrost({ ...args, harvestWindow: null, harvestWindowReady: false }), null)
  })

  await t.test('L1 春の霜は対象の露地作付けに出し、6日後と7日後で段を分ける', async () => {
    const user = await setupUser('spring')
    const farmId = 'spring-farm'
    await db.farm.create({ data: {
      id: farmId, userId: user.id, name: '宇都宮', latitude: 36.5551, longitude: 139.8828,
    } })
    const planted = { farmId, plantingMethod: 'direct', plantingDate: new Date(2026, 3, 1, 12) }
    await db.crop.createMany({ data: [
      { ...planted, id: 'outdoor', name: '露地ジャガイモ', cropKind: 'potato', growingSite: 'open' },
      { ...planted, id: 'house', name: 'ハウスのジャガイモ', cropKind: 'potato', growingSite: 'house' },
      { ...planted, id: 'other', name: 'キャベツ', cropKind: 'cabbage', growingSite: 'open' },
      { ...planted, id: 'old', name: '前年のジャガイモ', cropKind: 'potato', growingSite: 'open',
        plantingDate: new Date(2025, 3, 1, 12) },
    ] })
    const forecastDay: ForecastDay = {
      date: '2026-06-30', dayLabel: '6月30日', weather: '晴れ', weatherCode: 0,
      maxTemp: 15, minTemp: 4, avgTemp: 10, precipitation: null, wind: null,
    }
    const springFrost = async (day: number, forecast: ForecastDay) => {
      const now = new Date(2026, 5, day, 12)
      const weather: ProposalWeather = {
        async forecast() { return [forecast] },
        async accumulatedGdd() { return null },
        async archive() { return null },
        async frost() { return null },
        async coolNight() { return { date: null, source: 'estimate', stationName: null, distanceKm: null } },
        async precipitation() { return [] },
      }
      const result = await scoreCrops(user.id, now, [], { now, weather, confirmations: true })
      return result.cards.filter(card => card.trigger === 'spring-frost')
    }
    const dueSoon = await springFrost(24, forecastDay)
    assert.deepEqual(dueSoon.map(card => card.cropId), ['outdoor'])
    assert.equal(dueSoon[0].urgency, 'today')
    assert.equal(dueSoon[0].signal?.deadline, '2026-06-30')
    assert.match(dueSoon[0].conclusion, /土寄せ/)
    const nextWeek = await springFrost(23, forecastDay)
    assert.deepEqual(nextWeek.map(card => card.urgency), ['thisWeek'])
    assert.deepEqual(await springFrost(24, { ...forecastDay, date: '2026-07-01' }), [])
  })

  await t.test('C1 前年の同じ農場・作型を選び、収穫と売上の記録があるときだけ増減を出す', async () => {
    const user = await setupUser('compare')
    const userId = user.id
    const sameFarm = { farmId: 'compare-main', cropKind: 'daikon', name: 'ダイコン', growingSite: 'open' }
    await db.farm.createMany({ data: [
      { id: sameFarm.farmId, name: '同じ農場', userId }, { id: 'compare-other', name: '別の農場', userId },
    ] })
    const date = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12)
    await db.crop.createMany({ data: [
      { ...sameFarm, id: 'current', plantingDate: date(2026, 1, 5) },
      { ...sameFarm, id: 'same-year', plantingDate: date(2026, 1, 4) },
      { ...sameFarm, id: 'previous', plantingDate: date(2025, 12, 20) },
      { ...sameFarm, id: 'far-in-season', plantingDate: date(2025, 2, 20) },
      { ...sameFarm, id: 'older', plantingDate: date(2024, 1, 5) },
      { ...sameFarm, id: 'other-farm', farmId: 'compare-other', plantingDate: date(2025, 1, 5) },
    ] })
    await db.harvest.createMany({ data: [
      { cropId: 'current', quantity: 12, date: date(2026, 4, 1) },
      { cropId: 'previous', quantity: 8, date: date(2025, 12, 31) },
    ] })
    const sale = { userId, farmId: sameFarm.farmId, customerName: '直売所', quantity: 1 }
    await db.sale.createMany({ data: [
      { ...sale, id: 'sale-current', cropId: 'current', amount: 3000, unitPrice: 3000, date: date(2026, 4, 1) },
      { ...sale, id: 'sale-previous', cropId: 'previous', amount: 4000, unitPrice: 4000, date: date(2025, 12, 31) },
    ] })
    const compare = async () => {
      const rows = await getCropSeasonComparisons(userId)
      assert.deepEqual(rows.filter(row => row.farmId === sameFarm.farmId).map(row => row.currentCropId).sort(),
        ['current', 'same-year'])
      const current = rows.find(row => row.currentCropId === 'current')
      assert.ok(current)
      assert.equal(current.previousCropId, 'previous')
      return current
    }
    const initial = await compare()
    assert.equal(initial.harvestDiffPct, 50)
    assert.equal(initial.salesDiffPct, -25)
    assert.equal(initial.summaryLine, '収量は前回作付けより +50%です。')

    await db.crop.update({ where: { id: 'previous' }, data: { plantingDate: date(2025, 2, 3) } })
    assert.doesNotMatch((await compare()).summaryLine, /植えた時期/)
    await db.crop.update({ where: { id: 'previous' }, data: { plantingDate: date(2025, 2, 4) } })
    assert.match((await compare()).summaryLine, /植えた時期が30日違います/)
    await db.sale.update({ where: { id: 'sale-previous' }, data: { amount: 0, unitPrice: 0 } })
    assert.equal((await compare()).salesDiffPct, null)
    await db.sale.update({ where: { id: 'sale-current' }, data: { amount: 0, unitPrice: 0 } })
    assert.equal((await compare()).salesDiffPct, 0)
    await db.harvest.deleteMany({ where: { cropId: 'current' } })
    const missing = await compare()
    assert.equal(missing.harvestDiffPct, null)
    assert.match(missing.summaryLine, /前回の収量は8kgでした/)
  })
})
