import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { loadStationCatalog, pickNearestStation, type JmaStation } from '@/lib/jma/stations'

const utsunomiya = { latitude: 36.5551, longitude: 139.8828 }
const today = new Date(2026, 10, 15, 12)
const observedDate = { month: 11, day: 10 }
const estimatedDate = { month: 11, day: 20 }

function autumnRows(missingInLastYear: number, hasFrost = true) {
  return Array.from({ length: 8 }, (_, index) => {
    const year = 2016 + index
    return Array.from({ length: 139 }, (_, day) => {
      const date = new Date(Date.UTC(year, 7, 15 + day)).toISOString().slice(0, 10)
      return {
        date,
        tMin: index === 7 && day < missingInLastYear ? null : hasFrost && date.endsWith('-11-10') ? 4 : 5,
      }
    })
  }).flat()
}

test('霜と夜の冷えを固定した観測・推計データで確かめる', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })

  const { chooseStation, frostStationLine, readCoolNight, readFarmFrost, readStationFrost } =
    await import('@/lib/jma/frost-record')
  const { summarizeAutumnFirstFrost, summarizeSpringLastFrost } = await import('@/lib/weather-frost')
  t.mock.timers.enable({ apis: ['Date'], now: today })
  const elevation = 120
  await db.openMeteoElevation.create({ data: { location: '36.5551,139.8828', metres: elevation } })
  const station = pickNearestStation(utsunomiya.latitude, utsunomiya.longitude, elevation, loadStationCatalog().stations)
  assert.ok(station?.usable)
  const blockNo = station.station.blockNo
  const setObservations = async (rows: { date: string; tMin: number | null }[]) => {
    await db.jmaDailyTemp.deleteMany({ where: { blockNo } })
    if (rows.length) await db.jmaDailyTemp.createMany({ data: rows.map(row => ({ ...row, blockNo })) })
  }
  const fetch = t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    const url = new URL(input)
    assert.ok(url.pathname.endsWith('/archive'))
    assert.equal(url.searchParams.get('start_date'), '2016-01-01')
    assert.equal(url.searchParams.get('end_date'), '2025-12-31')
    const days = Array.from({ length: 3653 }, (_, i) =>
      new Date(Date.UTC(2016, 0, 1 + i)).toISOString().slice(0, 10))
    const missing = days.map(() => null)
    return new Response(JSON.stringify({ daily: {
      time: days,
      temperature_2m_min: days.map(day => day.endsWith('-11-20') ? 4 : day.endsWith('-08-17') ? 12 : 14),
      temperature_2m_mean: missing, temperature_2m_max: missing,
      precipitation_sum: missing, shortwave_radiation_sum: missing, sunshine_duration: missing,
    } }))
  })

  await t.test('F3 近い・目安・推計の距離と標高差、位置がない農場', async () => {
    const stationAt = (km: number, elevationM = 0): JmaStation => ({
      precNo: 41, kind: 'a', blockNo: String(km), name: `観測点${km}`,
      lat: utsunomiya.latitude + km / 111.195, lon: utsunomiya.longitude, elevationM,
    })
    const closest = (elevationM: number, ...stations: JmaStation[]) =>
      pickNearestStation(utsunomiya.latitude, utsunomiya.longitude, elevationM, stations)

    const near = closest(100, stationAt(21), stationAt(19))
    assert.equal(near?.station.name, '観測点19')
    assert.equal(near?.elevationDiffM, 100)
    assert.equal(near?.near, true)
    assert.equal(near?.usable, true)
    assert.match(frostStationLine(near, true), /観測点19（農場から19km・標高差100m）$/)
    for (const approximate of [closest(101, stationAt(19)), closest(0, stationAt(21)), closest(0, stationAt(39))]) {
      assert.equal(approximate?.near, false)
      assert.equal(approximate?.usable, true)
      assert.match(frostStationLine(approximate, true), /目安$/)
    }
    const distant = closest(0, stationAt(41))
    assert.equal(distant?.usable, false)
    assert.match(frostStationLine(distant, true), /推計の気温/)
    const noLocation = {}
    assert.equal(await chooseStation(noLocation), null)
    assert.equal(await readFarmFrost(noLocation, today), null)
    assert.equal(fetch.mock.callCount(), 0)
  })

  await t.test('S1 秋は初日、春は最後の日を4℃を含めて集計する', () => {
    assert.deepEqual(summarizeAutumnFirstFrost(
      ['2023-08-14', '2023-08-15', '2023-08-16', '2023-08-17', '2023-08-18', '2024-08-19', '2025-12-31'],
      [1, null, 4.1, 4, 3, 4, 5],
    ), { earliest: { month: 8, day: 17 }, mean: { month: 8, day: 18 }, years: 2 })
    assert.deepEqual(summarizeAutumnFirstFrost(['2025-12-31'], [4]), {
      earliest: { month: 12, day: 31 }, mean: { month: 12, day: 31 }, years: 1,
    })
    assert.equal(summarizeAutumnFirstFrost(['2025-08-14', '2025-12-31'], [1, 5]), null)
    assert.deepEqual(summarizeSpringLastFrost(
      ['2024-01-01', '2024-04-09', '2024-07-01', '2025-06-30'],
      [4, 4, 1, 4],
    ), { latest: { month: 6, day: 30 }, mean: { month: 5, day: 20 }, years: 2 })
    assert.equal(summarizeSpringLastFrost(['2025-06-30', '2025-07-01'], [5, 1]), null)
  })

  await t.test('F1 秋の欠測13日なら観測8年、14日なら観測7年で推計へ', async () => {
    const summary = { mean: observedDate, earliest: observedDate, years: 8 }
    let rows = autumnRows(13)
    await setObservations(rows)
    assert.deepEqual(readStationFrost(rows, today), { kind: 'station', summary, usableYears: 8 })
    const observed = await readFarmFrost(utsunomiya, today)
    assert.equal(observed?.source, 'station')
    assert.deepEqual(observed.summary, summary)

    rows = autumnRows(13, false)
    await setObservations(rows)
    assert.deepEqual(readStationFrost(rows, today), { kind: 'none', usableYears: 8 })
    assert.equal(await readFarmFrost(utsunomiya, today), null)
    assert.equal(fetch.mock.callCount(), 0)

    rows = autumnRows(14)
    await setObservations(rows)
    assert.deepEqual(readStationFrost(rows, today), { kind: 'fallback', usableYears: 7 })
    const estimated = await readFarmFrost(utsunomiya, today)
    assert.equal(estimated?.source, 'estimate')
    assert.deepEqual(estimated.summary, { mean: estimatedDate, earliest: estimatedDate, years: 10 })
    assert.equal(fetch.mock.callCount(), 1)
  })

  await t.test('T1 夜の最低気温の平均が8月15日以降に13℃を下回る日', async () => {
    const rows = [
      { date: '2024-08-14', tMin: 10 },
      { date: '2024-08-15', tMin: 12 }, { date: '2025-08-15', tMin: 14 },
      { date: '2024-08-16', tMin: null }, { date: '2025-08-16', tMin: null },
      { date: '2024-08-17', tMin: 12 }, { date: '2025-08-17', tMin: 13 },
    ]
    await setObservations(rows)
    const expected = { month: 8, day: 17 }
    const cooler = await readCoolNight(utsunomiya, today)
    assert.equal(cooler.source, 'station')
    assert.deepEqual(cooler.date, expected)
    await setObservations(rows.slice(0, 5))
    const before = fetch.mock.callCount()
    const noCoolNight = await readCoolNight(utsunomiya, today)
    assert.equal(noCoolNight.source, 'station')
    assert.equal(noCoolNight.date, null)
    assert.equal(fetch.mock.callCount(), before)
    await setObservations([])
    const estimate = await readCoolNight(utsunomiya, today)
    assert.equal(estimate.source, 'estimate')
    assert.deepEqual(estimate.date, expected)
  })
})
