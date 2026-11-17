import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pickNearestStation } from '@/lib/jma/stations'
import type { SoilLookupResult } from '@/lib/soil-map/lookup'
import { withRequestCookies } from './helpers/next-runtime'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('保存前の土地カードはログインを確かめ、情報のある項目を返して農場を作らない', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const previous = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = previous })
  const { POST } = await import('@/app/api/farms/place-card/route')
  const { buildFarmPlaceCard } = await import('@/lib/farms/place-card')
  const { INITIAL_HISTORY_TIMEOUT_MS, loadDailyWeather } = await import('@/lib/open-meteo/archive')
  const { OPEN_METEO_TIMEOUT_MS } = await import('@/lib/open-meteo/fetch')
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 17, 12) })
  await db.user.create({ data: { id: 'test-user', email: 'place-card@example.invalid', password: 'unused' } })

  const chiba = { latitude: 34.9966, longitude: 139.8697 }
  const noWeather = { latitude: 0, longitude: 0 }
  const missingSoil = async (): Promise<SoilLookupResult> =>
    ({ status: 'data_unavailable', reason: '未配備' })
  const timeouts = new WeakMap<AbortSignal, number>()
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    const signal = new AbortController().signal
    timeouts.set(signal, ms)
    return signal
  })
  let archiveCallsForRetryPoint = 0
  let retryPointAvailable = false
  const fetch = t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, options: RequestInit) => {
    const url = new URL(String(input))
    const timeout = timeouts.get(options.signal!)
    if (url.pathname.endsWith('/elevation')) {
      assert.equal(timeout, 10_000)
      return Response.json({ elevation: [10] })
    }
    assert.ok(url.pathname.endsWith('/archive'))
    if (url.searchParams.get('latitude') === '0.0000') {
      archiveCallsForRetryPoint++
      assert.equal(timeout, 30_000)
      if (!retryPointAvailable) return new Response(null, { status: 503 })
    }
    if (url.searchParams.get('latitude') === '35.1000') assert.equal(timeout, 10_000)
    if (url.searchParams.get('latitude') === '34.9966') assert.equal(timeout, 30_000)
    const start = Date.parse(url.searchParams.get('start_date')!)
    const end = Date.parse(url.searchParams.get('end_date')!)
    const time = Array.from({ length: (end - start) / 86_400_000 + 1 }, (_, i) =>
      new Date(start + i * 86_400_000).toISOString().slice(0, 10))
    return Response.json({ daily: {
      time, temperature_2m_mean: time.map(() => 16), temperature_2m_max: time.map(() => 22),
      temperature_2m_min: time.map(date => date.endsWith('-03-01') || date.endsWith('-12-01') ? 3 : 8),
      precipitation_sum: time.map(() => 2), shortwave_radiation_sum: time.map(() => 9),
      sunshine_duration: time.map(() => null),
    } })
  })
  const request = (payload: unknown, userId?: string) => withRequestCookies(
    { get: name => name === 'userId' && userId ? { value: userId } : undefined },
    () => POST(new Request('http://127.0.0.1:3000/api/farms/place-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })),
  )
  assert.equal((await request(chiba)).status, 401)
  assert.equal((await request(chiba, 'unknown')).status, 401)
  for (const payload of [{}, { latitude: ' ', longitude: 139 }, { latitude: 91, longitude: 139 }, { latitude: true, longitude: 0 }]) {
    assert.equal((await request(payload, 'test-user')).status, 400)
  }
  assert.equal(fetch.mock.callCount(), 0)

  const station = pickNearestStation(chiba.latitude, chiba.longitude, 10)
  assert.ok(station?.usable)
  const blockNo = station.station.blockNo
  await db.jmaDailyTemp.createMany({ data: Array.from({ length: 3653 }, (_, i) => {
    const date = new Date(Date.UTC(2016, 0, 1 + i)).toISOString().slice(0, 10)
    return { blockNo, date, tMin: date.endsWith('-03-15') || date.endsWith('-11-20') ? 4 : 8 }
  }) })
  const observed = await buildFarmPlaceCard(chiba, { findSoil: async ({ prefectureCode }) => {
    assert.equal(prefectureCode, '12')
    return {
      status: 'matched', candidate: { id: 'chiba', properties: {}, codes: { group: 'D1', subgroup: 'D1a1', series: 'D1a1t1' },
        soilName: '黒ボク土', landUse: null, codeConflict: false, prefecture: '12', scale: '50000',
        datasetId: 'test', boundary: false },
    }
  } })
  assert.equal(observed.frost.autumn?.source, 'station')
  assert.equal(observed.frost.spring?.source, 'station')
  assert.match(observed.frost.autumn?.text ?? '', /11月20日/)
  assert.match(observed.frost.spring?.text ?? '', /3月15日/)
  assert.equal(observed.normal?.meanAnnualTemp, 16)
  assert.deepEqual(observed.soil, { status: 'matched', name: '黒ボク土', column: '黒ボク土・多湿黒ボク土', scale: '50000' })
  assert.deepEqual(observed.missing, [])

  await db.jmaDailyTemp.deleteMany({ where: { blockNo, date: { startsWith: '2025-' } } })
  await db.jmaDailyTemp.updateMany({ where: { blockNo, date: { endsWith: '-11-20' } }, data: { tMin: 8 } })
  const noAutumnFrost = await buildFarmPlaceCard(chiba, { findSoil: missingSoil })
  assert.match(noAutumnFrost.frost.autumn?.text ?? '', /記録のそろった9年では、秋に最低気温が4℃以下になった日はありません/)
  assert.ok(!noAutumnFrost.missing.includes('autumn_frost'))

  const estimated = await buildFarmPlaceCard({ latitude: 36.5551, longitude: 139.8828 }, { findSoil: missingSoil })
  assert.equal(estimated.frost.autumn?.source, 'estimate')
  assert.equal(estimated.frost.spring?.source, 'estimate')
  assert.equal(estimated.normal?.meanAnnualTemp, 16)
  assert.equal(estimated.soil.status, 'data_unavailable')
  assert.deepEqual(estimated.missing, ['estimated_frost', 'soil'])

  const response = await request(noWeather, 'test-user')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const missing = await response.json()
  assert.equal(missing.normal, null)
  assert.equal(missing.frost.autumn, null)
  assert.equal(missing.frost.spring, null)
  assert.deepEqual(missing.missing, ['autumn_frost', 'spring_frost', 'normal', 'soil'])
  retryPointAvailable = true
  const skipped = await request(noWeather, 'test-user')
  assert.equal((await skipped.json()).normal, null)
  assert.equal(archiveCallsForRetryPoint, 1)
  const retried = await request({ ...noWeather, retryWeather: true }, 'test-user')
  assert.equal((await retried.json()).normal?.meanAnnualTemp, 16)
  assert.equal(archiveCallsForRetryPoint, 2)

  assert.equal(INITIAL_HISTORY_TIMEOUT_MS, 30_000)
  assert.equal(OPEN_METEO_TIMEOUT_MS, 10_000)
  assert.equal((await loadDailyWeather({ latitude: 35.1, longitude: 139.1 }, '2026-11-16', '2026-11-16'))?.length, 1)
  assert.equal(await db.farm.count(), 0)
  assert.equal(await db.crop.count(), 0)
  assert.equal(await db.farmSoil.count(), 0)
})
